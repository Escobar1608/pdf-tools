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
import { mergePdfs, downloadBlob } from '../api.js'

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

export default function MergeTool() {
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
      const blob = await mergePdfs(items.map((i) => i.file))
      downloadBlob(blob, 'unido.pdf')
      setStatus({ type: 'ok', text: 'PDF unido y descargado.' })
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
        onFiles={addFiles}
        hint="o haz clic para seleccionar &middot; puedes añadir más después"
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
              disabled={busy || items.length < 2}
              onClick={handleMerge}
            >
              {busy ? 'Uniendo…' : `Unir ${items.length} PDFs`}
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
            {items.length < 2 && (
              <span className="status-msg">Añade al menos 2 archivos.</span>
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
