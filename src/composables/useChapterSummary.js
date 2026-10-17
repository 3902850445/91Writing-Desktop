/**
 * Cached AI chapter summaries — key chapterSummary_{novelId}
 * { [chapterId]: { text, updatedAt, sourceHash } }
 */
import { ref } from 'vue'
import { flushStorage } from '../services/storage.js'

function storeKey(novelId) {
  return `chapterSummary_${novelId}`
}

/** Cheap content fingerprint (length + head/tail). */
export function contentHash(text) {
  const s = String(text || '')
  const n = s.length
  const head = s.slice(0, 40)
  const tail = s.slice(-40)
  let h = n
  for (let i = 0; i < head.length; i++) h = (h * 31 + head.charCodeAt(i)) >>> 0
  for (let i = 0; i < tail.length; i++) h = (h * 37 + tail.charCodeAt(i)) >>> 0
  return `${n}_${h.toString(16)}`
}

export function useChapterSummary(novelIdRef) {
  const map = ref({})

  function nid() {
    return typeof novelIdRef === 'object' ? novelIdRef.value : novelIdRef
  }

  function load() {
    try {
      const raw = localStorage.getItem(storeKey(nid()))
      map.value = raw ? JSON.parse(raw) : {}
      if (!map.value || typeof map.value !== 'object') map.value = {}
    } catch {
      map.value = {}
    }
  }

  async function persist() {
    localStorage.setItem(storeKey(nid()), JSON.stringify(map.value))
    await flushStorage()
  }

  function get(chapterId) {
    return map.value[String(chapterId)] || null
  }

  function isFresh(chapterId, content) {
    const row = get(chapterId)
    if (!row?.text) return false
    return row.sourceHash === contentHash(content)
  }

  async function set(chapterId, text, content) {
    load()
    map.value = {
      ...map.value,
      [String(chapterId)]: {
        text: String(text || '').trim(),
        updatedAt: new Date().toISOString(),
        sourceHash: contentHash(content)
      }
    }
    await persist()
  }

  async function remove(chapterId) {
    load()
    const next = { ...map.value }
    delete next[String(chapterId)]
    map.value = next
    await persist()
  }

  /** Build prompt for summary generation */
  function buildSummaryPrompt(title, content) {
    const body = String(content || '')
      .replace(/<[^>]*>/g, '')
      .trim()
    const clipped = body.length > 6000 ? body.slice(0, 3000) + '\n…\n' + body.slice(-2500) : body
    return `请用中文为以下小说章节写一段简洁摘要（120～220字）：
1. 概括主要情节与人物行动
2. 点出未解决的冲突或悬念
3. 只输出摘要正文，不要标题或列表

章节标题：${title || '未命名'}

【正文】
${clipped || '（空）'}`
  }

  return {
    map,
    load,
    get,
    isFresh,
    set,
    remove,
    buildSummaryPrompt,
    contentHash
  }
}
