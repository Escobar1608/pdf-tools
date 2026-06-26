import { useRef, useState } from 'react'

const DEFAULT_EXTS = ['.pdf']

export default function DropZone({ multiple = false, onFiles, hint, accept = DEFAULT_EXTS, label }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function handleFiles(fileList) {
    const valid = Array.from(fileList).filter((f) =>
      accept.some((ext) => f.name.toLowerCase().endsWith(ext))
    )
    if (valid.length) onFiles(valid)
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <div className="dropzone-icon">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6M9 15l3-3 3 3" />
        </svg>
      </div>
      <p className="dropzone-text">
        {label || (multiple ? 'Arrastra tus PDFs aquí' : 'Arrastra tu PDF aquí')}
      </p>
      <p className="dropzone-hint">{hint || 'o haz clic para seleccionar'}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        multiple={multiple}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
