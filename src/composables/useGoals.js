/**
 * Writing goals — key `writingGoals` (legacy).
 */
import { ref, computed } from 'vue'
import { flushStorage } from '../services/storage.js'

const goals = ref([])
const loaded = ref(false)

function uid() {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function load() {
  try {
    const raw = localStorage.getItem('writingGoals')
    goals.value = raw ? JSON.parse(raw) : []
    if (!Array.isArray(goals.value)) goals.value = []
  } catch {
    goals.value = []
  }
  loaded.value = true
}

async function save() {
  localStorage.setItem('writingGoals', JSON.stringify(goals.value))
  await flushStorage()
}

export function useGoals() {
  if (!loaded.value) load()

  const activeGoals = computed(() =>
    goals.value.filter((g) => g.status !== 'completed' && g.status !== 'archived')
  )

  async function addGoal({ type = 'daily', target = 2000, title = '' } = {}) {
    const labels = { daily: '每日', weekly: '每周', monthly: '每月' }
    const g = {
      id: uid(),
      title: title || `${labels[type] || type}写作目标`,
      type, // daily | weekly | monthly
      target: Number(target) || 1000,
      progress: 0,
      streak: 0,
      lastWriteDate: null,
      history: {}, // date -> words
      status: 'active',
      createdAt: new Date().toISOString()
    }
    goals.value.unshift(g)
    await save()
    return g
  }

  async function updateGoal(id, patch) {
    const i = goals.value.findIndex((g) => String(g.id) === String(id))
    if (i < 0) return
    goals.value[i] = { ...goals.value[i], ...patch }
    await save()
  }

  async function removeGoal(id) {
    goals.value = goals.value.filter((g) => String(g.id) !== String(id))
    await save()
  }

  /** Record words written today (delta). Updates streak for daily goals. */
  async function recordWords(delta) {
    const n = Math.max(0, Number(delta) || 0)
    if (!n) return
    const day = todayKey()
    for (const g of goals.value) {
      if (g.status === 'archived') continue
      if (!g.history) g.history = {}
      g.history[day] = (g.history[day] || 0) + n

      if (g.type === 'daily') {
        g.progress = g.history[day] || 0
        if (g.lastWriteDate !== day) {
          const prev = new Date(day)
          prev.setDate(prev.getDate() - 1)
          const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
          if (g.lastWriteDate === prevKey) g.streak = (g.streak || 0) + 1
          else if (g.lastWriteDate !== day) g.streak = 1
          g.lastWriteDate = day
        }
      } else if (g.type === 'weekly') {
        g.progress = sumRecent(g.history, 7)
      } else if (g.type === 'monthly') {
        g.progress = sumRecent(g.history, 31)
      }
    }
    await save()
    // Push stats for Android home-screen widget (if bridge present)
    try {
      const daily = goals.value.find((g) => g.type === 'daily' && g.status !== 'archived')
      const todayWords = daily?.history?.[day] || 0
      const streak = daily?.streak || 0
      const { setWidgetStats } = await import('../utils/bridge.js')
      setWidgetStats({
        date: day,
        todayWords,
        streak,
        target: daily?.target || 0,
        updatedAt: new Date().toISOString()
      })
    } catch {
      /* ignore */
    }
  }

  function sumRecent(history, days) {
    let s = 0
    const d = new Date()
    for (let i = 0; i < days; i++) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      s += history[k] || 0
      d.setDate(d.getDate() - 1)
    }
    return s
  }

  function progressPct(g) {
    if (!g?.target) return 0
    return Math.min(100, Math.round(((g.progress || 0) / g.target) * 100))
  }

  /** Last N days heat for first daily goal (or aggregate). */
  function heatDays(days = 14) {
    const daily =
      goals.value.find((g) => g.type === 'daily' && g.status !== 'archived') ||
      goals.value[0]
    const history = daily?.history || {}
    const out = []
    const d = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const x = new Date(d)
      x.setDate(d.getDate() - i)
      const k = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
      const words = history[k] || 0
      const target = daily?.target || 2000
      const level =
        words <= 0 ? 0 : words < target * 0.3 ? 1 : words < target * 0.7 ? 2 : words < target ? 3 : 4
      out.push({
        date: k,
        label: `${x.getMonth() + 1}/${x.getDate()}`,
        words,
        level,
        isToday: k === todayKey()
      })
    }
    return out
  }

  /** Today progress for library banner */
  function todayBanner() {
    const daily = goals.value.find((g) => g.type === 'daily' && g.status !== 'archived')
    if (!daily) return null
    const day = todayKey()
    const progress = daily.history?.[day] ?? daily.progress ?? 0
    return {
      title: daily.title,
      progress,
      target: daily.target,
      pct: Math.min(100, Math.round((progress / (daily.target || 1)) * 100)),
      streak: daily.streak || 0
    }
  }

  /** Aggregate last N days of writing from daily goal history (or max across goals). */
  function weekStats(days = 7) {
    const daily =
      goals.value.find((g) => g.type === 'daily' && g.status !== 'archived') ||
      goals.value[0]
    const history = daily?.history || {}
    const d = new Date()
    let total = 0
    let activeDays = 0
    let best = 0
    let bestDate = ''
    const series = []
    for (let i = days - 1; i >= 0; i--) {
      const x = new Date(d)
      x.setDate(d.getDate() - i)
      const k = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
      const words = history[k] || 0
      total += words
      if (words > 0) activeDays++
      if (words > best) {
        best = words
        bestDate = k
      }
      series.push({
        date: k,
        label: `${x.getMonth() + 1}/${x.getDate()}`,
        words,
        isToday: k === todayKey()
      })
    }
    const target = daily?.target || 0
    const weekTarget = target > 0 ? target * days : 0
    return {
      days,
      total,
      activeDays,
      best,
      bestDate,
      avg: activeDays ? Math.round(total / activeDays) : 0,
      avgAll: Math.round(total / days),
      targetDaily: target,
      weekTarget,
      pct: weekTarget ? Math.min(100, Math.round((total / weekTarget) * 100)) : 0,
      series
    }
  }

  return {
    goals,
    activeGoals,
    loaded,
    load,
    addGoal,
    updateGoal,
    removeGoal,
    recordWords,
    progressPct,
    todayKey,
    heatDays,
    todayBanner,
    weekStats
  }
}
