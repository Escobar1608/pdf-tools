"""
PDF Tools - Servidor local de herramientas PDF
Backend FastAPI: unir, organizar y rotar PDFs.
Sirve también el frontend React compilado (carpeta ../frontend/dist).
"""

import io
import json
import shutil
import threading
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import pdf_ops

BASE_DIR = Path(__file__).resolve().parent
TEMP_DIR = BASE_DIR / "temp"
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

TEMP_DIR.mkdir(exist_ok=True)

SESSION_TTL_SECONDS = 30 * 60  # 30 minutos
MAX_UPLOAD_MB = 200

app = FastAPI(title="PDF Tools", docs_url=None, redoc_url=None)


# ---------------------------------------------------------------------------
# Limpieza automática de sesiones temporales
# ---------------------------------------------------------------------------
def _cleanup_loop():
    while True:
        now = time.time()
        try:
            for session_dir in TEMP_DIR.iterdir():
                if session_dir.is_dir() and now - session_dir.stat().st_mtime > SESSION_TTL_SECONDS:
                    shutil.rmtree(session_dir, ignore_errors=True)
        except Exception:
            pass
        time.sleep(300)  # cada 5 minutos


threading.Thread(target=_cleanup_loop, daemon=True).start()


def _session_path(session_id: str) -> Path:
    # Evita path traversal: el id debe ser un UUID válido
    try:
        uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de sesión inválido")
    path = TEMP_DIR / session_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="La sesión expiró. Vuelve a subir el archivo.")
    return path


async def _save_upload(upload: UploadFile, dest: Path):
    size = 0
    with open(dest, "wb") as f:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_MB * 1024 * 1024:
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"El archivo supera los {MAX_UPLOAD_MB} MB")
            f.write(chunk)


# ---------------------------------------------------------------------------
# Unir PDF
# ---------------------------------------------------------------------------
@app.post("/api/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Se necesitan al menos 2 archivos PDF")

    session_dir = TEMP_DIR / str(uuid.uuid4())
    session_dir.mkdir()
    paths = []
    try:
        for i, upload in enumerate(files):
            if not (upload.filename or "").lower().endswith(".pdf"):
                raise HTTPException(status_code=400, detail=f"'{upload.filename}' no es un PDF")
            dest = session_dir / f"{i:04d}.pdf"
            await _save_upload(upload, dest)
            paths.append(dest)

        output = io.BytesIO()
        pdf_ops.merge(paths, output)
        output.seek(0)
    finally:
        shutil.rmtree(session_dir, ignore_errors=True)

    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="unido.pdf"'},
    )


# ---------------------------------------------------------------------------
# Organizar / Rotar: subir PDF y crear sesión
# ---------------------------------------------------------------------------
@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    session_id = str(uuid.uuid4())
    session_dir = TEMP_DIR / session_id
    session_dir.mkdir()
    pdf_path = session_dir / "original.pdf"
    await _save_upload(file, pdf_path)

    try:
        page_count = pdf_ops.page_count(pdf_path)
    except Exception:
        shutil.rmtree(session_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="No se pudo leer el PDF. ¿Está dañado o protegido?")

    (session_dir / "meta.json").write_text(
        json.dumps({"filename": file.filename, "pages": page_count})
    )
    return {"session_id": session_id, "filename": file.filename, "pages": page_count}


@app.get("/api/thumb/{session_id}/{page}")
def get_thumbnail(session_id: str, page: int):
    session_dir = _session_path(session_id)
    thumb = session_dir / f"thumb_{page}.png"
    if not thumb.exists():
        try:
            pdf_ops.render_thumbnail(session_dir / "original.pdf", page, thumb)
        except IndexError:
            raise HTTPException(status_code=404, detail="Página fuera de rango")
    session_dir.touch()  # mantiene viva la sesión mientras se usa
    return FileResponse(thumb, media_type="image/png")


@app.post("/api/apply")
async def apply_changes(session_id: str = Form(...), pages: str = Form(...)):
    """
    pages: JSON con la lista final de páginas en su nuevo orden.
    Ej: [{"page": 2, "rotation": 90}, {"page": 0, "rotation": 0}]
    Las páginas que no aparecen en la lista se eliminan.
    """
    session_dir = _session_path(session_id)
    try:
        page_list = json.loads(pages)
        assert isinstance(page_list, list) and page_list
    except Exception:
        raise HTTPException(status_code=400, detail="Formato de páginas inválido")

    meta = json.loads((session_dir / "meta.json").read_text())
    original_name = Path(meta["filename"]).stem

    output = io.BytesIO()
    try:
        pdf_ops.rebuild(session_dir / "original.pdf", page_list, output)
    except IndexError:
        raise HTTPException(status_code=400, detail="Índice de página fuera de rango")
    output.seek(0)

    filename = f"{original_name}_editado.pdf"
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ===========================================================================
# FASE 2
# ===========================================================================

from starlette.concurrency import run_in_threadpool

OFFICE_EXTENSIONS = {".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
                     ".odt", ".ods", ".odp", ".rtf", ".txt"}


@app.get("/api/capabilities")
def capabilities():
    ocr_info = pdf_ops.ocr_available()
    return {
        "convert": pdf_ops.find_soffice() is not None,
        "ocr": ocr_info["ok"],
        "ocr_detail": ocr_info,
    }


async def _process_single(file: UploadFile, allowed_exts: set[str], worker, out_name: str,
                          extra_headers: dict | None = None):
    """Guarda el archivo subido, ejecuta `worker(src, session_dir)` en un hilo
    y devuelve el PDF resultante."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400,
                            detail=f"Tipo de archivo no admitido: '{ext or 'sin extensión'}'")

    session_dir = TEMP_DIR / str(uuid.uuid4())
    session_dir.mkdir()
    src = session_dir / f"entrada{ext}"
    await _save_upload(file, src)

    try:
        result_path = await run_in_threadpool(worker, src, session_dir)
        data = result_path.read_bytes()
    finally:
        shutil.rmtree(session_dir, ignore_errors=True)

    headers = {"Content-Disposition": f'attachment; filename="{out_name}"'}
    if extra_headers:
        headers.update(extra_headers)
    return StreamingResponse(io.BytesIO(data), media_type="application/pdf", headers=headers)


@app.post("/api/compress")
async def compress_pdf(file: UploadFile = File(...), level: str = Form("media")):
    if level not in ("baja", "media", "alta"):
        raise HTTPException(status_code=400, detail="Nivel inválido")

    sizes = {}

    def worker(src, session_dir):
        out = session_dir / "salida.pdf"
        original, final = pdf_ops.compress(src, out, level)
        sizes["original"], sizes["final"] = original, final
        return out

    name = Path(file.filename).stem + "_comprimido.pdf"
    response = await _process_single(file, {".pdf"}, worker, name)
    response.headers["X-Original-Size"] = str(sizes.get("original", 0))
    response.headers["X-Final-Size"] = str(sizes.get("final", 0))
    return response


@app.post("/api/protect")
async def protect_pdf(file: UploadFile = File(...), password: str = Form(...)):
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres")

    def worker(src, session_dir):
        out = session_dir / "salida.pdf"
        try:
            pdf_ops.protect(src, out, password)
        except Exception as e:
            if "password" in str(e).lower():
                raise HTTPException(status_code=400, detail="El PDF ya está protegido con contraseña")
            raise HTTPException(status_code=400, detail="No se pudo proteger el PDF")
        return out

    name = Path(file.filename).stem + "_protegido.pdf"
    return await _process_single(file, {".pdf"}, worker, name)


@app.post("/api/unlock")
async def unlock_pdf(file: UploadFile = File(...), password: str = Form(...)):
    import pikepdf

    def worker(src, session_dir):
        out = session_dir / "salida.pdf"
        try:
            pdf_ops.unlock(src, out, password)
        except pikepdf.PasswordError:
            raise HTTPException(status_code=400, detail="Contraseña incorrecta")
        return out

    name = Path(file.filename).stem + "_desbloqueado.pdf"
    return await _process_single(file, {".pdf"}, worker, name)


@app.post("/api/watermark")
async def watermark_pdf(
    file: UploadFile = File(...),
    text: str = Form(...),
    opacity: float = Form(0.15),
):
    text = text.strip()
    if not text or len(text) > 80:
        raise HTTPException(status_code=400, detail="El texto debe tener entre 1 y 80 caracteres")
    opacity = min(max(opacity, 0.05), 0.6)

    def worker(src, session_dir):
        out = session_dir / "salida.pdf"
        pdf_ops.watermark(src, out, text, opacity)
        return out

    name = Path(file.filename).stem + "_marca.pdf"
    return await _process_single(file, {".pdf"}, worker, name)


@app.post("/api/pagenumbers")
async def pagenumbers_pdf(
    file: UploadFile = File(...),
    position: str = Form("abajo-centro"),
    fmt: str = Form("simple"),
):
    valid = {f"{v}-{h}" for v in ("arriba", "abajo") for h in ("izquierda", "centro", "derecha")}
    if position not in valid:
        raise HTTPException(status_code=400, detail="Posición inválida")
    if fmt not in ("simple", "de_total"):
        raise HTTPException(status_code=400, detail="Formato inválido")

    def worker(src, session_dir):
        out = session_dir / "salida.pdf"
        pdf_ops.page_numbers(src, out, position, fmt)
        return out

    name = Path(file.filename).stem + "_numerado.pdf"
    return await _process_single(file, {".pdf"}, worker, name)


@app.post("/api/convert")
async def convert_office(file: UploadFile = File(...)):
    if not pdf_ops.find_soffice():
        raise HTTPException(status_code=503,
                            detail="LibreOffice no está instalado en el servidor (ver README)")

    def worker(src, session_dir):
        try:
            return pdf_ops.convert_to_pdf(src, session_dir)
        except Exception:
            raise HTTPException(status_code=400, detail="No se pudo convertir el archivo")

    name = Path(file.filename).stem + ".pdf"
    return await _process_single(file, OFFICE_EXTENSIONS, worker, name)


@app.post("/api/ocr")
async def ocr_pdf(file: UploadFile = File(...), lang: str = Form("spa")):
    if not pdf_ops.ocr_available()["ok"]:
        raise HTTPException(status_code=503,
                            detail="OCR no disponible: falta Tesseract o Ghostscript en el servidor (ver README)")
    if lang not in ("spa", "eng", "spa+eng"):
        raise HTTPException(status_code=400, detail="Idioma inválido")

    def worker(src, session_dir):
        out = session_dir / "salida.pdf"
        try:
            pdf_ops.run_ocr(src, out, lang)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error de OCR: {type(e).__name__}")
        return out

    name = Path(file.filename).stem + "_ocr.pdf"
    return await _process_single(file, {".pdf"}, worker, name)


# ---------------------------------------------------------------------------
# Frontend estático (React compilado) — SIEMPRE al final, después de /api/*
# ---------------------------------------------------------------------------
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def missing_frontend():
        return {
            "error": "No se encontró frontend/dist. Compila el frontend con 'npm run build' "
                     "o usa el ZIP que ya incluye la carpeta dist."
        }
