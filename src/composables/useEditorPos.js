/**
 * Persist editor caret + scroll per novel/chapter.
 * Storage key: editorPos_{novelId}
 */
import { flushStorage } from '../services/storage.js'

function key(novelId) {
  return `editorPos_${novelId}`
}

function readMap(novelId) {
  if (!novelId) return {}
  try {
    const raw = localStorage.getItem(key(novelId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(novelId, map) {
  if (!novelId) return
  try {
    localStorage.setItem(key(novelId), JSON.stringify(map))
    // fire-and-forget flush
    flushStorage().catch(() => {})
  } catch {
    /* ignore */
  }
}

export function loadEditorPos(novelId, chapterId) {
  if (!novelId || !chapterId) return null
  const map = readMap(novelId)
  const pos = map[String(chapterId)]
  if (!pos || typeof pos !== 'object') return null
  return {
    selectionStart: Number(pos.selectionStart) || 0,
    selectionEnd: Number(pos.selectionEnd) || 0,
    scrollTop: Number(pos.scrollTop) || 0
  }
}

export function saveEditorPos(novelId, chapterId, pos) {
  if (!novelId || !chapterId || !pos) return
  const map = readMap(novelId)
  map[String(chapterId)] = {
    selectionStart: Number(pos.selectionStart) || 0,
    selectionEnd: Number(pos.selectionEnd) || 0,
    scrollTop: Number(pos.scrollTop) || 0,
    updatedAt: Date.now()
  }
  // prune to last 80 chapters
  const entries = Object.entries(map).sort(
    (a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0)
  )
  const trimmed = Object.fromEntries(entries.slice(0, 80))
  writeMap(novelId, trimmed)
}

/**
 * Apply saved position to a textarea element (next frames for layout).
 */
export function restoreEditorPos(el, pos) {
  if (!el || !pos) return
  const len = el.value?.length ?? 0
  const start = Math.min(Math.max(0, pos.selectionStart || 0), len)
  const end = Math.min(Math.max(start, pos.selectionEnd || start), len)
  const apply = () => {
    try {
      el.focus({ preventScroll: true })
      el.setSelectionRange(start, end)
      el.scrollTop = pos.scrollTop || 0
    } catch {
      /* ignore */
    }
  }
  requestAnimationFrame(() => {
    apply()
    requestAnimationFrame(apply)
  })
}

export function readPosFromEditor(el) {
  if (!el) return null
  return {
    selectionStart: el.selectionStart ?? 0,
    selectionEnd: el.selectionEnd ?? 0,
    scrollTop: el.scrollTop || 0
  }
}
