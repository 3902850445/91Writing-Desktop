/**
 * Novel library — same localStorage key (`novels`) as legacy UI so data is shared.
 */
import { ref, computed } from 'vue'
import { flushStorage } from '../services/storage.js'

const novels = ref([])
const loaded = ref(false)

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

function countWords(text) {
  if (!text) return 0
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, '')
    .length
}

function recomputeNovelStats(novel) {
  const list = novel.chapterList || []
  novel.chapters = list.length
  novel.wordCount = list.reduce((s, c) => s + (c.wordCount || countWords(c.content)), 0)
  return novel
}

function normalizeNovel(raw) {
  const n = { ...raw }
  n.id = n.id || uid()
  n.title = n.title || '未命名'
  n.author = n.author || ''
  n.genre = n.genre || 'fantasy'
  n.description = n.description || ''
  n.cover = n.cover || ''
  n.coverPreset = n.coverPreset || ''
  n.tags = Array.isArray(n.tags)
    ? n.tags.map((t) => String(t).trim()).filter(Boolean)
    : []
  n.status = n.status || 'writing'
  n.pinned = !!n.pinned
  n.archived = !!n.archived
  n.volumes = Array.isArray(n.volumes) ? n.volumes : []
  n.chapterList = Array.isArray(n.chapterList)
    ? n.chapterList.map((c) => ({
        id: c.id || uid(),
        title: c.title || '新章节',
        content: c.content || '',
        description: c.description || '',
        wordCount: c.wordCount ?? countWords(c.content),
        /** per-chapter word goal (0 = use global prefs) */
        wordGoal: Math.max(0, Number(c.wordGoal) || 0),
        /** freeform chapter notes */
        notes: c.notes != null ? String(c.notes) : '',
        /** checklist todos: [{ id, text, done }] */
        todos: Array.isArray(c.todos)
          ? c.todos
              .map((t) => ({
                id: t?.id || uid(),
                text: String(t?.text || '').trim(),
                done: !!t?.done
              }))
              .filter((t) => t.text)
          : [],
        volumeId: c.volumeId || null,
        createdAt: c.createdAt || new Date().toISOString(),
        updatedAt: c.updatedAt || new Date().toISOString()
      }))
    : []
  n.writingRecords = Array.isArray(n.writingRecords) ? n.writingRecords : []
  n.createdAt = n.createdAt || new Date().toISOString()
  n.updatedAt = n.updatedAt || n.createdAt
  return recomputeNovelStats(n)
}

function parseNovelsRaw(raw) {
  if (!raw) return null
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('novels is not an array')
  return parsed.map(normalizeNovel)
}


function purgeNovelSatelliteKeys(id) {
  if (id == null) return
  const prefixes = [
    'characters_',
    'worldview_',
    'worldSettings_',
    'corpus_',
    'events_',
    'snapshots_',
    'focusDraft_',
    'editorPos_',
    'chapterSummary_',
    'chat_',
    'volumes_'
  ]
  const sid = String(id)
  for (const p of prefixes) {
    try {
      localStorage.removeItem(p + sid)
    } catch {
      /* ignore */
    }
  }
}

export function useNovels() {
  async function load() {
    try {
      const raw = localStorage.getItem('novels')
      novels.value = parseNovelsRaw(raw) || []
    } catch (e) {
      console.error('load novels failed, try backup', e)
      try {
        const bak = localStorage.getItem('novels_prev')
        novels.value = parseNovelsRaw(bak) || []
        if (novels.value.length) {
          // restore primary from backup
          localStorage.setItem('novels', bak)
          await flushStorage()
          console.info('[novels] recovered from novels_prev')
        }
      } catch (e2) {
        console.error('backup load failed', e2)
        novels.value = []
      }
    }
    loaded.value = true
    return novels.value
  }

  /**
   * @param {{ backup?: boolean, flush?: boolean }} [opts]
   * - backup: write novels_prev rolling copy (skip on high-frequency chapter autosave)
   * - flush: await IndexedDB flush (use on leave / structural changes)
   */
  async function save(opts = {}) {
    const backup = opts.backup !== false
    const flush = opts.flush !== false
    try {
      const json = JSON.stringify(novels.value)
      try {
        const prev = localStorage.getItem('novels')
        if (prev === json) return // no-op
        if (backup && prev) {
          localStorage.setItem('novels_prev', prev)
        }
      } catch {
        /* ignore backup failure */
      }
      localStorage.setItem('novels', json)
      if (flush) await flushStorage()
      // else: storage patch already scheduled a debounced IDB write
    } catch (e) {
      console.error('save novels failed', e)
      const name = e?.name || ''
      const msg = String(e?.message || e || '')
      if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
        throw new Error('存储空间不足，请清理回收站或导出后删除旧作品')
      }
      throw e
    }
  }

  function getById(id) {
    return novels.value.find((n) => String(n.id) === String(id)) || null
  }

  async function createNovel(payload = {}) {
    const customChapters = Array.isArray(payload.chapterList) ? payload.chapterList : null
    const novel = normalizeNovel({
      id: uid(),
      title: payload.title || '未命名作品',
      author: payload.author || '',
      genre: payload.genre || 'fantasy',
      description: payload.description || '',
      cover: payload.cover || '',
      coverPreset: payload.coverPreset || '',
      status: payload.status || 'writing',
      tags: payload.tags || [],
      pinned: !!payload.pinned,
      archived: !!payload.archived,
      chapterList: customChapters?.length
        ? customChapters
        : [
            {
              id: uid(),
              title: '第一章',
              content: payload.content || '',
              description: '',
              wordCount: countWords(payload.content || ''),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    novels.value.unshift(novel)
    await save()
    return novel
  }

  async function updateNovel(id, patch, saveOpts) {
    const idx = novels.value.findIndex((n) => String(n.id) === String(id))
    if (idx < 0) return null
    const next = normalizeNovel({
      ...novels.value[idx],
      ...patch,
      id: novels.value[idx].id,
      updatedAt: new Date().toISOString()
    })
    novels.value[idx] = next
    // ensure Vue sees array change for list UIs
    novels.value = novels.value.slice()
    await save(saveOpts)
    return next
  }

  async function deleteNovel(id, { purgeExtras = false } = {}) {
    novels.value = novels.value.filter((n) => String(n.id) !== String(id))
    if (purgeExtras) purgeNovelSatelliteKeys(id)
    await save()
  }

  async function softDeleteNovel(id) {
    const n = getById(id)
    if (!n) return null
    const { useTrash } = await import('./useTrash.js')
    await useTrash().softDelete(n)
    await deleteNovel(id)
    return n
  }

  async function restoreFromTrash(id) {
    const { useTrash } = await import('./useTrash.js')
    const n = await useTrash().restore(id)
    if (!n) return null
    novels.value.unshift(normalizeNovel(n))
    await save()
    return n
  }

  async function setPinned(id, pinned) {
    return updateNovel(id, { pinned: !!pinned })
  }

  async function setArchived(id, archived) {
    const patch = { archived: !!archived }
    if (archived) patch.pinned = false
    return updateNovel(id, patch)
  }

  async function duplicateNovel(id) {
    const src = getById(id)
    if (!src) return null
    const copy = normalizeNovel({
      ...JSON.parse(JSON.stringify(src)),
      id: uid(),
      title: (src.title || '未命名') + ' (副本)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapterList: (src.chapterList || []).map((c) => ({
        ...c,
        id: uid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
    })
    novels.value.unshift(copy)
    await save()
    return copy
  }

  /** Replace chapterList from outline parse (optional clear existing) */
  async function importChaptersFromOutline(novelId, chapterStubs, { replace = false } = {}) {
    const novel = getById(novelId)
    if (!novel) return null
    const mapped = (chapterStubs || []).map((c) => ({
      id: uid(),
      title: c.title || '新章节',
      content: c.content || '',
      description: '',
      wordCount: countWords(c.content || ''),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
    const list = replace ? mapped : [...(novel.chapterList || []), ...mapped]
    await updateNovel(novelId, { chapterList: list })
    return list
  }

  async function addChapter(novelId, title = '新章节') {
    const novel = getById(novelId)
    if (!novel) return null
    const chapter = {
      id: uid(),
      title,
      content: '',
      description: '',
      wordCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const list = [...(novel.chapterList || []), chapter]
    await updateNovel(novelId, { chapterList: list })
    return chapter
  }

  /**
   * Update one chapter. Optimized path for content autosave:
   * mutates chapter in place + light stats recompute, skips novels_prev + await flush.
   * Pass { flush: true } when leaving editor / critical paths.
   */
  async function updateChapter(novelId, chapterId, patch, saveOpts = {}) {
    const idx = novels.value.findIndex((n) => String(n.id) === String(novelId))
    if (idx < 0) return null
    const novel = novels.value[idx]
    const list = novel.chapterList || []
    const cidx = list.findIndex((c) => String(c.id) === String(chapterId))
    if (cidx < 0) return null

    const prev = list[cidx]
    const content = patch.content !== undefined ? patch.content : prev.content
    const updated = {
      ...prev,
      ...patch,
      content,
      wordCount: patch.wordCount ?? countWords(content),
      updatedAt: new Date().toISOString()
    }
    // Replace chapterList immutably for reactivity without full normalizeNovel
    const nextList = list.slice()
    nextList[cidx] = updated
    const nextNovel = recomputeNovelStats({
      ...novel,
      chapterList: nextList,
      updatedAt: new Date().toISOString()
    })
    novels.value[idx] = nextNovel
    novels.value = novels.value.slice()

    // Content edits: no rolling backup every keystroke; optional flush on leave
    const isContentOnly =
      patch &&
      Object.keys(patch).every((k) =>
        ['content', 'wordCount', 'title', 'description', 'wordGoal', 'notes', 'todos'].includes(k)
      )
    // Do not spread saveOpts after defaults — explicit keys only (avoid accidental overrides)
    await save({
      backup: saveOpts.backup ?? !isContentOnly,
      flush: saveOpts.flush === true
    })
    return updated
  }

  async function deleteChapter(novelId, chapterId) {
    const novel = getById(novelId)
    if (!novel) return
    const list = (novel.chapterList || []).filter(
      (c) => String(c.id) !== String(chapterId)
    )
    await updateNovel(novelId, { chapterList: list })
  }

  async function reorderChapters(novelId, fromIndex, toIndex) {
    const novel = getById(novelId)
    if (!novel) return
    const list = [...(novel.chapterList || [])]
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= list.length ||
      toIndex >= list.length ||
      fromIndex === toIndex
    ) {
      return
    }
    const [item] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, item)
    await updateNovel(novelId, { chapterList: list })
  }

  async function moveChapter(novelId, chapterId, direction) {
    const novel = getById(novelId)
    if (!novel) return
    const list = novel.chapterList || []
    const idx = list.findIndex((c) => String(c.id) === String(chapterId))
    if (idx < 0) return
    const to = direction === 'up' ? idx - 1 : idx + 1
    await reorderChapters(novelId, idx, to)
  }

  function exportNovelText(novel) {
    if (!novel) return ''
    const lines = []
    lines.push(`《${novel.title || '未命名'}》`)
    lines.push('='.repeat(40))
    if (novel.author) lines.push(`作者：${novel.author}`)
    if (novel.description) lines.push(`\n简介：\n${stripHtml(novel.description)}`)
    lines.push('')
    ;(novel.chapterList || []).forEach((c, i) => {
      lines.push(`第${i + 1}章 ${c.title || ''}`)
      lines.push('-'.repeat(24))
      lines.push(stripHtml(c.content || '') || '（空）')
      lines.push('')
    })
    return lines.join('\n')
  }

  function exportChapterText(novel, chapter) {
    const title = novel?.title || '未命名'
    const ct = chapter?.title || '章节'
    return `《${title}》\n${ct}\n\n${stripHtml(chapter?.content || '')}`
  }

  async function replaceAll(list) {
    novels.value = (Array.isArray(list) ? list : []).map(normalizeNovel)
    await save()
  }

  const totalWords = computed(() =>
    novels.value.reduce((s, n) => s + (n.wordCount || 0), 0)
  )

  const sorted = computed(() =>
    [...novels.value].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updatedAt) - new Date(a.updatedAt)
    })
  )

  const activeNovels = computed(() => sorted.value.filter((n) => !n.archived))
  const archivedNovels = computed(() => sorted.value.filter((n) => n.archived))

  const allTags = computed(() => {
    const s = new Set()
    for (const n of novels.value) {
      for (const t of n.tags || []) s.add(t)
    }
    return [...s].sort()
  })

  return {
    novels,
    sorted,
    activeNovels,
    archivedNovels,
    allTags,
    loaded,
    totalWords,
    load,
    save,
    getById,
    createNovel,
    updateNovel,
    deleteNovel,
    softDeleteNovel,
    restoreFromTrash,
    setPinned,
    setArchived,
    duplicateNovel,
    importChaptersFromOutline,
    addChapter,
    updateChapter,
    deleteChapter,
    reorderChapters,
    moveChapter,
    exportNovelText,
    exportChapterText,
    replaceAll,
    countWords,
    stripHtml,
    normalizeNovel,
    uid
  }
}

export const COVER_PRESETS = [
  { id: 'violet', css: 'linear-gradient(155deg, #6d28d9 0%, #7c3aed 40%, #b45309 100%)' },
  { id: 'ocean', css: 'linear-gradient(155deg, #0e7490 0%, #2563eb 50%, #7c3aed 100%)' },
  { id: 'ember', css: 'linear-gradient(155deg, #9a3412 0%, #dc2626 45%, #f59e0b 100%)' },
  { id: 'forest', css: 'linear-gradient(155deg, #14532d 0%, #15803d 50%, #84cc16 100%)' },
  { id: 'ink', css: 'linear-gradient(155deg, #0f172a 0%, #334155 60%, #64748b 100%)' },
  { id: 'rose', css: 'linear-gradient(155deg, #9d174d 0%, #db2777 45%, #f472b6 100%)' }
]

function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const GENRES = [
  { code: 'fantasy', name: '玄幻' },
  { code: 'urban', name: '都市' },
  { code: 'history', name: '历史' },
  { code: 'scifi', name: '科幻' },
  { code: 'wuxia', name: '武侠' },
  { code: 'romance', name: '言情' },
  { code: 'other', name: '其他' }
]

export function genreName(code) {
  return GENRES.find((g) => g.code === code)?.name || code || '未分类'
}

export function statusLabel(status) {
  return (
    {
      writing: '创作中',
      completed: '已完成',
      paused: '已暂停'
    }[status] || status || '创作中'
  )
}
