/**
 * Full-novel text search with chunked scan (keeps UI responsive).
 */
import { ref } from 'vue'
import { findNext } from '../utils/textFind.js'

const MAX_HITS_PER_CHAPTER = 8
const MAX_TOTAL_HITS = 80
const SNIPPET_PAD = 28

function snippetAround(text, start, end) {
  const s = Math.max(0, start - SNIPPET_PAD)
  const e = Math.min(text.length, end + SNIPPET_PAD)
  let snip = text.slice(s, e).replace(/\s+/g, ' ')
  if (s > 0) snip = '…' + snip
  if (e < text.length) snip = snip + '…'
  return snip
}

/**
 * @param {Array<{id:any,title?:string,content?:string}>} chapters
 * @param {string} query
 * @param {{ caseSensitive?: boolean, signal?: { cancelled: boolean }, onProgress?: (p:number)=>void }} opts
 */
export async function searchChapters(chapters, query, opts = {}) {
  const q = String(query || '').trim()
  const list = Array.isArray(chapters) ? chapters : []
  if (!q || !list.length) return []

  const caseSensitive = !!opts.caseSensitive
  const hits = []
  const total = list.length

  for (let i = 0; i < list.length; i++) {
    if (opts.signal?.cancelled) break
    const c = list[i]
    const title = String(c?.title || '')
    const content = String(c?.content || '').replace(/<[^>]*>/g, '')
    let chapterHits = 0

    // title match
    const tm = findNext(title, q, 0, { caseSensitive })
    if (tm) {
      hits.push({
        chapterId: c.id,
        chapterIndex: i,
        chapterTitle: title || `第${i + 1}章`,
        start: tm.start,
        end: tm.end,
        inTitle: true,
        snippet: title
      })
      chapterHits++
    }

    let from = 0
    while (chapterHits < MAX_HITS_PER_CHAPTER && hits.length < MAX_TOTAL_HITS) {
      const m = findNext(content, q, from, { caseSensitive })
      if (!m) break
      hits.push({
        chapterId: c.id,
        chapterIndex: i,
        chapterTitle: title || `第${i + 1}章`,
        start: m.start,
        end: m.end,
        inTitle: false,
        snippet: snippetAround(content, m.start, m.end)
      })
      chapterHits++
      from = m.end
      if (m.end === m.start) from++
    }

    if (opts.onProgress) opts.onProgress((i + 1) / total)
    // yield to main thread every few chapters
    if (i % 3 === 2) {
      await new Promise((r) => setTimeout(r, 0))
    }
    if (hits.length >= MAX_TOTAL_HITS) break
  }

  return hits
}

export function useNovelSearch() {
  const results = ref([])
  const searching = ref(false)
  const progress = ref(0)
  let signal = { cancelled: false }

  function cancel() {
    signal.cancelled = true
    searching.value = false
  }

  async function search(chapters, query, opts = {}) {
    cancel()
    signal = { cancelled: false }
    const q = String(query || '').trim()
    if (!q) {
      results.value = []
      return []
    }
    searching.value = true
    progress.value = 0
    try {
      const hits = await searchChapters(chapters, q, {
        caseSensitive: opts.caseSensitive,
        signal,
        onProgress: (p) => {
          progress.value = p
        }
      })
      if (!signal.cancelled) {
        results.value = hits
      }
      return hits
    } finally {
      if (!signal.cancelled) searching.value = false
    }
  }

  function clear() {
    cancel()
    results.value = []
    progress.value = 0
  }

  return { results, searching, progress, search, cancel, clear }
}
