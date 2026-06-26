# ===========================================================================
# Etapa 1 — Compilar el frontend React con Node
# ===========================================================================
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

# Instalar dependencias primero (mejor cacheo de capas)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund

# Compilar
COPY frontend/ ./
RUN npm run build


# ===========================================================================
# Etapa 2 — Imagen final con Python + LibreOffice + Tesseract + Ghostscript
# ===========================================================================
FROM python:3.12-slim

# Evita prompts interactivos y mensajes .pyc
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Programas externos que necesitan las herramientas de la app:
#  - libreoffice-core/-writer/-calc/-impress -> "Office a PDF" (sin la suite completa, más liviano)
#  - tesseract-ocr + idioma español         -> OCR
#  - ghostscript                            -> requerido por ocrmypdf
#  - fonts-dejavu                           -> fuentes para que LibreOffice renderice bien
RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice-core \
        libreoffice-writer \
        libreoffice-calc \
        libreoffice-impress \
        tesseract-ocr \
        tesseract-ocr-spa \
        tesseract-ocr-eng \
        ghostscript \
        fonts-dejavu \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencias de Python (capa cacheable)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Código del backend
COPY backend/ ./backend/

# Frontend ya compilado, traído de la etapa 1 a la ruta que sirve FastAPI
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Carpeta de temporales (se autolimpia en runtime)
RUN mkdir -p backend/temp

EXPOSE 8000

WORKDIR /app/backend

# Arranque del servidor
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
