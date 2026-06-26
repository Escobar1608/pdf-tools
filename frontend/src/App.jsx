import { useState } from 'react'
import Home from './components/Home.jsx'
import MergeTool from './components/MergeTool.jsx'
import PageEditor from './components/PageEditor.jsx'
import SingleFileTool from './components/SingleFileTool.jsx'

const stem = (name) => name.replace(/\.[^.]+$/, '')

const TOOLS = {
  merge: { title: 'Unir PDF', element: <MergeTool /> },
  organize: {
    title: 'Organizar PDF',
    element: <PageEditor key="organize" canReorder canDelete canRotate />,
  },
  rotate: { title: 'Rotar PDF', element: <PageEditor key="rotate" canRotate /> },

  compress: {
    title: 'Comprimir PDF',
    element: (
      <SingleFileTool
        key="compress"
        endpoint="/api/compress"
        buttonLabel="Comprimir y descargar"
        outName={(n) => `${stem(n)}_comprimido.pdf`}
        showCompression
        fields={[
          {
            name: 'level', label: 'Nivel de compresión', type: 'select', default: 'media',
            options: [
              { value: 'baja', label: 'Baja — solo optimizar, sin pérdida' },
              { value: 'media', label: 'Media — recomendado' },
              { value: 'alta', label: 'Alta — máxima reducción' },
            ],
          },
        ]}
      />
    ),
  },
  convert: {
    title: 'Office a PDF',
    element: (
      <SingleFileTool
        key="convert"
        endpoint="/api/convert"
        accept={['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.txt']}
        dropLabel="Arrastra tu Word, Excel o PowerPoint aquí"
        buttonLabel="Convertir a PDF"
        outName={(n) => `${stem(n)}.pdf`}
      />
    ),
  },
  ocr: {
    title: 'OCR — Reconocimiento de texto',
    element: (
      <SingleFileTool
        key="ocr"
        endpoint="/api/ocr"
        dropLabel="Arrastra tu PDF escaneado aquí"
        buttonLabel="Aplicar OCR y descargar"
        outName={(n) => `${stem(n)}_ocr.pdf`}
        fields={[
          {
            name: 'lang', label: 'Idioma del documento', type: 'select', default: 'spa',
            options: [
              { value: 'spa', label: 'Español' },
              { value: 'eng', label: 'Inglés' },
              { value: 'spa+eng', label: 'Español + Inglés' },
            ],
          },
        ]}
      />
    ),
  },
  protect: {
    title: 'Proteger PDF',
    element: (
      <SingleFileTool
        key="protect"
        endpoint="/api/protect"
        buttonLabel="Proteger y descargar"
        outName={(n) => `${stem(n)}_protegido.pdf`}
        fields={[
          {
            name: 'password', label: 'Contraseña (mín. 4 caracteres)', type: 'password',
            placeholder: 'Escribe la contraseña', required: true,
          },
        ]}
      />
    ),
  },
  unlock: {
    title: 'Desbloquear PDF',
    element: (
      <SingleFileTool
        key="unlock"
        endpoint="/api/unlock"
        buttonLabel="Quitar contraseña y descargar"
        outName={(n) => `${stem(n)}_desbloqueado.pdf`}
        fields={[
          {
            name: 'password', label: 'Contraseña actual del PDF', type: 'password',
            placeholder: 'Escribe la contraseña', required: true,
          },
        ]}
      />
    ),
  },
  watermark: {
    title: 'Marca de agua',
    element: (
      <SingleFileTool
        key="watermark"
        endpoint="/api/watermark"
        buttonLabel="Aplicar marca de agua"
        outName={(n) => `${stem(n)}_marca.pdf`}
        fields={[
          {
            name: 'text', label: 'Texto de la marca', type: 'text',
            placeholder: 'Ej. CONFIDENCIAL', required: true, maxLength: 80,
          },
          {
            name: 'opacity', label: 'Intensidad', type: 'select', default: '0.15',
            options: [
              { value: '0.08', label: 'Muy sutil' },
              { value: '0.15', label: 'Sutil' },
              { value: '0.3', label: 'Media' },
              { value: '0.45', label: 'Fuerte' },
            ],
          },
        ]}
      />
    ),
  },
  pagenumbers: {
    title: 'Números de página',
    element: (
      <SingleFileTool
        key="pagenumbers"
        endpoint="/api/pagenumbers"
        buttonLabel="Numerar y descargar"
        outName={(n) => `${stem(n)}_numerado.pdf`}
        fields={[
          {
            name: 'position', label: 'Posición', type: 'select', default: 'abajo-centro',
            options: [
              { value: 'abajo-centro', label: 'Abajo — centro' },
              { value: 'abajo-derecha', label: 'Abajo — derecha' },
              { value: 'abajo-izquierda', label: 'Abajo — izquierda' },
              { value: 'arriba-centro', label: 'Arriba — centro' },
              { value: 'arriba-derecha', label: 'Arriba — derecha' },
              { value: 'arriba-izquierda', label: 'Arriba — izquierda' },
            ],
          },
          {
            name: 'fmt', label: 'Formato', type: 'select', default: 'simple',
            options: [
              { value: 'simple', label: '1, 2, 3…' },
              { value: 'de_total', label: '1 de N' },
            ],
          },
        ]}
      />
    ),
  },
}

export default function App() {
  const [view, setView] = useState('home')

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="topbar-badge">PDF</span>
          <button className="topbar-title" onClick={() => setView('home')}>
            PDF Tools
          </button>
          <span className="topbar-sub">Herramientas locales &middot; Red interna</span>
        </div>
      </header>

      <main className="container">
        {view === 'home' && <Home onSelect={setView} />}

        {view !== 'home' && (
          <>
            <button className="back-link" onClick={() => setView('home')}>
              &larr; Todas las herramientas
            </button>
            <p className="eyebrow">Herramienta</p>
            <h1 className="page-title">{TOOLS[view].title}</h1>
            {TOOLS[view].element}
          </>
        )}
      </main>
    </>
  )
}
