// Llamadas al backend FastAPI (mismo host y puerto que sirve la app)

async function parseError(res) {
  try {
    const data = await res.json()
    return data.detail || 'Error inesperado del servidor'
  } catch {
    return `Error del servidor (${res.status})`
  }
}

// Extrae el filename de la cabecera Content-Disposition (si viene).
function filenameFromHeaders(headers) {
  const cd = headers.get('Content-Disposition') || ''
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd)
  if (star) return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
  const plain = /filename="?([^";]+)"?/i.exec(cd)
  return plain ? plain[1].trim() : null
}

// Sube varios archivos a un endpoint (campo 'files') y devuelve el blob resultante.
export async function uploadFiles(endpoint, files) {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const res = await fetch(endpoint, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  return res.blob()
}

export async function uploadPdf(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export function thumbUrl(sessionId, page) {
  return `/api/thumb/${sessionId}/${page}`
}

export async function applyChanges(sessionId, pages) {
  const form = new FormData()
  form.append('session_id', sessionId)
  form.append('pages', JSON.stringify(pages))
  const res = await fetch('/api/apply', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  return res.blob()
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function processFile(endpoint, file, fields = {}) {
  const form = new FormData()
  form.append('file', file)
  Object.entries(fields).forEach(([k, v]) => form.append(k, v))
  const res = await fetch(endpoint, { method: 'POST', body: form })
  if (!res.ok) throw new Error(await parseError(res))
  const filename = filenameFromHeaders(res.headers)
  return { blob: await res.blob(), headers: res.headers, filename }
}

export async function getCapabilities() {
  try {
    const res = await fetch('/api/capabilities')
    if (!res.ok) return { convert: false, ocr: false }
    return res.json()
  } catch {
    return { convert: false, ocr: false }
  }
}
