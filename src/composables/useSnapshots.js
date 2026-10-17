/**
 * Chapter content snapshots — key snapshots_{novelId}
 */
import { ref } from 'vue'
import { flushStorage } from '../services/storage.js'

function uid() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function useSnapshots(novelIdRef) {
  const list = ref([])

  function key() {
    const id = typeof novelIdRef === 'object' ? novelIdRef.value : novelIdRef
    return `snapshots_${id}`
  }

  function load() {
    try {
      const raw = localStorage.getItem(key())
      list.value = raw ? JSON.parse(raw) : []
      if (!Array.isArray(list.value)) list.value = []
    } catch {
      list.value = []
    }
  }

  async function save() {
    // keep last 30
    if (list.value.length > 30) list.value = list.value.slice(0, 30)
    localStorage.setItem(key(), JSON.stringify(list.value))
    await flushStorage()
  }

  async function addSnapshot({ chapterId, chapterTitle, content, note = '' }) {
    load()
    const item = {
      id: uid(),
      chapterId,
      chapterTitle: chapterTitle || '',
      content: content || '',
      note: note || '',
      wordCount: String(content || '').replace(/\s/g, '').length,
      createdAt: new Date().toISOString()
    }
    list.value.unshift(item)
    await save()
    return item
  }

  async function removeSnapshot(id) {
    load()
    list.value = list.value.filter((s) => String(s.id) !== String(id))
    await save()
  }

  function forChapter(chapterId) {
    return list.value.filter((s) => String(s.chapterId) === String(chapterId))
  }

  return { list, load, addSnapshot, removeSnapshot, forChapter }
}

/** Parse markdown-ish outline (### titles) into chapter stubs */
export function parseOutlineToChapters(text) {
  if (!text || !String(text).trim()) return []
  const lines = String(text).split(/\r?\n/)
  const chapters = []
  let cur = null
  for (const line of lines) {
    const m = line.match(/^#{2,4}\s+(.+)/) || line.match(/^第.+[章节回]\s*(.*)/)
    if (m) {
      if (cur) chapters.push(cur)
      cur = {
        title: (m[1] || m[0] || '新章节').trim().replace(/^#+\s*/, ''),
        content: ''
      }
    } else if (cur) {
      cur.content += (cur.content ? '\n' : '') + line
    }
  }
  if (cur) chapters.push(cur)
  // fallback: split by blank lines if no headings
  if (!chapters.length) {
    const blocks = String(text)
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean)
    return blocks.slice(0, 20).map((b, i) => ({
      title: `第${i + 1}章`,
      content: b
    }))
  }
  return chapters.map((c) => ({
    title: c.title,
    content: (c.content || '').trim()
  }))
}
