import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DropZone from './DropZone.jsx'
import { uploadFiles, downloadBlob } from '../api.js'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileRow({ item, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      className={`file-row ${isDragging ? 'dragging-row' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="drag-handle"
        aria-label={`Mover ${item.file.name}`}
        {...attributes}
        {...listeners}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
      <span className="file-order">{index + 1}</span>
      <span className="file-name">{item.file.name}</span>
      <span className="file-size">{formatSize(item.file.size)}</span>
      <button
        className="icon-btn"
        aria-label={`Quitar ${item.file.name}`}
        onClick={() => onRemove(item.id)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

let nextId = 1

/**
 * Sube varios archivos ordenables (arrastrando) a un endpoint y descarga 1 resultado.
 * Por defecto se comporta como "Unir PDF"; con props sirve para "Imágenes a PDF".
 */
export default function MergeTool({
  endpoint = '/api/merge',
  accept = ['.pdf'],
  outName = 'unido.pdf',
  minFiles = 2,
  dropLabel,
  dropHint = 'o haz clic para seleccionar · puedes añadir más después',
  actionVerb = 'Unir',
  busyLabel = 'Uniendo…',
  itemNoun = 'PDFs',
  okText = 'PDF unido y descargado.',
}) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null) // {type, text}

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function addFiles(files) {
    setStatus(null)
    setItems((prev) => [
      ...prev,
      ...files.map((file) => ({ id: nextId++, file })),
    ])
  }

  function handleDragEnd({ active, over }) {
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const from = prev.findIndex((i) => i.id === active.id)
        const to = prev.findIndex((i) => i.id === over.id)
        return arrayMove(prev, from, to)
      })
    }
  }

  async function handleMerge() {
    setBusy(true)
    setStatus(null)
    try {
      const blob = await uploadFiles(endpoint, items.map((i) => i.file))
      downloadBlob(blob, outName)
      setStatus({ type: 'ok', text: okText })
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropZone
        multiple
        accept={accept}
        label={dropLabel}
        onFiles={addFiles}
        hint={dropHint}
      />

      {items.length > 0 && (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="file-list">
                {items.map((item, index) => (
                  <FileRow
                    key={item.id}
                    item={item}
                    index={index}
                    onRemove={(id) =>
                      setItems((prev) => prev.filter((i) => i.id !== id))
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="action-bar">
            <button
              className="btn-primary"
              disabled={busy || items.length < minFiles}
              onClick={handleMerge}
            >
              {busy ? busyLabel : `${actionVerb} ${items.length} ${itemNoun}`}
            </button>
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setItems([])
                setStatus(null)
              }}
            >
              Vaciar lista
            </button>
            {busy && <span className="spinner" aria-hidden="true" />}
            {items.length < minFiles && (
              <span className="status-msg">Añade al menos {minFiles} archivo{minFiles > 1 ? 's' : ''}.</span>
            )}
            {status && (
              <span className={`status-msg ${status.type}`}>{status.text}</span>
            )}
          </div>
        </>
      )}
    </>
  )
}
