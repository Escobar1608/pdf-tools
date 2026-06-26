import { useState } from 'react'
import DropZone from './DropZone.jsx'
import { processFile, downloadBlob } from '../api.js'

function formatSize(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Herramienta genérica: 1 archivo de entrada + campos opcionales -> PDF descargable.
 *
 * Props:
 *  - endpoint:   ruta del API, ej. '/api/compress'
 *  - accept:     extensiones admitidas, ej. ['.pdf']
 *  - dropLabel:  texto del dropzone
 *  - fields:     [{name, label, type: 'select'|'text'|'password', options, default, placeholder, required}]
 *  - buttonLabel
 *  - outName:    (nombreOriginal) => nombre de descarga
 *  - showCompression: muestra "de X a Y" leyendo cabeceras X-Original-Size / X-Final-Size
 *  - useServerFilename: usa el nombre que envía el servidor (Content-Disposition)
 *      en vez de outName; útil cuando la extensión depende del resultado (PDF o ZIP).
 */
export default function SingleFileTool({
  endpoint,
  accept = ['.pdf'],
  dropLabel,
  fields = [],
  buttonLabel = 'Procesar y descargar',
  outName,
  showCompression = false,
  useServerFilename = false,
}) {
  const [file, setFile] = useState(null)
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.default ?? '']))
  )
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  const missingRequired = fields.some(
    (f) => f.required && !String(values[f.name] || '').trim()
  )

  async function handleSubmit() {
    setBusy(true)
    setStatus(null)
    try {
      const { blob, headers, filename } = await processFile(endpoint, file, values)
      const downloadName = useServerFilename && filename ? filename : outName(file.name)
      downloadBlob(blob, downloadName)
      if (showCompression) {
        const orig = Number(headers.get('X-Original-Size'))
        const fin = Number(headers.get('X-Final-Size'))
        if (orig && fin) {
          const pct = Math.max(0, Math.round((1 - fin / orig) * 100))
          setStatus({
            type: 'ok',
            text: `Listo: de ${formatSize(orig)} a ${formatSize(fin)} (−${pct}%).`,
          })
        } else {
          setStatus({ type: 'ok', text: 'Archivo procesado y descargado.' })
        }
      } else {
        setStatus({ type: 'ok', text: 'Archivo procesado y descargado.' })
      }
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (!file) {
    return (
      <>
        <DropZone
          accept={accept}
          label={dropLabel}
          onFiles={(files) => {
            setFile(files[0])
            setStatus(null)
          }}
        />
        {status && (
          <div className="action-bar">
            <span className={`status-msg ${status.type}`}>{status.text}</span>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="file-row">
        <span className="file-order">1</span>
        <span className="file-name">{file.name}</span>
        <span className="file-size">{formatSize(file.size)}</span>
        <button
          className="icon-btn"
          aria-label="Quitar archivo"
          onClick={() => {
            setFile(null)
            setStatus(null)
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {fields.length > 0 && (
        <div className="form-grid">
          {fields.map((f) => (
            <label key={f.name} className="form-field">
              <span className="form-label">{f.label}</span>
              {f.type === 'select' ? (
                <select
                  className="form-input"
                  value={values[f.name]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  type={f.type}
                  placeholder={f.placeholder || ''}
                  value={values[f.name]}
                  maxLength={f.maxLength}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.name]: e.target.value }))
                  }
                />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="action-bar">
        <button
          className="btn-primary"
          disabled={busy || missingRequired}
          onClick={handleSubmit}
        >
          {busy ? 'Procesando…' : buttonLabel}
        </button>
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={() => {
            setFile(null)
            setStatus(null)
          }}
        >
          Otro archivo
        </button>
        {busy && <span className="spinner" aria-hidden="true" />}
        {missingRequired && (
          <span className="status-msg">Completa los campos obligatorios.</span>
        )}
        {status && (
          <span className={`status-msg ${status.type}`}>{status.text}</span>
        )}
      </div>
    </>
  )
}
