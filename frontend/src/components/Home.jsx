import { useEffect, useState } from 'react'
import { getCapabilities } from '../api.js'

const Icon = ({ children }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const ICONS = {
  merge: <Icon><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" /><path d="M12 8v8M8 12h8" /></Icon>,
  organize: <Icon><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M17.5 14v7M14 17.5h7" /></Icon>,
  rotate: <Icon><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></Icon>,
  compress: <Icon><path d="M8 3v4a1 1 0 0 1-1 1H3" /><path d="M16 3v4a1 1 0 0 0 1 1h4" /><path d="M8 21v-4a1 1 0 0 0-1-1H3" /><path d="M16 21v-4a1 1 0 0 1 1-1h4" /></Icon>,
  convert: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 14l3 3 3-3M12 17v-6" /></Icon>,
  ocr: <Icon><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 12h8" /></Icon>,
  protect: <Icon><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Icon>,
  unlock: <Icon><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.7-1.5" /></Icon>,
  watermark: <Icon><path d="M12 3c3 4.5 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 3-6.5 6-11z" /></Icon>,
  pagenumbers: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M11 17h3M11 17v-4l-1 1" /></Icon>,
}

const SECTIONS = [
  {
    title: 'Organizar',
    tools: [
      { id: 'merge', name: 'Unir PDF', desc: 'Combina varios PDFs en uno solo, en el orden que elijas.' },
      { id: 'organize', name: 'Organizar PDF', desc: 'Reordena, rota o elimina páginas arrastrando las miniaturas.' },
      { id: 'rotate', name: 'Rotar PDF', desc: 'Gira páginas individuales o el documento completo.' },
    ],
  },
  {
    title: 'Optimizar y convertir',
    tools: [
      { id: 'compress', name: 'Comprimir PDF', desc: 'Reduce el tamaño del archivo con tres niveles de compresión.' },
      { id: 'convert', name: 'Office a PDF', desc: 'Convierte Word, Excel y PowerPoint a PDF.', requires: 'convert', reqLabel: 'Requiere LibreOffice en el servidor' },
      { id: 'ocr', name: 'OCR', desc: 'Hace buscable el texto de PDFs escaneados.', requires: 'ocr', reqLabel: 'Requiere Tesseract y Ghostscript en el servidor' },
    ],
  },
  {
    title: 'Seguridad',
    tools: [
      { id: 'protect', name: 'Proteger PDF', desc: 'Cifra el documento con contraseña (AES-256).' },
      { id: 'unlock', name: 'Desbloquear PDF', desc: 'Quita la contraseña de un PDF (necesitas conocerla).' },
    ],
  },
  {
    title: 'Editar',
    tools: [
      { id: 'watermark', name: 'Marca de agua', desc: 'Añade un texto diagonal en todas las páginas.' },
      { id: 'pagenumbers', name: 'Números de página', desc: 'Numera el documento en la posición que elijas.' },
    ],
  },
]

export default function Home({ onSelect }) {
  const [caps, setCaps] = useState(null)

  useEffect(() => {
    getCapabilities().then(setCaps)
  }, [])

  return (
    <>
      <p className="eyebrow">Procesamiento 100% local &middot; Tus archivos no salen de la red</p>
      <h1 className="page-title">¿Qué necesitas hacer con tu PDF?</h1>

      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="section-title">{section.title}</p>
          <div className="tool-grid">
            {section.tools.map((tool) => {
              const unavailable = tool.requires && caps && !caps[tool.requires]
              return (
                <button
                  key={tool.id}
                  className={`tool-card ${unavailable ? 'disabled' : ''}`}
                  disabled={unavailable}
                  onClick={() => onSelect(tool.id)}
                >
                  <div className="tool-icon">{ICONS[tool.id]}</div>
                  <h2 className="tool-name">{tool.name}</h2>
                  <p className="tool-desc">{tool.desc}</p>
                  {unavailable && <span className="tool-req">{tool.reqLabel}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
