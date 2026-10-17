/**
 * Textarea find / replace helpers (no external deps).
 */

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find next match index in text from `from` (inclusive).
 * @returns {{ start: number, end: number } | null}
 */
export function findNext(text, query, from = 0, { caseSensitive = false } = {}) {
  const src = String(text || '')
  const q = String(query || '')
  if (!q) return null
  if (caseSensitive) {
    const i = src.indexOf(q, Math.max(0, from))
    return i < 0 ? null : { start: i, end: i + q.length }
  }
  const lower = src.toLowerCase()
  const ql = q.toLowerCase()
  const i = lower.indexOf(ql, Math.max(0, from))
  return i < 0 ? null : { start: i, end: i + q.length }
}

/**
 * Find previous match ending before `from`.
 */
export function findPrev(text, query, from = 0, { caseSensitive = false } = {}) {
  const src = String(text || '')
  const q = String(query || '')
  if (!q) return null
  const endLimit = Math.max(0, from)
  if (caseSensitive) {
    const i = src.lastIndexOf(q, Math.max(0, endLimit - 1))
    return i < 0 ? null : { start: i, end: i + q.length }
  }
  const lower = src.toLowerCase()
  const ql = q.toLowerCase()
  const i = lower.lastIndexOf(ql, Math.max(0, endLimit - 1))
  return i < 0 ? null : { start: i, end: i + q.length }
}

/** Count non-overlapping matches. */
export function countMatches(text, query, { caseSensitive = false } = {}) {
  const src = String(text || '')
  const q = String(query || '')
  if (!q) return 0
  let count = 0
  let from = 0
  while (from <= src.length) {
    const m = findNext(src, q, from, { caseSensitive })
    if (!m) break
    count++
    from = m.end
    if (m.end === m.start) from++ // safety
  }
  return count
}

/**
 * Replace all occurrences. Returns { text, count }.
 */
export function replaceAll(text, query, replacement, { caseSensitive = false } = {}) {
  const src = String(text || '')
  const q = String(query || '')
  if (!q) return { text: src, count: 0 }
  if (caseSensitive) {
    if (!src.includes(q)) return { text: src, count: 0 }
    const parts = src.split(q)
    return { text: parts.join(replacement), count: parts.length - 1 }
  }
  const re = new RegExp(escapeRegExp(q), 'gi')
  let count = 0
  const out = src.replace(re, () => {
    count++
    return replacement
  })
  return { text: out, count }
}

/**
 * Replace first match at/after `from`. Returns { text, start, end, count } or null if none.
 */
export function replaceOne(text, query, replacement, from = 0, opts = {}) {
  const m = findNext(text, query, from, opts)
  if (!m) return null
  const src = String(text || '')
  const next =
    src.slice(0, m.start) + String(replacement ?? '') + src.slice(m.end)
  const end = m.start + String(replacement ?? '').length
  return { text: next, start: m.start, end, count: 1 }
}
