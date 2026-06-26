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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DropZone from './DropZone.jsx'
import { uploadPdf, thumbUrl, applyChanges, downloadBlob } from '../api.js'

function PageCell({ item, sessionId, canReorder, canDelete, canRotate, onRotate, onDelete, deletable }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !canReorder })

  return (
    <div
      ref={setNodeRef}
      className={`page-cell ${isDragging ? 'dragging-cell' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {item.rotation !== 0 && (
        <span className="rotation-tag">{item.rotation}&deg;</span>
      )}
      <div
        className={`page-thumb-wrap ${canReorder ? '' : 'no-drag'}`}
        {...(canReorder ? { ...attributes, ...listeners } : {})}
      >
        <img
          className="page-thumb"
          src={thumbUrl(sessionId, item.page)}
          alt={`Página ${item.page + 1}`}
          loading="lazy"
          draggable={false}
          style={{ transform: `rotate(${item.rotation}deg)` }}
        />
      </div>
      <div className="page-cell-bar">
        <span className="page-num">PÁG. {item.page + 1}</span>
        <div className="page-actions">
          {canRotate && (
            <button
              className="page-btn"
              aria-label={`Rotar página ${item.page + 1}`}
              title="Rotar 90°"
              onClick={() => onRotate(item.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          )}
          {canDelete && (
            <button
              className="page-btn danger"
              aria-label={`Eliminar página ${item.page + 1}`}
              title="Eliminar página"
              disabled={!deletable}
              onClick={() => onDelete(item.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PageEditor({ canReorder = false, canDelete = false, canRotate = false }) {
  const [session, setSession] = useState(null) // {session_id, filename}
  const [items, setItems] = useState([]) // [{id, page, rotation}]
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleUpload(files) {
    setLoading(true)
    setStatus(null)
    try {
      const data = await uploadPdf(files[0])
      setSession(data)
      setItems(
        Array.from({ length: data.pages }, (_, i) => ({
          id: i + 1,
          page: i,
          rotation: 0,
        }))
      )
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  function rotateOne(id) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, rotation: (it.rotation + 90) % 360 } : it
      )
    )
  }

  function rotateAll() {
    setItems((prev) =>
      prev.map((it) => ({ ...it, rotation: (it.rotation + 90) % 360 }))
    )
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

  async function handleApply() {
    setBusy(true)
    setStatus(null)
    try {
      const blob = await applyChanges(
        session.session_id,
        items.map(({ page, rotation }) => ({ page, rotation }))
      )
      const base = session.filename.replace(/\.pdf$/i, '')
      downloadBlob(blob, `${base}_editado.pdf`)
      setStatus({ type: 'ok', text: 'PDF generado y descargado.' })
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setSession(null)
    setItems([])
    setStatus(null)
  }

  const hasChanges =
    items.some((it, idx) => it.rotation !== 0 || it.page !== idx) ||
    (session && items.length !== session.pages)

  if (!session) {
    return (
      <>
        <DropZone onFiles={handleUpload} />
        <div className="action-bar">
          {loading && (
            <>
              <span className="spinner" aria-hidden="true" />
              <span className="status-msg">Leyendo PDF…</span>
            </>
          )}
          {status && (
            <span className={`status-msg ${status.type}`}>{status.text}</span>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="editor-head">
        <span className="editor-filename">{session.filename}</span>
        <span className="editor-count">
          {items.length} de {session.pages} páginas
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={rectSortingStrategy}
        >
          <div className="page-grid">
            {items.map((item) => (
              <PageCell
                key={item.id}
                item={item}
                sessionId={session.session_id}
                canReorder={canReorder}
                canDelete={canDelete}
                canRotate={canRotate}
                deletable={items.length > 1}
                onRotate={rotateOne}
                onDelete={(id) =>
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
          disabled={busy || !hasChanges}
          onClick={handleApply}
        >
          {busy ? 'Procesando…' : 'Aplicar cambios y descargar'}
        </button>
        {canRotate && (
          <button className="btn-secondary" disabled={busy} onClick={rotateAll}>
            Rotar todas 90&deg;
          </button>
        )}
        <button className="btn-secondary" disabled={busy} onClick={reset}>
          Otro archivo
        </button>
        {busy && <span className="spinner" aria-hidden="true" />}
        {!hasChanges && !status && (
          <span className="status-msg">
            {canReorder
              ? 'Arrastra las miniaturas para reordenar, o usa los botones de cada página.'
              : 'Usa el botón de rotación en cada página, o rota todas a la vez.'}
          </span>
        )}
        {status && (
          <span className={`status-msg ${status.type}`}>{status.text}</span>
        )}
      </div>
    </>
  )
}
