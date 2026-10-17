/**
 * Simple achievements — key achievements_v1
 */
import { ref, computed } from 'vue'
import { flushStorage } from '../services/storage.js'
import toast from '../services/toast.js'

const KEY = 'achievements_v1'

export const ACHIEVEMENT_DEFS = [
  { id: 'first_novel', title: '开笔', desc: '创建第一部作品', icon: '📖' },
  { id: 'first_chapter', title: '第一章', desc: '写出至少 500 字的一章', icon: '✍️' },
  { id: 'words_10k', title: '万字斩', desc: '累计总字数达到 1 万', icon: '🔟' },
  { id: 'words_100k', title: '十万雄文', desc: '累计总字数达到 10 万', icon: '💯' },
  { id: 'streak_3', title: '三日不辍', desc: '连续写作 3 天', icon: '🔥' },
  { id: 'streak_7', title: '一周坚持', desc: '连续写作 7 天', icon: '🏆' },
  { id: 'day_3k', title: '高产日', desc: '单日写作达到 3000 字', icon: '⚡' },
  { id: 'novels_3', title: '多线创作', desc: '书架拥有 3 部作品', icon: '📚' },
  { id: 'export_1', title: '备份达人', desc: '完成一次导出备份', icon: '💾' },
  { id: 'ai_use', title: '人机协作', desc: '使用一次 AI 生成', icon: '🤖' },
  { id: 'inspiration_1', title: '灵光一现', desc: '使用一次灵感骰子', icon: '🎲' },
  { id: 'todo_1', title: '有条不紊', desc: '创建第一条章节待办', icon: '✅' },
  { id: 'resume_1', title: '续写达人', desc: '从书架「继续写作」进入', icon: '⏩' },
  { id: 'fill_1', title: '填章能手', desc: '用 AI 填写一个空章', icon: '🪄' }
]

const unlocked = ref({}) // id -> iso date
let loaded = false

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    unlocked.value = raw ? JSON.parse(raw) : {}
    if (!unlocked.value || typeof unlocked.value !== 'object') unlocked.value = {}
  } catch {
    unlocked.value = {}
  }
  loaded = true
}

async function save() {
  localStorage.setItem(KEY, JSON.stringify(unlocked.value))
  await flushStorage()
}

export function useAchievements() {
  if (!loaded) load()

  const list = computed(() =>
    ACHIEVEMENT_DEFS.map((d) => ({
      ...d,
      unlockedAt: unlocked.value[d.id] || null,
      done: !!unlocked.value[d.id]
    }))
  )

  const unlockedCount = computed(() => list.value.filter((x) => x.done).length)

  async function unlock(id, { silent = false } = {}) {
    if (!id || unlocked.value[id]) return false
    unlocked.value = { ...unlocked.value, [id]: new Date().toISOString() }
    await save()
    if (!silent) {
      const def = ACHIEVEMENT_DEFS.find((d) => d.id === id)
      toast.success(`成就解锁：${def?.icon || ''} ${def?.title || id}`)
    }
    return true
  }

  /**
   * Evaluate common stats and unlock matching achievements.
   * @param {{ novelCount:number, totalWords:number, maxChapterWords:number, streak:number, todayWords:number }} stats
   */
  async function evaluate(stats = {}) {
    const {
      novelCount = 0,
      totalWords = 0,
      maxChapterWords = 0,
      streak = 0,
      todayWords = 0
    } = stats
    if (novelCount >= 1) await unlock('first_novel', { silent: true })
    if (maxChapterWords >= 500) await unlock('first_chapter', { silent: true })
    if (totalWords >= 10000) await unlock('words_10k', { silent: true })
    if (totalWords >= 100000) await unlock('words_100k', { silent: true })
    if (streak >= 3) await unlock('streak_3', { silent: true })
    if (streak >= 7) await unlock('streak_7', { silent: true })
    if (todayWords >= 3000) await unlock('day_3k', { silent: true })
    if (novelCount >= 3) await unlock('novels_3', { silent: true })
  }

  return { list, unlockedCount, unlock, evaluate, load }
}
