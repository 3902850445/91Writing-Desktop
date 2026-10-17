/**
 * 全局 AI 助手对话管理
 * - 跨页面持久化对话历史（localStorage key: global_ai_chat）
 * - 上下文感知：自动引用当前小说信息（书名、类型、简介、最新章节）
 * - 支持流式输出
 */
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { flushStorage } from '../services/storage.js'
import apiService from '../services/api.js'
import { useNovels } from './useNovels.js'

const STORAGE_KEY = 'global_ai_chat'
const MAX_MESSAGES = 60

function uid() {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function useGlobalChat() {
  const messages = ref([])
  const busy = ref(false)
  const open = ref(false)

  /** 当前小说上下文（从路由 /write/:id 或书架选中获取） */
  const route = useRoute()
  const { novels, getById } = useNovels()

  const currentNovelId = computed(() => route.params.id || route.query.novelId || null)

  const currentNovel = computed(() => {
    const id = currentNovelId.value
    if (!id) return null
    return getById(id) || null
  })

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      messages.value = raw ? JSON.parse(raw) : []
      if (!Array.isArray(messages.value)) messages.value = []
    } catch {
      messages.value = []
    }
  }

  async function save() {
    if (messages.value.length > MAX_MESSAGES) {
      messages.value = messages.value.slice(-MAX_MESSAGES)
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value))
      await flushStorage()
    } catch {
      /* ignore */
    }
  }

  function clear() {
    messages.value = []
    save()
  }

  function toggleOpen() {
    open.value = !open.value
  }

  function setOpen(v) {
    open.value = !!v
  }

  /**
   * 构建上下文感知的 system prompt
   * 自动注入当前小说的书名、类型、简介、最新章节摘要
   */
  function buildSystemPrompt() {
    const novel = currentNovel.value
    if (!novel) {
      return '你是小说写作助手，回答简洁，可直接给出可粘贴进正文的段落。当前未关联具体小说。'
    }

    const chapters = novel.chapterList || []
    const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null

    let ctx = `你是小说《${novel.title}》的写作助手。`
    if (novel.genre) ctx += `小说类型：${novel.genre}。`
    if (novel.description) {
      ctx += `小说简介：${String(novel.description).slice(0, 200)}。`
    }
    if (lastChapter) {
      ctx += `当前共 ${chapters.length} 章，最新章节「${lastChapter.title}」。`
      // 附带最新章节末尾片段
      const tail = String(lastChapter.content || '').slice(-600)
      if (tail) ctx += `\n最新章节末尾片段：\n${tail}`
    }
    ctx += '\n回答时请结合当前小说的设定和风格。'
    return ctx
  }

  /**
   * 发送消息
   * @param {string} userText
   * @param {{ signal?: AbortSignal }} opts
   */
  async function send(userText, opts = {}) {
    const text = String(userText || '').trim()
    if (!text || busy.value) return null

    load()
    messages.value.push({
      id: uid(),
      role: 'user',
      content: text,
      at: new Date().toISOString()
    })
    await save()

    const history = messages.value.slice(-12).map((m) => ({
      isUser: m.role === 'user',
      content: m.content
    }))
    const prior = history.slice(0, -1) // 去掉刚发的消息，chatWithAI 会追加

    busy.value = true
    let full = ''
    try {
      const systemHint = buildSystemPrompt()

      const prompt = `${systemHint}\n\n【对话上下文】\n${prior
        .map((m) => `${m.isUser ? '用户' : '助手'}：${m.content}`)
        .join('\n')}\n用户：${text}\n助手：`

      full = await apiService.generateTextStream(
        prompt,
        { type: 'global-chat', signal: opts.signal },
        (_c, f) => {
          full = f
        }
      )

      messages.value.push({
        id: uid(),
        role: 'assistant',
        content: full || '',
        at: new Date().toISOString()
      })
      await save()
      return full
    } catch (e) {
      if (full) {
        messages.value.push({
          id: uid(),
          role: 'assistant',
          content: full,
          at: new Date().toISOString()
        })
        await save()
      }
      throw e
    } finally {
      busy.value = false
    }
  }

  /** 快捷指令：一键发送预设场景 */
  const quickActions = [
    { label: '续写', text: '请续写当前小说的最新章节，保持风格一致，推进情节发展。' },
    { label: '大纲', text: '请为当前小说生成后续章节大纲，至少 5 章，每章一句话概括。' },
    { label: '润色', text: '请润色最新章节的开头段落，提升文笔，保持原意。' },
    { label: '角色', text: '请分析当前小说的主要角色性格，并给出角色关系建议。' }
  ]

  async function sendQuick(label) {
    const action = quickActions.find((a) => a.label === label)
    if (!action) return
    await send(action.text)
  }

  load()

  return {
    messages,
    busy,
    open,
    currentNovel,
    currentNovelId,
    quickActions,
    send,
    sendQuick,
    clear,
    toggleOpen,
    setOpen,
    load
  }
}
