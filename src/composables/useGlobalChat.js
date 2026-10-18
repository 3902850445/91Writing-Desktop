/**
 * 全局 AI 助手对话管理
 * - 跨页面持久化对话历史（localStorage key: global_ai_chat）
 * - 上下文感知：自动引用当前小说信息（书名、类型、简介、最新章节）
 * - 模型访问测试：首次使用前验证 API 连通性
 * - 本地文件读取：支持 md / txt / word（.docx）文件作为对话素材
 * - 全局设定修改：AI 提议 → 人工审核 → 生效
 * - 支持流式输出
 */
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { flushStorage } from '../services/storage.js'
import apiService from '../services/api.js'
import { useNovels } from './useNovels.js'
import { useGlobalSettings } from './useGlobalSettings.js'
import { getSkillById, matchSkill } from './useSkillRegistry.js'

const STORAGE_KEY = 'global_ai_chat'
const MAX_MESSAGES = 60
const FILE_STORAGE_KEY = 'global_ai_files'

function uid() {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** 读取本地文件（md/txt/word），返回 { name, content, size } 列表 */
async function readLocalFiles(fileList) {
  const results = []
  for (const file of fileList) {
    const name = file.name
    const ext = name.split('.').pop()?.toLowerCase() || ''
    const raw = await file.text()
    let content = raw

    // .docx 是二进制 zip，无法用 text() 直接读取纯文本
    if (ext === 'docx') {
      // 浏览器环境无法直接解析 docx，使用简易提取：
      // 尝试从 zip 结构中提取 word/document.xml 的纯文本
      try {
        const arrayBuffer = await file.arrayBuffer()
        // 简易方案：读取为 base64，在 WebView 中用 native 解析
        // 此处先返回提示，实际解析由 native bridge 或后续增强处理
        const { readDocxViaBridge } = await import('../utils/docxReader.js')
        content = await readDocxViaBridge(arrayBuffer)
      } catch {
        content = `[无法解析 .docx 文件，请转换为 .txt 或 .md 后使用]`
      }
    }

    results.push({
      id: uid(),
      name,
      content: String(content).slice(0, 50000), // 限制单文件 50k 字符
      size: file.size,
      ext
    })
  }
  return results
}

export function useGlobalChat() {
  const messages = ref([])
  const busy = ref(false)
  const open = ref(false)

  /** 模型测试状态 */
  const modelTested = ref(false)
  const modelTestError = ref('')
  const modelTestLoading = ref(false)

  /** 已加载的本地文件 */
  const loadedFiles = ref([])

  /** 待审核的全局设定修改 */
  const pendingSettings = ref([])

  /** 当前小说上下文（从路由 /write/:id 或书架选中获取） */
  const route = useRoute()
  const { novels, getById, updateNovel } = useNovels()
  const { proposals, approveProposal, rejectProposal } = useGlobalSettings()

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
    // 加载文件列表
    try {
      const rawFiles = localStorage.getItem(FILE_STORAGE_KEY)
      loadedFiles.value = rawFiles ? JSON.parse(rawFiles) : []
    } catch {
      loadedFiles.value = []
    }
    // 加载模型测试状态
    try {
      const rawTest = localStorage.getItem('model_tested')
      modelTested.value = rawTest === 'true'
    } catch {
      modelTested.value = false
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
   * 测试模型访问
   * 首次使用 AI 助手前必须通过测试
   */
  async function testModel() {
    modelTestLoading.value = true
    modelTestError.value = ''
    try {
      const text = await apiService.generateText('你好，请回复 ok', {
        maxTokens: 16,
        type: 'model-test'
      })
      modelTested.value = true
      localStorage.setItem('model_tested', 'true')
      return { success: true, message: String(text || '').slice(0, 40) }
    } catch (e) {
      modelTestError.value = e?.message || '连接失败'
      modelTested.value = false
      localStorage.setItem('model_tested', 'false')
      return { success: false, message: modelTestError.value }
    } finally {
      modelTestLoading.value = false
    }
  }

  /** 当前激活的 skill ID */
  const activeSkillId = ref(null)

  /**
   * 构建上下文感知的 system prompt
   * 自动注入当前小说的书名、类型、简介、最新章节摘要、全局设定
   * 以及当前激活的 skill 方法论
   */
  function buildSystemPrompt() {
    const novel = currentNovel.value
    let ctx = ''

    // 注入 skill 方法论
    if (activeSkillId.value) {
      const skill = getSkillById(activeSkillId.value)
      if (skill) {
        ctx += `\n【写作方法论】\n你应遵循「${skill.name}」方法论：\n${skill.description}\n`
      }
    }

    if (!novel) {
      ctx += '你是小说写作助手，回答简洁，可直接给出可粘贴进正文的段落。当前未关联具体小说。'
      return ctx
    }

    const chapters = novel.chapterList || []
    const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null

    ctx += `你是小说《${novel.title}》的写作助手。`
    if (novel.genre) ctx += `小说类型：${novel.genre}。`
    if (novel.description) {
      ctx += `小说简介：${String(novel.description).slice(0, 200)}。`
    }

    // 注入全局设定
    if (novel.globalSettings && Object.keys(novel.globalSettings).length > 0) {
      ctx += `\n【全局设定】\n${JSON.stringify(novel.globalSettings, null, 2)}`
    }

    if (lastChapter) {
      ctx += `\n当前共 ${chapters.length} 章，最新章节「${lastChapter.title}」。`
      const tail = String(lastChapter.content || '').slice(-600)
      if (tail) ctx += `\n最新章节末尾片段：\n${tail}`
    }
    ctx += '\n回答时请结合当前小说的设定和风格。'
    return ctx
  }

  /**
   * 根据用户输入自动匹配 skill
   */
  function autoSelectSkill(inputText) {
    if (!inputText) return null
    const match = matchSkill(inputText)
    if (match) {
      activeSkillId.value = match.skill.id
      return match.skill
    }
    return null
  }

  /**
   * 发送消息
   * @param {string} userText
   * @param {{ signal?: AbortSignal }} opts
   */
  async function send(userText, opts = {}) {
    const text = String(userText || '').trim()
    if (!text || busy.value) return null

    // 自动匹配 skill
    autoSelectSkill(text)

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
    const prior = history.slice(0, -1)

    busy.value = true
    let full = ''
    try {
      const systemHint = buildSystemPrompt()

      // 如果有已加载的文件，将文件内容作为上下文
      let fileContext = ''
      if (loadedFiles.value.length > 0) {
        fileContext = '\n\n【参考资料】\n' + loadedFiles.value
          .map((f) => `--- ${f.name} ---\n${f.content.slice(0, 3000)}`)
          .join('\n\n')
      }

      const prompt = `${systemHint}${fileContext}\n\n【对话上下文】\n${prior
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
    { label: '角色', text: '请分析当前小说的主要角色性格，并给出角色关系建议。' },
    { label: '设定', text: '请分析当前小说的世界观设定，提出可以丰富设定的建议。' }
  ]

  async function sendQuick(label) {
    const action = quickActions.find((a) => a.label === label)
    if (!action) return
    await send(action.text)
  }

/**
 * 加载本地文件作为对话素材
 * 支持两种输入：
 * 1. HTML5 File 对象数组（桌面端/浏览器）
 * 2. 已解析的文件对象数组 { name, content, size, ext }（移动端 native bridge）
 * @param {Array} fileList
 */
async function loadFiles(fileList) {
  if (!fileList || fileList.length === 0) return

  // 判断是 HTML5 File 对象还是已解析的对象
  const isHtml5File = fileList[0]?.type !== undefined || fileList[0]?.name !== undefined && !(fileList[0]?.content !== undefined)

  if (isHtml5File) {
    // HTML5 File 对象：需要读取
    const allowedExts = ['md', 'txt', 'docx', 'markdown']
    const validFiles = fileList.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      return allowedExts.includes(ext)
    })

    if (validFiles.length === 0) {
      return { success: false, message: '仅支持 .md / .txt / .docx 格式' }
    }

    const results = await readLocalFiles(validFiles)
    loadedFiles.value.push(...results)

    // 持久化
    try {
      localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(loadedFiles.value))
    } catch {
      /* ignore */
    }

    return { success: true, count: results.length, message: `已加载 ${results.length} 个文件` }
  } else {
    // 已解析的对象（native bridge 返回）
    const allowedExts = ['md', 'txt', 'docx']
    const validFiles = fileList.filter((f) => {
      const ext = f.ext || f.name.split('.').pop()?.toLowerCase() || ''
      return allowedExts.includes(ext)
    })

    if (validFiles.length === 0) {
      return { success: false, message: '仅支持 .md / .txt / .docx 格式' }
    }

    // 直接使用已解析的内容
    const results = validFiles.map((f) => ({
      id: uid(),
      name: f.name,
      content: String(f.content || '').slice(0, 50000),
      size: f.size || String(f.content || '').length,
      ext: f.ext || f.name.split('.').pop()?.toLowerCase() || ''
    }))
    loadedFiles.value.push(...results)

    try {
      localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(loadedFiles.value))
    } catch {
      /* ignore */
    }

    return { success: true, count: results.length, message: `已加载 ${results.length} 个文件` }
  }
}

  /** 移除已加载的文件 */
  function removeFile(id) {
    loadedFiles.value = loadedFiles.value.filter((f) => f.id !== id)
    try {
      localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(loadedFiles.value))
    } catch {
      /* ignore */
    }
  }

  /**
   * 请求 AI 修改小说全局设定
   * AI 返回修改建议 → 存入待审核列表 → 用户审核后生效
   */
  async function proposeSettingsChange(instruction) {
    if (!currentNovel.value) {
      return { success: false, message: '请先关联一本小说' }
    }

    busy.value = true
    try {
      const novel = currentNovel.value
      const currentSettings = novel.globalSettings || {}
      const systemHint = buildSystemPrompt()

      const prompt = `${systemHint}\n\n【任务】请根据以下指令修改小说的全局设定：\n${instruction}\n\n当前设定：\n${JSON.stringify(currentSettings, null, 2)}\n\n请以 JSON 格式输出修改后的完整全局设定，不要包含其他内容。`

      const response = await apiService.generateText(prompt, {
        maxTokens: 4096,
        type: 'settings-proposal'
      })

      // 尝试解析 JSON
      let newSettings = null
      try {
        // 提取 JSON 部分
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          newSettings = JSON.parse(jsonMatch[0])
        } else {
          newSettings = JSON.parse(response)
        }
      } catch {
        return { success: false, message: 'AI 返回格式不正确，请重试或手动修改' }
      }

      // 创建提案
      const proposal = {
        id: uid(),
        novelId: novel.id,
        novelTitle: novel.title,
        instruction,
        currentSettings,
        proposedSettings: newSettings,
        status: 'pending', // pending | approved | rejected
        createdAt: new Date().toISOString()
      }

      // 保存提案到 globalSettings 存储
      proposals.value.push(proposal)
      try {
        localStorage.setItem('global_settings_proposals', JSON.stringify(proposals.value))
      } catch {
        /* ignore */
      }

      return { success: true, proposal, message: '修改建议已提交，请审核确认' }
    } catch (e) {
      return { success: false, message: e?.message || '生成失败' }
    } finally {
      busy.value = false
    }
  }

  /** 审核通过提案 → 生效到小说 */
  function approveProposalLocal(proposalId) {
    const proposal = proposals.value.find((p) => p.id === proposalId)
    if (!proposal) return false

    // 更新小说的 globalSettings
    updateNovel(proposal.novelId, { globalSettings: proposal.proposedSettings })

    // 标记为已通过
    proposal.status = 'approved'
    try {
      localStorage.setItem('global_settings_proposals', JSON.stringify(proposals.value))
    } catch {
      /* ignore */
    }
    return true
  }

  /** 拒绝提案 */
  function rejectProposalLocal(proposalId) {
    const proposal = proposals.value.find((p) => p.id === proposalId)
    if (!proposal) return false
    proposal.status = 'rejected'
    try {
      localStorage.setItem('global_settings_proposals', JSON.stringify(proposals.value))
    } catch {
      /* ignore */
    }
    return true
  }

  load()
  // 加载待审核提案
  try {
    const raw = localStorage.getItem('global_settings_proposals')
    proposals.value = raw ? JSON.parse(raw) : []
  } catch {
    proposals.value = []
  }

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
    testModel,
    modelTested,
    modelTestError,
    modelTestLoading,
    loadedFiles,
    loadFiles,
    removeFile,
    pendingSettings: proposals,
    proposeSettingsChange,
    approveProposal: approveProposalLocal,
    rejectProposal: rejectProposalLocal,
    activeSkillId,
    autoSelectSkill
  }
}
