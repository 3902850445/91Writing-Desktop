<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>统计</h1>
        <p>字数趋势 · 进度 · 成就</p>
      </div>
    </header>

    <div class="m-stats">
      <div class="m-stat">
        <div class="m-stat__val">{{ novels.length }}</div>
        <div class="m-stat__label">作品</div>
      </div>
      <div class="m-stat">
        <div class="m-stat__val">{{ formatWords(totalWords) }}</div>
        <div class="m-stat__label">总字数</div>
      </div>
      <div class="m-stat">
        <div class="m-stat__val">{{ unlockedCount }}/{{ achievementList.length }}</div>
        <div class="m-stat__label">成就</div>
      </div>
    </div>

    <div class="m-section-title">近 {{ heatDays }} 日热力</div>
    <div class="m-card" style="margin-bottom: 16px">
      <div class="m-segment" style="margin-bottom: 10px">
        <button type="button" :class="{ 'is-active': heatDays === 14 }" @click="heatDays = 14">14 日</button>
        <button type="button" :class="{ 'is-active': heatDays === 30 }" @click="heatDays = 30">30 日</button>
        <button type="button" :class="{ 'is-active': heatDays === 90 }" @click="heatDays = 90">90 日</button>
      </div>
      <div class="m-heat" :class="{ 'm-heat--dense': heatDays > 30 }">
        <div
          v-for="d in heat"
          :key="d.date"
          class="m-heat__cell"
          :class="['m-heat__l' + d.level, { 'is-today': d.isToday }]"
          :title="d.date + ': ' + d.words + ' 字'"
          @click="selectedDay = d"
        >
          <span v-if="heatDays <= 30" class="m-heat__label">{{ d.label }}</span>
        </div>
      </div>
      <p v-if="selectedDay" class="m-hint" style="margin: 10px 0 0">
        {{ selectedDay.date }} · {{ selectedDay.words }} 字
      </p>
    </div>

    <div class="m-section-title">字数趋势（30 日）</div>
    <div class="m-card" style="margin-bottom: 16px">
      <div class="m-bars">
        <div v-for="d in trend30" :key="d.date" class="m-bars__col" :title="d.date + ': ' + d.words">
          <div class="m-bars__fill" :style="{ height: d.pct + '%' }" />
        </div>
      </div>
      <p class="m-hint" style="margin: 8px 0 0">最高日 {{ maxTrend }} 字</p>
    </div>

    <div class="m-section-title">写作辅助</div>
    <div class="m-card" style="margin-bottom: 16px">
      <div class="m-stats" style="margin: 0">
        <div class="m-stat">
          <div class="m-stat__val">{{ auxStats.openTodos }}</div>
          <div class="m-stat__label">未完成待办</div>
        </div>
        <div class="m-stat">
          <div class="m-stat__val">{{ auxStats.emptyChapters }}</div>
          <div class="m-stat__label">空章</div>
        </div>
        <div class="m-stat">
          <div class="m-stat__val">{{ auxStats.goalChapters }}</div>
          <div class="m-stat__label">设了目标章</div>
        </div>
      </div>
      <p class="m-hint" style="margin: 10px 0 0">
        待办共 {{ auxStats.totalTodos }} · 备注章 {{ auxStats.notesChapters }} · 已达成目标章
        {{ auxStats.metGoals }}/{{ auxStats.goalChapters || 0 }}
      </p>
      <div class="m-btn-row" style="margin-top: 10px; flex-wrap: wrap">
        <button
          type="button"
          class="m-btn m-btn--ghost m-btn--sm"
          :disabled="!resume?.novelId"
          @click="goResume"
        >
          继续写作
        </button>
        <button
          type="button"
          class="m-btn m-btn--primary m-btn--sm"
          :disabled="!auxStats.openTodos && !auxStats.totalTodos"
          @click="exportTodosHere"
        >
          导出待办 MD
        </button>
      </div>
    </div>

    <div class="m-section-title">本周速览</div>
    <div class="m-card" style="margin-bottom: 16px">
      <div class="m-row-between">
        <strong style="font-size: 0.95rem">近 7 日 {{ formatWords(week.total) }} 字</strong>
        <span class="m-muted" style="font-size: 0.8rem">活跃 {{ week.activeDays }} 天</span>
      </div>
      <div class="m-progress" style="margin: 10px 0 6px">
        <div class="m-progress__bar m-progress__bar--daily" :style="{ width: (week.pct || 0) + '%' }" />
      </div>
      <p class="m-hint" style="margin: 0">
        <template v-if="week.weekTarget">周目标 {{ week.pct }}%（{{ formatWords(week.total) }}/{{ formatWords(week.weekTarget) }}）</template>
        <template v-else>未设置每日目标时仅统计字数</template>
        <template v-if="week.best"> · 最高日 {{ formatWords(week.best) }}</template>
        · 日均 {{ formatWords(week.avgAll) }}
      </p>
      <div class="m-week-bars" style="margin-top: 12px; height: 48px" aria-hidden="true">
        <div
          v-for="d in week.series"
          :key="d.date"
          class="m-week-bars__col"
          :class="{ 'is-today': d.isToday, 'is-empty': !d.words }"
        >
          <div
            class="m-week-bars__fill"
            :style="{ height: Math.max(d.words ? 10 : 3, Math.round((d.words / Math.max(1, week.best || 1)) * 100)) + '%' }"
          />
          <span class="m-week-bars__lab">{{ d.label.split('/')[1] }}</span>
        </div>
      </div>
      <button
        type="button"
        class="m-btn m-btn--ghost m-btn--block m-btn--sm"
        style="margin-top: 12px"
        @click="shareWeekReport"
      >
        复制本周写作小结
      </button>
    </div>

    <div v-if="emptyChapterList.length" class="m-section-title">
      空章待写（{{ emptyChapterList.length }}）
    </div>
    <div v-if="emptyChapterList.length" class="m-card" style="margin-bottom: 16px; padding: 8px 0; overflow: hidden">
      <div
        v-for="row in emptyChapterList.slice(0, 12)"
        :key="row.key"
        class="m-empty-row"
      >
        <button type="button" class="m-empty-row__main" @click="openEmptyChapter(row, false)">
          <div class="m-empty-row__title">《{{ row.novelTitle }}》</div>
          <div class="m-muted" style="font-size: 0.82rem">
            第{{ row.chapterIndex + 1 }}章 {{ row.chapterTitle }}
            <template v-if="row.openTodos"> · 待办 {{ row.openTodos }}</template>
          </div>
        </button>
        <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="openEmptyChapter(row, false)">
          打开
        </button>
        <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="openEmptyChapter(row, true)">
          AI
        </button>
      </div>
      <p v-if="emptyChapterList.length > 12" class="m-hint" style="padding: 8px 14px 4px; margin: 0">
        仅显示前 12 个空章
      </p>
    </div>

    <div class="m-section-title">作品进度</div>
    <div v-if="!novels.length" class="m-muted" style="padding: 8px">暂无作品</div>
    <div v-for="n in novels.slice(0, 20)" :key="n.id" class="m-card" style="margin-bottom: 10px">
      <div class="m-row-between">
        <strong style="font-size: 0.92rem">
          {{ n.title }}
          <span v-if="isResume(n)" class="m-resume-pill" style="margin-left: 6px">续写中</span>
        </strong>
        <span class="m-muted" style="font-size: 0.8rem">{{ formatWords(n.wordCount) }}</span>
      </div>
      <div class="m-progress" style="margin: 8px 0">
        <div class="m-progress__bar" :style="{ width: chapterPct(n) + '%' }" />
      </div>
      <div class="m-muted" style="font-size: 0.8rem">
        {{ filledChapters(n) }}/{{ (n.chapterList || []).length }} 章有正文 · 空章
        {{ emptyChapters(n) }}
        <template v-if="novelTodoOpen(n)"> · 待办 {{ novelTodoOpen(n) }}</template>
      </div>
      <button
        type="button"
        class="m-btn m-btn--ghost m-btn--sm"
        style="margin-top: 8px"
        @click="$router.push('/write/' + n.id)"
      >
        打开
      </button>
    </div>

    <div class="m-section-title">成就（{{ unlockedCount }}/{{ achievementList.length }}）</div>
    <div class="m-segment" style="margin-bottom: 10px">
      <button type="button" :class="{ 'is-active': achFilter === 'all' }" @click="achFilter = 'all'">
        全部
      </button>
      <button type="button" :class="{ 'is-active': achFilter === 'done' }" @click="achFilter = 'done'">
        已解锁
      </button>
      <button type="button" :class="{ 'is-active': achFilter === 'todo' }" @click="achFilter = 'todo'">
        未解锁
      </button>
    </div>
    <div class="m-card" style="padding: 0; overflow: hidden; margin-bottom: 24px">
      <div
        v-for="a in filteredAchievements"
        :key="a.id"
        class="m-action-row"
        :style="{ opacity: a.done ? 1 : 0.55 }"
      >
        <span>
          {{ a.icon }} {{ a.title }}
          <span class="m-muted" style="font-size: 0.8rem"> · {{ a.desc }}</span>
        </span>
        <span class="m-muted" style="font-size: 0.75rem; white-space: nowrap">
          {{ a.done ? formatAchTime(a.unlockedAt) : '未解锁' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNovels } from '../../composables/useNovels.js'
import { useGoals } from '../../composables/useGoals.js'
import { useAchievements } from '../../composables/useAchievements.js'
import { useReadingResume } from '../../composables/useReadingResume.js'
import { downloadText } from '../../utils/download.js'
import toast from '../../services/toast.js'

const router = useRouter()
const { novels, totalWords, load } = useNovels()
const { goals, load: loadGoals, weekStats } = useGoals()
const { list: achievementList, unlockedCount, evaluate, load: loadAchievements } = useAchievements()
const { resume, load: loadResume } = useReadingResume()

const heatDays = ref(30)
const selectedDay = ref(null)
const achFilter = ref('all')
const week = computed(() => weekStats(7))

function formatWords(n) {
  const v = Number(n) || 0
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return String(v)
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function wordsOn(dateKey) {
  let s = 0
  for (const g of goals.value || []) {
    if (g.history && g.history[dateKey]) s = Math.max(s, g.history[dateKey])
  }
  // sum unique: take max daily across goals is wrong — sum daily goal only
  // Prefer first daily goal history
  const daily = (goals.value || []).find((g) => g.type === 'daily')
  if (daily?.history?.[dateKey] != null) return daily.history[dateKey]
  return s
}

const heat = computed(() => {
  const target =
    (goals.value || []).find((g) => g.type === 'daily')?.target || 2000
  const out = []
  const today = new Date()
  for (let i = heatDays.value - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = dayKey(d)
    const words = wordsOn(key)
    let level = 0
    if (words > 0) level = 1
    if (words >= target * 0.35) level = 2
    if (words >= target * 0.7) level = 3
    if (words >= target) level = 4
    out.push({
      date: key,
      words,
      level,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      isToday: i === 0
    })
  }
  return out
})

const trend30 = computed(() => {
  const days = heat.value.slice(-30)
  const max = Math.max(1, ...days.map((d) => d.words))
  return days.map((d) => ({
    ...d,
    pct: Math.round((d.words / max) * 100)
  }))
})

const maxTrend = computed(() => Math.max(0, ...trend30.value.map((d) => d.words)))

function filledChapters(n) {
  return (n.chapterList || []).filter((c) => (c.wordCount || 0) > 0 || String(c.content || '').trim()).length
}
function emptyChapters(n) {
  return (n.chapterList || []).length - filledChapters(n)
}
function chapterPct(n) {
  const t = (n.chapterList || []).length
  if (!t) return 0
  return Math.round((filledChapters(n) / t) * 100)
}

function novelTodoOpen(n) {
  let c = 0
  for (const ch of n.chapterList || []) c += (ch.todos || []).filter((t) => !t.done).length
  return c
}

function isResume(n) {
  return !!(resume.value?.novelId && String(resume.value.novelId) === String(n?.id))
}

const auxStats = computed(() => {
  let openTodos = 0
  let totalTodos = 0
  let empty = 0
  let goalChapters = 0
  let metGoals = 0
  let notesChapters = 0
  for (const n of novels.value || []) {
    for (const c of n.chapterList || []) {
      const todos = c.todos || []
      totalTodos += todos.length
      openTodos += todos.filter((t) => !t.done).length
      const emptyCh = (c.wordCount || 0) < 50 && !String(c.content || '').trim()
      if (emptyCh) empty++
      const g = Number(c.wordGoal) || 0
      if (g > 0) {
        goalChapters++
        if ((c.wordCount || 0) >= g) metGoals++
      }
      if (c.notes) notesChapters++
    }
  }
  return { openTodos, totalTodos, emptyChapters: empty, goalChapters, metGoals, notesChapters }
})

const filteredAchievements = computed(() => {
  const list = achievementList.value || []
  if (achFilter.value === 'done') return list.filter((a) => a.done)
  if (achFilter.value === 'todo') return list.filter((a) => !a.done)
  return list
})

function formatAchTime(iso) {
  if (!iso) return '✓'
  try {
    return new Date(iso).toLocaleDateString('zh-CN')
  } catch {
    return '✓'
  }
}

function goResume() {
  if (resume.value?.novelId) router.push('/write/' + resume.value.novelId)
}

const emptyChapterList = computed(() => {
  const rows = []
  for (const n of novels.value || []) {
    if (n.archived) continue
    ;(n.chapterList || []).forEach((c, chapterIndex) => {
      const empty = (c.wordCount || 0) < 50 && !String(c.content || '').trim()
      if (!empty) return
      rows.push({
        key: `${n.id}_${c.id}`,
        novelId: n.id,
        novelTitle: n.title || '未命名',
        chapterId: c.id,
        chapterIndex,
        chapterTitle: c.title || `第${chapterIndex + 1}章`,
        openTodos: (c.todos || []).filter((t) => !t.done).length
      })
    })
  }
  return rows
})

function openEmptyChapter(row, autofill = false) {
  if (!row?.novelId) return
  try {
    localStorage.setItem(
      'writing91_resume',
      JSON.stringify({
        novelId: String(row.novelId),
        chapterId: String(row.chapterId),
        title: row.novelTitle,
        chapterTitle: row.chapterTitle,
        updatedAt: new Date().toISOString()
      })
    )
  } catch {
    /* ignore */
  }
  const query = { chapter: String(row.chapterId) }
  if (autofill) query.autofill = '1'
  router.push({ path: '/write/' + row.novelId, query })
}

function shareWeekReport() {
  const w = week.value || weekStats(7)
  const lines = [
    '【91写作 · 本周小结】',
    `近 7 日共写 ${w.total || 0} 字 · 活跃 ${w.activeDays || 0} 天`,
    w.weekTarget
      ? `周目标进度 ${w.pct || 0}%（${w.total || 0}/${w.weekTarget}）`
      : '未设置每日目标',
    w.best ? `最高日 ${w.best} 字` : '',
    `日均 ${w.avgAll || 0} 字`,
    '',
    ...(w.series || []).map((d) => `${d.label}: ${d.words || 0} 字`)
  ].filter(Boolean)
  const text = lines.join('\n')
  try {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text)
    else {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    toast.success('本周小结已复制')
  } catch {
    toast.error('复制失败')
  }
}

function dateStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function exportTodosHere() {
  const books = []
  let totalOpen = 0
  let totalAll = 0
  for (const novel of novels.value || []) {
    const chapters = []
    for (let i = 0; i < (novel.chapterList || []).length; i++) {
      const c = novel.chapterList[i]
      const todos = c.todos || []
      if (!todos.length && !c.notes) continue
      totalAll += todos.length
      totalOpen += todos.filter((t) => !t.done).length
      chapters.push({
        index: i,
        title: c.title || `第${i + 1}章`,
        notes: c.notes || '',
        todos
      })
    }
    if (chapters.length) books.push({ title: novel.title || '未命名', chapters })
  }
  if (!books.length) {
    toast.info('还没有待办或备注')
    return
  }
  const lines = [
    '# 91写作 · 全部待办清单',
    '',
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `作品 ${books.length} 部 · 待办 ${totalAll} 项（未完成 ${totalOpen}）`,
    ''
  ]
  for (const b of books) {
    lines.push(`# 《${b.title}》`, '')
    for (const ch of b.chapters) {
      lines.push(`## 第${ch.index + 1}章 ${ch.title}`)
      if (ch.notes) lines.push(`> 备注：${String(ch.notes).replace(/\n/g, ' ')}`)
      lines.push('')
      if (ch.todos.length) {
        for (const todo of ch.todos) {
          lines.push(`- [${todo.done ? 'x' : ' '}] ${todo.text}`)
        }
      } else {
        lines.push('_（仅有备注）_')
      }
      lines.push('')
    }
    lines.push('---', '')
  }
  downloadText(
    `91writing-all-todos-${dateStamp()}.md`,
    lines.join('\n'),
    'text/markdown;charset=utf-8'
  )
  toast.success(`已导出 ${totalOpen} 项未完成 / 共 ${totalAll} 项`)
}

onMounted(async () => {
  await load()
  loadGoals()
  loadAchievements()
  loadResume()
  const maxChapterWords = novels.value.reduce((m, n) => {
    for (const c of n.chapterList || []) m = Math.max(m, c.wordCount || 0)
    return m
  }, 0)
  const streak = Math.max(0, ...(goals.value || []).map((g) => g.streak || 0))
  const today = dayKey(new Date())
  evaluate({
    novelCount: novels.value.length,
    totalWords: totalWords.value,
    maxChapterWords,
    streak,
    todayWords: wordsOn(today)
  })
})
</script>

<style scoped>
.m-empty-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.m-empty-row__main {
  flex: 1;
  text-align: left;
  background: transparent;
  border: 0;
  color: var(--text);
  min-width: 0;
  cursor: pointer;
}
.m-empty-row__title {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.m-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 88px;
}
.m-bars__col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
  background: var(--bg-soft);
  border-radius: 4px 4px 0 0;
  overflow: hidden;
}
.m-bars__fill {
  width: 100%;
  min-height: 2px;
  background: var(--grad-primary);
  border-radius: 4px 4px 0 0;
}
.m-heat--dense {
  grid-template-columns: repeat(15, 1fr);
}
.m-heat--dense .m-heat__cell {
  min-height: 14px;
}
</style>
