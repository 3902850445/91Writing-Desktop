/**
 * Genre presets — key `novelGenres` (legacy array format).
 */
import { ref, computed } from 'vue'
import { flushStorage } from '../services/storage.js'

const genres = ref([])
const loaded = ref(false)

const DEFAULTS = [
  { code: 'fantasy', name: '玄幻', tags: ['修仙', '异世界'], prompt: '玄幻修仙向', usageCount: 0 },
  { code: 'urban', name: '都市', tags: ['现代', '职场'], prompt: '都市现实向', usageCount: 0 },
  { code: 'history', name: '历史', tags: ['古代', '朝廷'], prompt: '历史架空向', usageCount: 0 },
  { code: 'scifi', name: '科幻', tags: ['未来', '科技'], prompt: '科幻未来向', usageCount: 0 },
  { code: 'wuxia', name: '武侠', tags: ['江湖', '侠义'], prompt: '武侠江湖向', usageCount: 0 },
  { code: 'romance', name: '言情', tags: ['爱情', '情感'], prompt: '言情情感向', usageCount: 0 },
  { code: 'other', name: '其他', tags: [], prompt: '', usageCount: 0 }
]

function load() {
  try {
    const raw = localStorage.getItem('novelGenres')
    if (raw) {
      const parsed = JSON.parse(raw)
      genres.value = Array.isArray(parsed) ? parsed : []
    }
    if (!genres.value.length) {
      genres.value = DEFAULTS.map((d) => ({ ...d, id: d.code }))
      save()
    }
  } catch {
    genres.value = DEFAULTS.map((d) => ({ ...d, id: d.code }))
  }
  loaded.value = true
}

async function save() {
  localStorage.setItem('novelGenres', JSON.stringify(genres.value))
  await flushStorage()
}

export function useGenres() {
  if (!loaded.value) load()

  const options = computed(() =>
    genres.value.map((g) => ({
      code: g.code || g.id,
      name: g.name,
      tags: g.tags || [],
      prompt: g.prompt || ''
    }))
  )

  function nameOf(code) {
    return options.value.find((g) => g.code === code)?.name || code || '未分类'
  }

  async function addGenre({ code, name, tags = [], prompt = '' }) {
    const c = (code || name || 'custom').toString().trim().toLowerCase().replace(/\s+/g, '_')
    if (genres.value.some((g) => (g.code || g.id) === c)) {
      throw new Error('类型代码已存在')
    }
    genres.value.push({
      id: c,
      code: c,
      name: name || c,
      tags,
      prompt,
      usageCount: 0
    })
    await save()
  }

  async function updateGenre(code, patch) {
    const i = genres.value.findIndex((g) => (g.code || g.id) === code)
    if (i < 0) return
    genres.value[i] = { ...genres.value[i], ...patch, code: genres.value[i].code || code }
    await save()
  }

  async function removeGenre(code) {
    genres.value = genres.value.filter((g) => (g.code || g.id) !== code)
    await save()
  }

  async function bumpUsage(code) {
    const g = genres.value.find((x) => (x.code || x.id) === code)
    if (!g) return
    g.usageCount = (g.usageCount || 0) + 1
    await save()
  }

  return {
    genres,
    options,
    loaded,
    load,
    nameOf,
    addGenre,
    updateGenre,
    removeGenre,
    bumpUsage
  }
}
