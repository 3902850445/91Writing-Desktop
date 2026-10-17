/**
 * Prompt library — key `prompts` (legacy compatible).
 */
import { ref, computed } from 'vue'
import { flushStorage } from '../services/storage.js'

const prompts = ref([])
const loaded = ref(false)

export const PROMPT_CATEGORIES = [
  { key: 'all', name: '全部', icon: '📚' },
  { key: 'outline', name: '大纲', icon: '🗺️' },
  { key: 'content', name: '正文', icon: '✍️' },
  { key: 'content-dialogue', name: '对话', icon: '💬' },
  { key: 'polish', name: '润色', icon: '✨' },
  { key: 'brainstorm', name: '脑洞', icon: '💡' },
  { key: 'worldview', name: '世界观', icon: '🌍' },
  { key: 'character', name: '角色', icon: '🎭' },
  { key: 'other', name: '其他', icon: '📝' }
]

function uid() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

const DEFAULTS = [
  {
    id: 'd_continue',
    title: '智能续写',
    category: 'content',
    description: '根据上文续写 400–800 字',
    content:
      '请根据以下上文续写小说正文，直接输出正文，不要标题和解释，保持文风一致，约 400-800 字。\n\n【上文】\n{上文}',
    tags: ['续写'],
    usageCount: 0,
    builtin: true
  },
  {
    id: 'd_polish',
    title: '文笔润色',
    category: 'polish',
    description: '提升文笔，保持原意',
    content:
      '请润色以下正文：保持原意与人称，提升节奏与文笔，只输出润色后正文。\n\n【原文】\n{原文}',
    tags: ['润色'],
    usageCount: 0,
    builtin: true
  },
  {
    id: 'd_outline',
    title: '章节大纲',
    category: 'outline',
    description: '为当前作品生成章节大纲',
    content:
      '作品：《{书名}》，类型：{类型}。请生成 8-12 章大纲，每章用 ### 标题，下附 2-4 句剧情要点。简介：{简介}',
    tags: ['大纲'],
    usageCount: 0,
    builtin: true
  }
]

function load() {
  try {
    const raw = localStorage.getItem('prompts')
    if (raw) {
      const parsed = JSON.parse(raw)
      prompts.value = Array.isArray(parsed) ? parsed : []
    } else {
      prompts.value = DEFAULTS.map((d) => ({ ...d }))
      save()
    }
  } catch {
    prompts.value = DEFAULTS.map((d) => ({ ...d }))
  }
  loaded.value = true
  return prompts.value
}

async function save() {
  localStorage.setItem('prompts', JSON.stringify(prompts.value))
  await flushStorage()
}

export function usePrompts() {
  if (!loaded.value) load()

  const byCategory = (cat) => {
    if (!cat || cat === 'all') return prompts.value
    return prompts.value.filter((p) => p.category === cat)
  }

  const list = computed(() => prompts.value)

  async function addPrompt(payload) {
    const item = {
      id: uid(),
      title: payload.title || '未命名',
      category: payload.category || 'other',
      description: payload.description || '',
      content: payload.content || '',
      tags: payload.tags || [],
      usageCount: 0,
      createdAt: new Date().toISOString()
    }
    prompts.value.unshift(item)
    await save()
    return item
  }

  async function updatePrompt(id, patch) {
    const i = prompts.value.findIndex((p) => String(p.id) === String(id))
    if (i < 0) return null
    prompts.value[i] = { ...prompts.value[i], ...patch, id: prompts.value[i].id }
    await save()
    return prompts.value[i]
  }

  async function removePrompt(id) {
    prompts.value = prompts.value.filter((p) => String(p.id) !== String(id))
    await save()
  }

  async function bumpUsage(id) {
    const p = prompts.value.find((x) => String(x.id) === String(id))
    if (!p) return
    p.usageCount = (p.usageCount || 0) + 1
    await save()
  }

  /** Fill {上文}{原文}{书名}{类型}{简介} placeholders */
  function applyTemplate(content, vars = {}) {
    let s = String(content || '')
    const map = {
      上文: vars.context || vars.上文 || '',
      原文: vars.original || vars.原文 || '',
      书名: vars.title || vars.书名 || '',
      类型: vars.genre || vars.类型 || '',
      简介: vars.description || vars.简介 || '',
      章节: vars.chapter || vars.章节 || ''
    }
    for (const [k, v] of Object.entries(map)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
    }
    return s
  }

  return {
    prompts: list,
    loaded,
    load,
    save,
    byCategory,
    addPrompt,
    updatePrompt,
    removePrompt,
    bumpUsage,
    applyTemplate,
    PROMPT_CATEGORIES
  }
}
