# PDF Tools — Herramientas PDF locales

Aplicación web local tipo iLovePDF para uso en red interna. Los archivos se
procesan en el servidor donde corre la app y **nunca salen de tu red**.

**Stack:** FastAPI (Python) · React + Vite · pypdf · PyMuPDF · pikepdf · ocrmypdf

> Pensada para entornos offline / red interna: sin CDNs externos, sin enviar
> archivos a la nube. Todo el procesamiento ocurre en el equipo que sirve la app.


Herramientas incluidas:

| Herramienta | Qué hace | Requiere extra |
|---|---|---|
| **Unir PDF** | Combina varios PDFs en uno, reordenándolos por arrastre | — |
| **Organizar PDF** | Reordena, rota y elimina páginas con miniaturas visuales | — |
| **Rotar PDF** | Rota páginas individuales o todas a la vez | — |
| **Comprimir PDF** | Reduce el tamaño (3 niveles, recomprime imágenes) | — |
| **Office a PDF** | Convierte Word, Excel, PowerPoint a PDF | LibreOffice |
| **OCR** | Hace buscable el texto de PDFs escaneados (esp/ing) | Tesseract + Ghostscript |
| **Proteger PDF** | Cifra con contraseña AES-256 | — |
| **Desbloquear PDF** | Quita la contraseña (conociéndola) | — |
| **Marca de agua** | Texto diagonal en todas las páginas | — |
| **Números de página** | Numeración en 6 posiciones, formato `1` o `1 de N` | — |

Las herramientas que requieren programas extra se **deshabilitan solas** en la
interfaz si el programa no está instalado en el servidor; el resto funciona
normal. Puedes instalarlos después en cualquier momento.

---

## Requisitos

- Windows con **Python 3.10 o superior** ([python.org](https://www.python.org/downloads/)).
  Al instalarlo, marca la casilla **"Add python.exe to PATH"**.
- **No necesitas Node.js**: el frontend React ya viene compilado en `frontend/dist`.

## Instalación (una sola vez)

1. Descomprime esta carpeta donde quieras, por ejemplo `C:\PDFTools\`
2. Doble clic en **`instalar.bat`**
   (crea un entorno virtual de Python e instala las dependencias)

## Uso

1. Doble clic en **`ejecutar.bat`**
2. Abre el navegador en `http://localhost:8000`
3. La ventana negra muestra también la URL para la red interna,
   por ejemplo `http://192.168.1.50:8000` — esa es la que compartes
   con el resto del equipo.

> Mientras la ventana de `ejecutar.bat` esté abierta, el servidor está activo.
> Ciérrala (o Ctrl+C) para detenerlo.

## Permitir acceso desde la red interna (firewall)

Windows bloqueará las conexiones entrantes por defecto. Abre **PowerShell
como administrador** y ejecuta:

```
netsh advfirewall firewall add rule name="PDF Tools" dir=in action=allow protocol=TCP localport=8000
```

Para eliminar la regla más adelante:

```
netsh advfirewall firewall delete rule name="PDF Tools"
```

## Programas opcionales (Office a PDF y OCR)

Solo si quieres habilitar esas dos herramientas. Instálalos en el servidor
donde corre la app y reinicia `ejecutar.bat`:

**Office a PDF — LibreOffice**
1. Descargar de https://www.libreoffice.org/download/ e instalar con opciones
   por defecto (la app lo busca en `C:\Program Files\LibreOffice\`).

**OCR — Tesseract + Ghostscript**
1. Tesseract (instalador Windows de UB Mannheim):
   https://github.com/UB-Mannheim/tesseract/wiki
   Durante la instalación, en *Additional language data*, marca **Spanish**.
2. Ghostscript: https://ghostscript.com/releases/gsdnld.html (versión AGPL, 64 bits)
3. Verifica que ambos queden en el PATH: abre una consola nueva y prueba
   `tesseract --version` y `gswin64c --version`. Si no responden, añade sus
   carpetas `bin` al PATH del sistema y reinicia el servidor.

La página principal muestra esas tarjetas deshabilitadas con un aviso mientras
falten los programas; al instalarlos y reiniciar el servidor se activan solas.

## Inicio automático con Windows (opcional)

Puedes crear una tarea programada:

1. Abrir **Programador de tareas** → *Crear tarea básica*
2. Desencadenador: **Al iniciar sesión** (o *Al iniciar el equipo*)
3. Acción: *Iniciar un programa* → ruta de `ejecutar.bat`
4. En propiedades de la tarea, marcar *Ejecutar con privilegios más altos* no es necesario

## Estructura del proyecto

```
PDFTools\
├── backend\
│   ├── main.py            # Servidor FastAPI (API + frontend estático)
│   ├── pdf_ops.py         # Lógica PDF (pypdf + PyMuPDF)
│   ├── requirements.txt
│   ├── venv\              # Se crea con instalar.bat
│   └── temp\              # Archivos temporales (se autolimpian a los 30 min)
├── frontend\
│   ├── dist\              # React compilado (lo que sirve el servidor)
│   └── src\               # Código fuente React (por si quieres modificarlo)
├── instalar.bat
├── ejecutar.bat
└── README.md
```

## Modificar el frontend (opcional)

Solo si quieres cambiar la interfaz. Requiere Node.js 18+:

```
cd frontend
npm install
npm run build
```

El resultado queda en `frontend/dist` y el servidor lo toma automáticamente
al reiniciar.

## Notas técnicas

- Límite de subida: **200 MB por archivo** (ajustable en `main.py`, constante `MAX_UPLOAD_MB`).
- Las sesiones de edición expiran a los **30 minutos** de inactividad; los
  temporales se borran solos.
- El servidor escucha en `0.0.0.0:8000`. Para cambiar el puerto, edita
  `ejecutar.bat` y la regla del firewall.
- No hay autenticación: cualquier equipo de la red interna con acceso al
  puerto puede usar la herramienta.
- PDFs protegidos con contraseña no son compatibles en esta fase.
