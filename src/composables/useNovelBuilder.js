/**
 * 从零构建小说 — 基于大纲文件生成完整小说
 * - 读取大纲文件（md/txt）
 * - 解析章节结构
 * - 逐章生成（带审核 + 自动重写 + 断点续写）
 * - 一键导出 txt / md
 */
import { ref } from 'vue'
import apiService from '../services/api.js'
import { useNovels } from './useNovels.js'
import { generateChapterWithReview, loadGeneration } from './useChapterReview.js'

/**
 * 解析大纲文件，提取章节结构
 * 支持格式：
 * - Markdown: ## 第1章 标题
 * - 纯文本: 第1章 标题
 * - 数字编号: 1. 标题
 * @param {string} outlineText
 * @returns {Array<{ title: string, outline: string }>}
 */
export function parseOutline(outlineText) {
  const text = String(outlineText || '')
  const lines = text.split(/\r?\n/)
  const chapters = []
  let currentTitle = ''
  let currentOutline = ''

  const chapterPatterns = [
    /^#{1,3}\s*第(\d+)[章节回]\s*(.+)$/,
    /^第(\d+)[章节回]\s*(.+)$/,
    /^#{1,3}\s*(\d+)[\.\、]\s*(.+)$/,
    /^(\d+)[\.\、]\s*(.+)$/
  ]

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 检查是否是章节标题
    let isChapterStart = false
    for (const pattern of chapterPatterns) {
      const match = trimmed.match(pattern)
      if (match) {
        // 保存上一章
        if (currentTitle) {
          chapters.push({ title: currentTitle, outline: currentOutline.trim() })
        }
        currentTitle = match[2] || trimmed.replace(/^#{1,3}\s*/, '')
        currentOutline = ''
        isChapterStart = true
        break
      }
    }

    if (!isChapterStart) {
      currentOutline += trimmed + '\n'
    }
  }

  // 保存最后一章
  if (currentTitle) {
    chapters.push({ title: currentTitle, outline: currentOutline.trim() })
  }

  return chapters
}

/**
 * 从零构建小说
 * @param {Object} params
 * @param {string} params.title - 小说标题
 * @param {string} params.genre - 小说类型
 * @param {string} params.description - 小说简介
 * @param {string} params.outlineText - 大纲全文
 * @param {string} params.author - 作者名（可选）
 * @param {number} params.maxRewrites - 每章最大重写次数
 * @param {Function} params.onProgress - 进度回调
 * @param {AbortSignal} params.signal - 中止信号
 * @returns {Promise<{ novel: Object, chapters: Array, success: boolean }>}
 */
export async function buildNovelFromOutline(params) {
  const {
    title,
    genre = 'fantasy',
    description = '',
    outlineText,
    author = '',
    maxRewrites = 3,
    onProgress = null,
    signal
  } = params

  const chapters = parseOutline(outlineText)
  if (chapters.length === 0) {
    return { novel: null, chapters: [], success: false, error: '大纲文件中未找到章节' }
  }

  if (onProgress) onProgress({ stage: 'parsing', totalChapters: chapters.length })

  // 创建小说
  const { createNovel } = useNovels()
  const novel = createNovel({
    title,
    author,
    genre,
    description,
    chapterList: chapters.map((c, i) => ({
      id: `ch_${Date.now().toString(36)}_${i}`,
      title: c.title,
      content: '',
      description: c.outline,
      wordCount: 0,
      wordGoal: 3000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
  })

  // 逐章生成
  const generatedChapters = []
  let totalAttempts = 0

  for (let i = 0; i < chapters.length; i++) {
    if (signal?.aborted) {
      return {
        novel,
        chapters: generatedChapters,
        success: false,
        error: '用户中止',
        interrupted: true,
        nextChapterIndex: i
      }
    }

    if (onProgress) {
      onProgress({
        stage: 'generating',
        chapterIndex: i,
        chapterTitle: chapters[i].title,
        totalChapters: chapters.length
      })
    }

    // 断点续写：检查是否有已保存的生成记录
    const saved = loadGeneration(title, chapters[i].title)
    if (saved && saved.reviewResult?.passed) {
      // 恢复已有生成结果
      generatedChapters.push({
        title: chapters[i].title,
        content: saved.content,
        reviewResult: saved.reviewResult,
        attempts: saved.attempts,
        resumed: true
      })
      continue
    }

    // 获取上一章末尾片段
    const previousTail = i > 0 && generatedChapters[i - 1]
      ? generatedChapters[i - 1].content.slice(-600)
      : ''

    // 生成章节（带审核）
    const result = await generateChapterWithReview({
      novelTitle: title,
      chapterTitle: chapters[i].title,
      outline: chapters[i].outline,
      previousChapterTail: previousTail,
      maxRewrites,
      onProgress: (progress) => {
        if (onProgress) {
          onProgress({
            stage: progress.stage,
            chapterIndex: i,
            chapterTitle: chapters[i].title,
            attempt: progress.attempt,
            totalChapters: chapters.length
          })
        }
      }
    })

    generatedChapters.push({
      title: chapters[i].title,
      content: result.content,
      reviewResult: result.reviewResult,
      attempts: result.attempts,
      resumed: false
    })
    totalAttempts += result.attempts

    // 更新章节内容到小说
    useNovels().updateChapter(novel.id, generatedChapters[i - 1]?.id || `ch_${i}`, {
      content: result.content,
      wordCount: result.content.length
    })
  }

  return {
    novel,
    chapters: generatedChapters,
    success: true,
    totalAttempts
  }
}

/**
 * 导出小说为 txt 或 md
 * @param {Object} novel - 小说对象
 * @param {string} format - 'txt' 或 'md'
 * @returns {string} 导出的文本内容
 */
export function exportNovel(novel, format = 'txt') {
  const chapters = novel.chapterList || []
  let content = ''

  if (format === 'md') {
    // Markdown 格式
    content += `# ${novel.title}\n\n`
    if (novel.author) content += `作者：${novel.author}\n\n`
    if (novel.description) content += `${novel.description}\n\n---\n\n`

    for (const ch of chapters) {
      content += `## ${ch.title}\n\n`
      content += `${ch.content}\n\n`
    }
  } else {
    // TXT 格式
    content += `${novel.title}\n`
    if (novel.author) content += `作者：${novel.author}\n\n`
    if (novel.description) content += `${novel.description}\n\n`

    for (const ch of chapters) {
      content += `第${chapters.indexOf(ch) + 1}章 ${ch.title}\n\n`
      content += `${ch.content}\n\n`
    }
  }

  return content
}

/**
 * 导出章节列表
 * @param {Array} chapters
 * @param {string} format
 * @returns {string}
 */
export function exportChapters(chapters, format = 'txt') {
  if (format === 'md') {
    return chapters
      .map((ch, i) => `## 第${i + 1}章 ${ch.title}\n\n${ch.content}\n\n`)
      .join('')
  }
  return chapters
    .map((ch, i) => `第${i + 1}章 ${ch.title}\n\n${ch.content}\n\n`)
    .join('')
}
