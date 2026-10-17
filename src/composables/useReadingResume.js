/**
 * Resume reading/writing position across sessions.
 * Key: writing91_resume
 * { novelId, chapterId, title, chapterTitle, updatedAt }
 */
import { ref, computed } from 'vue'

const KEY = 'writing91_resume'
const resume = ref(null)
let loaded = false

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    resume.value = raw ? JSON.parse(raw) : null
    if (resume.value && typeof resume.value !== 'object') resume.value = null
  } catch {
    resume.value = null
  }
  loaded = true
  return resume.value
}

function save(payload) {
  try {
    if (!payload?.novelId) {
      localStorage.removeItem(KEY)
      resume.value = null
      return
    }
    const next = {
      novelId: String(payload.novelId),
      chapterId: payload.chapterId != null ? String(payload.chapterId) : null,
      title: payload.title || '未命名',
      chapterTitle: payload.chapterTitle || '',
      updatedAt: new Date().toISOString()
    }
    localStorage.setItem(KEY, JSON.stringify(next))
    resume.value = next
  } catch {
    /* ignore quota */
  }
}

export function useReadingResume() {
  if (!loaded) load()

  const hasResume = computed(() => !!(resume.value && resume.value.novelId))

  function touchResume({ novelId, chapterId, title, chapterTitle }) {
    save({ novelId, chapterId, title, chapterTitle })
  }

  function clearResume() {
    save(null)
  }

  function getResume() {
    if (!loaded) load()
    return resume.value
  }

  /** Format relative time for UI */
  function resumeLabel() {
    const r = resume.value
    if (!r?.updatedAt) return ''
    try {
      const t = new Date(r.updatedAt).getTime()
      const diff = Date.now() - t
      if (diff < 60_000) return '刚刚'
      if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
      if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
      return new Date(r.updatedAt).toLocaleDateString('zh-CN')
    } catch {
      return ''
    }
  }

  return {
    resume,
    hasResume,
    load,
    touchResume,
    clearResume,
    getResume,
    resumeLabel
  }
}
