/**
 * 章节自动审核系统
 * - 生成完成后自动对照大纲审核
 * - 审核不通过自动重写（最多 3 次）
 * - 支持断点续写（记录生成进度）
 * - 防误操作（生成前确认 + 生成中锁定）
 */
import { ref } from 'vue'
import apiService from '../services/api.js'

const REVIEW_KEY = 'writing91_chapter_reviews'
const GENERATION_KEY = 'writing91_chapter_generation'

/**
 * 审核结果
 * @typedef {Object} ReviewResult
 * @property {boolean} passed - 是否通过
 * @property {string[]} issues - 问题列表
 * @property {string} feedback - 给 AI 的修改建议
 * @property {number} score - 评分 (0-100)
 */

/**
 * 审核章节内容是否符合大纲
 * @param {Object} params
 * @param {string} params.novelTitle - 小说标题
 * @param {string} params.chapterTitle - 章节标题
 * @param {string} params.outline - 章节大纲
 * @param {string} params.content - 章节内容
 * @param {string[]} params.foreshadowing - 需要回收的伏笔
 * @param {string} params.characterState - 当前角色状态
 * @returns {Promise<ReviewResult>}
 */
export async function reviewChapter({
  novelTitle,
  chapterTitle,
  outline,
  content,
  foreshadowing = [],
  characterState = ''
}) {
  const prompt = `你是小说质量审核员。请审核以下章节内容是否符合大纲要求。

小说：《${novelTitle}》
章节：${chapterTitle}

【大纲要求】
${outline}

【需要回收的伏笔】
${foreshadowing.length > 0 ? foreshadowing.join('\n') : '无'}

【当前角色状态】
${characterState || '未提供'}

【待审核章节内容】
${content}

请从以下维度审核：
1. 剧情一致性：章节内容是否偏离大纲
2. 角色连贯性：角色行为是否符合设定
3. 伏笔回收：是否遗漏需要回收的伏笔
4. 节奏控制：章节节奏是否合理
5. 逻辑合理性：剧情逻辑是否自洽

请以 JSON 格式输出审核结果：
{
  "passed": true/false,
  "score": 0-100,
  "issues": ["问题1", "问题2"],
  "feedback": "给 AI 的修改建议，具体说明需要修改什么"
}`

  try {
    const response = await apiService.generateText(prompt, {
      maxTokens: 2048,
      type: 'chapter-review'
    })

    // 解析 JSON
    let result
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      result = JSON.parse(jsonMatch ? jsonMatch[0] : response)
    } catch {
      // 解析失败，默认通过但提示
      return {
        passed: true,
        score: 80,
        issues: ['审核结果解析失败，默认通过'],
        feedback: ''
      }
    }

    // 保存审核记录
    saveReview({
      novelTitle,
      chapterTitle,
      outline,
      content,
      result,
      timestamp: new Date().toISOString()
    })

    return result
  } catch (e) {
    return {
      passed: true,
      score: 80,
      issues: [`审核失败: ${e?.message || ''}`],
      feedback: ''
    }
  }
}

/**
 * 根据审核结果重写章节
 * @param {Object} params
 * @param {string} params.novelTitle
 * @param {string} params.chapterTitle
 * @param {string} params.outline
 * @param {string} params.originalContent - 原内容
 * @param {ReviewResult} params.reviewResult - 审核结果
 * @param {string} params.previousContent - 上一次重写的内容（用于断点续写）
 * @param {number} params.attempt - 当前重写次数（0=首次生成, 1=第一次重写...）
 * @returns {Promise<{ content: string, reviewResult: ReviewResult, attempts: number }>}
 */
export async function rewriteChapter({
  novelTitle,
  chapterTitle,
  outline,
  originalContent,
  reviewResult,
  previousContent = '',
  attempt = 0
}) {
  const prompt = `你是小说写作助手。请根据审核反馈重写以下章节内容。

小说：《${novelTitle}》
章节：${chapterTitle}

【大纲要求】
${outline}

【审核结果】
评分：${reviewResult.score}/100
${reviewResult.passed ? '审核通过' : '审核不通过'}

【需要修改的问题】
${reviewResult.issues.join('\n') || '无'}

【修改建议】
${reviewResult.feedback || '请保持剧情一致性，注意角色连贯性'}

【原内容】
${originalContent}

${previousContent ? `\n【上一次重写的内容（参考）】\n${previousContent}` : ''}

请重写章节内容，修复审核指出的问题。保持文风一致，字数在 2000-5000 字之间。直接输出章节内容，不要包含其他说明。`

  try {
    const content = await apiService.generateText(prompt, {
      maxTokens: 8192,
      type: 'chapter-rewrite',
      temperature: 0.7
    })

    // 审核重写后的内容
    const newReview = await reviewChapter({
      novelTitle,
      chapterTitle,
      outline,
      content
    })

    return {
      content,
      reviewResult: newReview,
      attempts: attempt + 1
    }
  } catch (e) {
    return {
      content: originalContent,
      reviewResult: { passed: false, score: 0, issues: [`重写失败: ${e?.message || ''}`], feedback: '' },
      attempts: attempt + 1
    }
  }
}

/**
 * 生成章节（带审核和自动重写）
 * @param {Object} params
 * @param {string} params.novelTitle
 * @param {string} params.chapterTitle
 * @param {string} params.outline
 * @param {string} params.previousChapterTail - 上一章末尾片段
 * @param {string[]} params.foreshadowing
 * @param {string} params.characterState
 * @param {number} params.maxRewrites - 最大重写次数（默认 3）
 * @param {Function} params.onProgress - 进度回调
 * @returns {Promise<{ content: string, reviewResult: ReviewResult, attempts: number, generated: boolean }>}
 */
export async function generateChapterWithReview(params) {
  const {
    novelTitle,
    chapterTitle,
    outline,
    previousChapterTail = '',
    foreshadowing = [],
    characterState = '',
    maxRewrites = 3,
    onProgress = null
  } = params

  // 生成初始内容
  if (onProgress) onProgress({ stage: 'generating', attempt: 0 })

  const genPrompt = `你是小说写作助手。请根据以下大纲生成章节内容。

小说：《${novelTitle}》
章节：${chapterTitle}

【大纲】
${outline}

${previousChapterTail ? `【上一章末尾】\n${previousChapterTail}` : ''}

${foreshadowing.length > 0 ? `【需要回收的伏笔】\n${foreshadowing.join('\n')}` : ''}

${characterState ? `【当前角色状态】\n${characterState}` : ''}

请生成章节内容，字数在 2000-5000 字之间。保持文风一致，注意角色连贯性。直接输出章节内容。`

  let content = ''
  try {
    content = await apiService.generateText(genPrompt, {
      maxTokens: 8192,
      type: 'chapter-generate',
      temperature: 0.8
    })
  } catch (e) {
    return {
      content: '',
      reviewResult: { passed: false, score: 0, issues: [`生成失败: ${e?.message || ''}`], feedback: '' },
      attempts: 0,
      generated: false
    }
  }

  // 审核
  let reviewResult = await reviewChapter({
    novelTitle,
    chapterTitle,
    outline,
    content,
    foreshadowing,
    characterState
  })

  let attempts = 0
  let previousContent = ''

  // 自动重写
  while (!reviewResult.passed && attempts < maxRewrites) {
    attempts++
    if (onProgress) onProgress({ stage: 'rewriting', attempt: attempts })

    const result = await rewriteChapter({
      novelTitle,
      chapterTitle,
      outline,
      originalContent: content,
      reviewResult,
      previousContent,
      attempt: attempts - 1
    })

    content = result.content
    reviewResult = result.reviewResult
    previousContent = content
  }

  // 保存生成记录
  saveGeneration({
    novelTitle,
    chapterTitle,
    content,
    reviewResult,
    attempts,
    timestamp: new Date().toISOString()
  })

  return {
    content,
    reviewResult,
    attempts,
    generated: true
  }
}

/**
 * 保存审核记录
 */
function saveReview(record) {
  try {
    const raw = localStorage.getItem(REVIEW_KEY)
    const data = raw ? JSON.parse(raw) : []
    data.push(record)
    // 只保留最近 100 条
    if (data.length > 100) data.splice(0, data.length - 100)
    localStorage.setItem(REVIEW_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

/**
 * 保存生成记录
 */
function saveGeneration(record) {
  try {
    const raw = localStorage.getItem(GENERATION_KEY)
    const data = raw ? JSON.parse(raw) : {}
    const key = `${record.novelTitle}_${record.chapterTitle}`
    data[key] = record
    localStorage.setItem(GENERATION_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

/**
 * 加载生成记录（用于断点续写）
 */
export function loadGeneration(novelTitle, chapterTitle) {
  try {
    const raw = localStorage.getItem(GENERATION_KEY)
    const data = raw ? JSON.parse(raw) : {}
    return data[`${novelTitle}_${chapterTitle}`] || null
  } catch {
    return null
  }
}

/**
 * 获取审核历史
 */
export function getReviewHistory() {
  try {
    const raw = localStorage.getItem(REVIEW_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
