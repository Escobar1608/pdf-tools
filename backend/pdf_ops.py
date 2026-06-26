"""
Operaciones PDF: unir, contar páginas, miniaturas y reconstrucción
(reordenar / rotar / eliminar páginas).
"""

from pathlib import Path

import fitz  # PyMuPDF
from pypdf import PdfReader, PdfWriter

THUMB_WIDTH = 200  # px


def merge(paths: list[Path], output) -> None:
    """Une varios PDFs en el orden recibido y escribe el resultado en `output`."""
    writer = PdfWriter()
    for path in paths:
        reader = PdfReader(str(path))
        for page in reader.pages:
            writer.add_page(page)
    writer.write(output)


def page_count(pdf_path: Path) -> int:
    with fitz.open(str(pdf_path)) as doc:
        if doc.needs_pass:
            raise ValueError("PDF protegido con contraseña")
        return doc.page_count


def render_thumbnail(pdf_path: Path, page_index: int, dest: Path) -> None:
    """Genera una miniatura PNG de la página indicada (índice base 0)."""
    with fitz.open(str(pdf_path)) as doc:
        if page_index < 0 or page_index >= doc.page_count:
            raise IndexError("Página fuera de rango")
        page = doc[page_index]
        zoom = THUMB_WIDTH / max(page.rect.width, 1)
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        pix.save(str(dest))


def rebuild(pdf_path: Path, page_list: list[dict], output) -> None:
    """
    Reconstruye el PDF según `page_list`: orden nuevo, rotación adicional
    por página, y eliminación implícita de las páginas no incluidas.
    """
    reader = PdfReader(str(pdf_path))
    writer = PdfWriter()
    total = len(reader.pages)

    for item in page_list:
        index = int(item["page"])
        rotation = int(item.get("rotation", 0)) % 360
        if index < 0 or index >= total:
            raise IndexError("Página fuera de rango")
        page = reader.pages[index]
        if rotation:
            page.rotate(rotation)
        writer.add_page(page)

    writer.write(output)


# ===========================================================================
# FASE 2
# ===========================================================================

import shutil as _shutil
import subprocess

import pikepdf


# ---------------------------------------------------------------------------
# Comprimir
# ---------------------------------------------------------------------------
_COMPRESS_LEVELS = {
    "baja":  {"quality": None, "max_dim": None},   # solo optimización sin pérdida
    "media": {"quality": 75,   "max_dim": 1600},
    "alta":  {"quality": 50,   "max_dim": 1100},
}


def compress(pdf_path: Path, out_path: Path, level: str = "media") -> tuple[int, int]:
    """Comprime el PDF. Devuelve (tamaño_original, tamaño_final) en bytes."""
    cfg = _COMPRESS_LEVELS.get(level, _COMPRESS_LEVELS["media"])
    original_size = pdf_path.stat().st_size

    doc = fitz.open(str(pdf_path))
    try:
        if cfg["quality"]:
            processed: set[int] = set()
            for page in doc:
                for img in page.get_images(full=True):
                    xref, smask = img[0], img[1]
                    if xref in processed or smask:  # respeta transparencias
                        continue
                    processed.add(xref)
                    try:
                        pix = fitz.Pixmap(doc, xref)
                        if pix.colorspace is None:  # imágenes sin espacio de color
                            continue
                        if pix.n - pix.alpha > 3:   # CMYK u otros -> RGB
                            pix = fitz.Pixmap(fitz.csRGB, pix)
                        while max(pix.width, pix.height) > cfg["max_dim"] * 1.4:
                            pix.shrink(1)
                        jpg = pix.tobytes("jpeg", jpg_quality=cfg["quality"])
                        old_len = len(doc.xref_stream_raw(xref) or b"")
                        if len(jpg) < old_len:
                            page.replace_image(xref, stream=jpg)
                    except Exception:
                        continue  # imagen problemática: se deja intacta
        doc.save(str(out_path), garbage=4, deflate=True, clean=True)
    finally:
        doc.close()

    return original_size, out_path.stat().st_size


# ---------------------------------------------------------------------------
# Proteger / Desbloquear
# ---------------------------------------------------------------------------
def protect(pdf_path: Path, out_path: Path, password: str) -> None:
    with pikepdf.open(str(pdf_path)) as pdf:
        pdf.save(
            str(out_path),
            encryption=pikepdf.Encryption(user=password, owner=password, R=6),
        )


def unlock(pdf_path: Path, out_path: Path, password: str) -> None:
    with pikepdf.open(str(pdf_path), password=password) as pdf:
        pdf.save(str(out_path))


# ---------------------------------------------------------------------------
# Marca de agua
# ---------------------------------------------------------------------------
def watermark(pdf_path: Path, out_path: Path, text: str, opacity: float = 0.15) -> None:
    """Inserta una marca de agua diagonal centrada en cada página."""
    doc = fitz.open(str(pdf_path))
    try:
        font = fitz.Font("helv")
        for page in doc:
            rect = page.rect
            target_width = min(rect.width, rect.height) * 0.95
            fs = max(12, target_width / max(font.text_length(text, fontsize=1), 0.1))
            tw = fitz.TextWriter(rect, opacity=opacity, color=(0.35, 0.35, 0.35))
            width = font.text_length(text, fontsize=fs)
            center = fitz.Point(rect.width / 2, rect.height / 2)
            origin = fitz.Point(center.x - width / 2, center.y + fs * 0.35)
            tw.append(origin, text, font=font, fontsize=fs)
            tw.write_text(page, morph=(center, fitz.Matrix(-45)))
        doc.save(str(out_path), garbage=2, deflate=True)
    finally:
        doc.close()


# ---------------------------------------------------------------------------
# Números de página
# ---------------------------------------------------------------------------
def page_numbers(
    pdf_path: Path,
    out_path: Path,
    position: str = "abajo-centro",
    fmt: str = "simple",
) -> None:
    doc = fitz.open(str(pdf_path))
    try:
        total = doc.page_count
        margin = 28
        fs = 10
        for i, page in enumerate(doc):
            label = f"{i + 1}" if fmt == "simple" else f"{i + 1} de {total}"
            rect = page.rect  # rectángulo visual (con rotación aplicada)
            width = fitz.Font("helv").text_length(label, fontsize=fs)

            vert, horiz = position.split("-")
            y = rect.y0 + margin if vert == "arriba" else rect.y1 - margin + fs * 0.7
            if horiz == "izquierda":
                x = rect.x0 + margin
            elif horiz == "derecha":
                x = rect.x1 - margin - width
            else:
                x = rect.x0 + (rect.width - width) / 2

            point = fitz.Point(x, y) * page.derotation_matrix
            page.insert_text(
                point, label, fontsize=fs, fontname="helv",
                color=(0.25, 0.25, 0.25), rotate=page.rotation,
            )
        doc.save(str(out_path), garbage=2, deflate=True)
    finally:
        doc.close()


# ---------------------------------------------------------------------------
# Word/Excel/PowerPoint -> PDF (LibreOffice headless)
# ---------------------------------------------------------------------------
def find_soffice() -> str | None:
    candidates = [
        _shutil.which("soffice"),
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/usr/bin/soffice",
        "/usr/bin/libreoffice",
    ]
    for c in candidates:
        if c and Path(c).exists():
            return c
    return None


def convert_to_pdf(src_path: Path, out_dir: Path) -> Path:
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError("LibreOffice no está instalado en el servidor")
    result = subprocess.run(
        [soffice, "--headless", "--norestore", "--convert-to", "pdf",
         "--outdir", str(out_dir), str(src_path)],
        capture_output=True, timeout=180,
    )
    expected = out_dir / (src_path.stem + ".pdf")
    if result.returncode != 0 or not expected.exists():
        raise RuntimeError("LibreOffice no pudo convertir el archivo")
    return expected


# ---------------------------------------------------------------------------
# OCR (ocrmypdf: requiere Tesseract y Ghostscript en el servidor)
# ---------------------------------------------------------------------------
def ocr_available() -> dict:
    tesseract = _shutil.which("tesseract") is not None
    gs = any(_shutil.which(n) for n in ("gs", "gswin64c", "gswin32c"))
    try:
        import ocrmypdf  # noqa: F401
        module = True
    except ImportError:
        module = False
    return {"ok": tesseract and gs and module,
            "tesseract": tesseract, "ghostscript": gs, "ocrmypdf": module}


def run_ocr(pdf_path: Path, out_path: Path, lang: str = "spa") -> None:
    import ocrmypdf
    ocrmypdf.ocr(
        str(pdf_path), str(out_path),
        language=lang, skip_text=True, progress_bar=False,
        optimize=0,
    )
