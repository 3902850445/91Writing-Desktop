/**
 * 小说标签系统 — 为设定和章节内容打标签
 * 标签类型：
 * - 设定标签：世界观、角色、剧情线、文风、伏笔、时间线
 * - 章节标签：大纲、连续性、伏笔、冲突、悬念
 * - AI 生成内容可携带标签，按标签插入对应设定栏
 */

const TAGS_KEY = 'writing91_novel_tags'

/** 预设标签定义 */
export const SETTING_TAGS = [
  { id: 'worldview', name: '世界观', color: '#8b5cf6', icon: '🌍' },
  { id: 'character', name: '角色', color: '#ec4899', icon: '👤' },
  { id: 'plot', name: '剧情线', color: '#f59e0b', icon: '📜' },
  { id: 'style', name: '文风', color: '#10b981', icon: '✍' },
  { id: 'foreshadowing', name: '伏笔', color: '#6366f1', icon: '🔍' },
  { id: 'timeline', name: '时间线', color: '#06b6d4', icon: '⏱' },
  { id: 'location', name: '地点', color: '#84cc16', icon: '📍' },
  { id: 'item', name: '物品', color: '#a855f7', icon: '⚔' }
]

export const CHAPTER_TAGS = [
  { id: 'outline', name: '大纲', color: '#8b5cf6', icon: '📋' },
  { id: 'continuity', name: '连续性', color: '#10b981', icon: '🔗' },
  { id: 'foreshadowing', name: '伏笔', color: '#6366f1', icon: '🔍' },
  { id: 'conflict', name: '冲突', color: '#ef4444', icon: '⚔' },
  { id: 'cliffhanger', name: '悬念', color: '#f59e0b', icon: '🎣' },
  { id: 'character_arc', name: '角色弧光', color: '#ec4899', icon: '📈' }
]

/**
 * 获取所有标签
 */
export function getAllTags() {
  return [...SETTING_TAGS, ...CHAPTER_TAGS]
}

/**
 * 根据 ID 获取标签
 */
export function getTagById(id) {
  return getAllTags().find((t) => t.id === id) || null
}

/**
 * 解析 AI 生成内容中的标签
 * AI 输出格式：[标签名]内容
 * 例如：[角色]主角是一个25岁的程序员...[世界观]故事发生在未来世界...
 * @param {string} text - AI 生成的文本
 * @returns {{ tagged: Array<{tag: string, tagId: string|null, content: string}>, untagged: string }}
 */
export function parseTaggedContent(text) {
  const tagged = []
  const tagPattern = /\[(世界观|角色|剧情线|文风|伏笔|时间线|地点|物品|大纲|连续性|冲突|悬念|角色弧光)\]([\s\S]*?)(?=\[(世界观|角色|剧情线|文风|伏笔|时间线|地点|物品|大纲|连续性|冲突|悬念|角色弧光)\]|$)/g

  let match
  let lastIndex = 0
  while ((match = tagPattern.exec(text)) !== null) {
    // 提取标签前的未标记内容
    if (match.index > lastIndex) {
      const untaggedPart = text.slice(lastIndex, match.index).trim()
      if (untaggedPart) {
        tagged.push({ tag: '通用', tagId: null, content: untaggedPart })
      }
    }

    const tagName = match[1]
    const tagDef = SETTING_TAGS.find((t) => t.name === tagName) || CHAPTER_TAGS.find((t) => t.name === tagName)
    tagged.push({
      tag: tagName,
      tagId: tagDef ? tagDef.id : null,
      content: match[2].trim()
    })
    lastIndex = tagPattern.lastIndex
  }

  // 提取剩余的未标记内容
  if (lastIndex < text.length) {
    const untaggedPart = text.slice(lastIndex).trim()
    if (untaggedPart) {
      tagged.push({ tag: '通用', tagId: null, content: untaggedPart })
    }
  }

  return { tagged, untagged: '' }
}

/**
 * 将带标签的内容格式化为纯文本
 * @param {Array<{tag: string, tagId: string|null, content: string}>} tagged
 * @returns {string}
 */
export function formatTaggedContent(tagged) {
  return tagged
    .map((item) => {
      if (item.tagId) {
        return `[${item.tag}]${item.content}`
      }
      return item.content
    })
    .join('\n\n')
}

/**
 * 保存标签到 localStorage
 */
export function saveTags(novelId, tags) {
  try {
    const raw = localStorage.getItem(TAGS_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data[novelId] = tags
    localStorage.setItem(TAGS_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

/**
 * 加载标签
 */
export function loadTags(novelId) {
  try {
    const raw = localStorage.getItem(TAGS_KEY)
    const data = raw ? JSON.parse(raw) : {}
    return data[novelId] || {}
  } catch {
    return {}
  }
}
