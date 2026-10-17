/**
 * Per-novel AI chat history — key chat_{novelId}
 */
import { ref } from 'vue'
import { flushStorage } from '../services/storage.js'
import apiService from '../services/api.js'

function uid() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function useChat(novelIdRef) {
  const messages = ref([])
  const busy = ref(false)

  function key() {
    const id = typeof novelIdRef === 'object' ? novelIdRef.value : novelIdRef
    return `chat_${id}`
  }

  function load() {
    try {
      const raw = localStorage.getItem(key())
      messages.value = raw ? JSON.parse(raw) : []
      if (!Array.isArray(messages.value)) messages.value = []
    } catch {
      messages.value = []
    }
  }

  async function save() {
    // keep last 40
    if (messages.value.length > 40) messages.value = messages.value.slice(-40)
    localStorage.setItem(key(), JSON.stringify(messages.value))
    await flushStorage()
  }

  async function clear() {
    messages.value = []
    await save()
  }

  /**
   * @param {string} userText
   * @param {{ systemExtra?: string, onChunk?: (full:string)=>void, signal?: AbortSignal }} opts
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
    // drop the last user msg from history for API (chatWithAI appends it)
    const prior = history.slice(0, -1)

    busy.value = true
    let full = ''
    try {
      const systemHint =
        opts.systemExtra ||
        '你是小说写作助手，回答简洁，可直接给出可粘贴进正文的段落。'

      // Prefer stream for better UX
      const prompt = `${systemHint}\n\n【对话上下文】\n${prior
        .map((m) => `${m.isUser ? '用户' : '助手'}：${m.content}`)
        .join('\n')}\n用户：${text}\n助手：`

      full = await apiService.generateTextStream(
        prompt,
        { type: 'chat', signal: opts.signal },
        (_c, f) => {
          full = f
          opts.onChunk?.(f)
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

  return { messages, busy, load, save, clear, send }
}
