/**
 * 内置 Skill 注册表
 * 三个 skill：
 * 1. novel-writing-framework — 网文写作方法论（平台选型、逐章写作、质量自检、变现）
 * 2. novel-distiller — 小说蒸馏器（World Spirit 方法论：创世蓝图 → 灵魂蒸馏 → 章节撰写）
 * 3. chinese-novelist — 中文小说创作助手（分章节创作、悬念钩子、深度润色）
 */

const SKILL_REGISTRY_KEY = 'writing91_skill_registry'

/** Skill 描述 */
export const SKILLS = [
  {
    id: 'novel-writing-framework',
    name: '网文写作框架',
    description: '从 500+ 章实战中提炼的中文网文写作全流程框架。包含平台选型、逐章写作、质量自检、平台变现、数据驱动改良。适用于 20 万字到 500 万字长篇网文。',
    triggers: ['网文', '番茄', '起点', '写作方法论', '质量自检', '变现', '平台选型'],
    autoTrigger: true,
    path: 'skills/novel-writing-framework'
  },
  {
    id: 'novel-distiller',
    name: '小说蒸馏器',
    description: 'World Spirit 方法论的工程化实现。从想法到成书的完整流水线：创世蓝图 → 灵魂蒸馏 → 作者蒸馏 → 场景推演 → 章节撰写 → 锚定自检。解决 AI 写长篇的人物跳脱、风格变味、暗线遗忘等核心痛点。',
    triggers: ['蒸馏', 'World Spirit', '创世蓝图', '灵魂蒸馏', '角色思维', '剧情推演', '暗线追踪'],
    autoTrigger: true,
    path: 'skills/novel-distiller'
  },
  {
    id: 'chinese-novelist',
    name: '中文小说创作',
    description: '分章节创作引人入胜的中文小说。支持悬疑/言情/奇幻/科幻/历史等题材，10-50 章长篇，每章 3000-5000 字，结尾设置悬念钩子。强调深度润色去除 AI 痕迹。',
    triggers: ['写小说', '创作故事', '分章节', '连续剧情', '章节悬念', '长篇小说', '悬疑', '言情', '奇幻'],
    autoTrigger: true,
    path: 'skills/chinese-novelist-skill'
  }
]

/**
 * 根据用户输入自动匹配 skill
 * @param {string} input - 用户输入文本
 * @returns {{ skill: object, score: number } | null} 最佳匹配
 */
export function matchSkill(input) {
  const text = String(input || '').toLowerCase()
  let bestMatch = null
  let bestScore = 0

  for (const skill of SKILLS) {
    if (!skill.autoTrigger) continue
    let score = 0
    for (const trigger of skill.triggers) {
      if (text.includes(trigger.toLowerCase())) {
        score += 10
      }
    }
    // 通用写作关键词给基础分
    if (/写|创作|小说|章节|故事/.test(text)) {
      score += 3
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = skill
    }
  }

  return bestScore > 0 ? { skill: bestMatch, score: bestScore } : null
}

/**
 * 获取所有 skill 列表
 */
export function getAllSkills() {
  return SKILLS
}

/**
 * 根据 ID 获取 skill
 */
export function getSkillById(id) {
  return SKILLS.find((s) => s.id === id) || null
}

/**
 * 获取手动启用的 skill 列表
 */
export function getActiveSkills() {
  try {
    const raw = localStorage.getItem(SKILL_REGISTRY_KEY)
    const config = raw ? JSON.parse(raw) : { activeSkills: SKILLS.map((s) => s.id) }
    return SKILLS.filter((s) => config.activeSkills?.includes(s.id))
  } catch {
    return SKILLS
  }
}

/**
 * 设置手动启用的 skill
 */
export function setActiveSkills(ids) {
  try {
    localStorage.setItem(SKILL_REGISTRY_KEY, JSON.stringify({ activeSkills: ids }))
  } catch {
    /* ignore */
  }
}
