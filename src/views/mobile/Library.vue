<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>91写作</h1>
        <p>本地书架 · 数据仅存本机</p>
      </div>
      <button type="button" class="m-icon-btn" title="设置" @click="$router.push('/settings')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>
    </header>

    <div class="m-stats">
      <div class="m-stat">
        <div class="m-stat__val">{{ novels.length }}</div>
        <div class="m-stat__label">作品</div>
      </div>
      <div class="m-stat">
        <div class="m-stat__val">{{ totalChapters }}</div>
        <div class="m-stat__label">章节</div>
      </div>
      <div class="m-stat">
        <div class="m-stat__val">{{ formatWords(totalWords) }}</div>
        <div class="m-stat__label">总字数</div>
      </div>
    </div>

    <div v-if="goalBanner" class="m-card m-goal-banner" @click="$router.push('/goals')">
      <div class="m-row-between">
        <strong style="font-size: 0.9rem">🎯 今日 {{ goalBanner.progress }}/{{ goalBanner.target }} 字</strong>
        <span class="m-muted" style="font-size: 0.8rem">连续 {{ goalBanner.streak }} 天 ›</span>
      </div>
      <div class="m-progress" style="margin-top: 8px">
        <div class="m-progress__bar" :style="{ width: goalBanner.pct + '%' }" />
      </div>
    </div>

    <div v-if="weekCard" class="m-card m-week-card">
      <div
        class="m-week-card__body"
        role="button"
        tabindex="0"
        @click="$router.push('/stats')"
        @keydown.enter.prevent="$router.push('/stats')"
      >
        <div class="m-row-between" style="margin-bottom: 8px">
          <strong style="font-size: 0.9rem">📅 近 7 日 {{ formatWords(weekCard.total) }} 字</strong>
          <span class="m-muted" style="font-size: 0.8rem">活跃 {{ weekCard.activeDays }} 天 ›</span>
        </div>
        <div class="m-week-bars" aria-hidden="true">
          <div
            v-for="d in weekCard.series"
            :key="d.date"
            class="m-week-bars__col"
            :class="{ 'is-today': d.isToday, 'is-empty': !d.words }"
            :title="d.date + ': ' + d.words + ' 字'"
          >
            <div class="m-week-bars__fill" :style="{ height: weekBarHeight(d.words) + '%' }" />
            <span class="m-week-bars__lab">{{ d.label.split('/')[1] }}</span>
          </div>
        </div>
        <p class="m-muted" style="font-size: 0.75rem; margin: 8px 0 0">
          日均 {{ formatWords(weekCard.avgAll) }}
          <template v-if="weekCard.best"> · 最高 {{ formatWords(weekCard.best) }}</template>
          <template v-if="weekCard.weekTarget"> · 周目标 {{ weekCard.pct }}%</template>
        </p>
      </div>
      <button
        type="button"
        class="m-btn m-btn--ghost m-btn--block m-btn--sm"
        style="margin-top: 10px"
        @click.stop="copyWeekReport"
      >
        复制本周小结
      </button>
    </div>

    <div
      v-if="resumeCard"
      class="m-card m-resume-card"
      role="button"
      tabindex="0"
      @click="continueWriting"
      @keydown.enter.prevent="continueWriting"
    >
      <div class="m-row-between" style="align-items: flex-start; gap: 10px">
        <div style="min-width: 0; flex: 1">
          <div class="m-resume-card__badge">继续写作</div>
          <strong class="m-resume-card__title">《{{ resumeCard.title }}》</strong>
          <p class="m-muted" style="font-size: 0.85rem; margin: 4px 0 0">
            {{ resumeCard.chapterTitle || '未选章节' }}
            <span v-if="resumeWhen"> · {{ resumeWhen }}</span>
          </p>
        </div>
        <span class="m-btn m-btn--primary m-btn--sm" style="pointer-events: none">打开</span>
      </div>
    </div>

    <div v-if="recentList.length" class="m-section-title" style="margin-top: 4px">最近打开</div>
    <div v-if="recentList.length" class="m-chips" style="padding-bottom: 8px">
      <button
        v-for="r in recentList"
        :key="r.id"
        type="button"
        class="m-chip is-active"
        @click="openNovel(r)"
      >
        {{ r.title }}
      </button>
    </div>

    <div class="m-field" style="margin-bottom: 8px">
      <input
        v-model="keyword"
        class="m-input"
        type="search"
        placeholder="搜索作品标题…"
        enterkeyhint="search"
      />
    </div>
    <div class="m-chips" style="padding-bottom: 10px">
      <button
        type="button"
        class="m-chip"
        :class="{ 'is-active': statusFilter === 'all' }"
        @click="statusFilter = 'all'"
      >
        全部
      </button>
      <button
        type="button"
        class="m-chip"
        :class="{ 'is-active': showArchived }"
        @click="showArchived = !showArchived"
      >
        {{ showArchived ? '含归档' : '归档' }}
      </button>
      <button
        type="button"
        class="m-chip"
        :class="{ 'is-active': statusFilter === 'writing' }"
        @click="statusFilter = 'writing'"
      >
        创作中
      </button>
      <button
        type="button"
        class="m-chip"
        :class="{ 'is-active': statusFilter === 'paused' }"
        @click="statusFilter = 'paused'"
      >
        暂停
      </button>
      <button
        type="button"
        class="m-chip"
        :class="{ 'is-active': statusFilter === 'completed' }"
        @click="statusFilter = 'completed'"
      >
        完成
      </button>
      <button
        v-for="g in genreChips"
        :key="g.code"
        type="button"
        class="m-chip"
        :class="{ 'is-active': genreFilter === g.code }"
        @click="genreFilter = genreFilter === g.code ? 'all' : g.code"
      >
        {{ g.name }}
      </button>
      <button
        v-for="t in allTags.slice(0, 10)"
        :key="'tag-' + t"
        type="button"
        class="m-chip"
        :class="{ 'is-active': tagFilter === t }"
        @click="tagFilter = tagFilter === t ? 'all' : t"
      >
        #{{ t }}
      </button>
    </div>

    <div v-if="!filtered.length" class="m-empty">
      <div class="m-empty__icon">📖</div>
      <h3>{{ novels.length ? '没有匹配的作品' : '还没有作品' }}</h3>
      <p>{{ novels.length ? '试试其他筛选' : '点右下角 + 创建第一部小说' }}</p>
      <button v-if="!novels.length" type="button" class="m-btn m-btn--primary" @click="openCreate">
        新建作品
      </button>
    </div>

    <div v-else class="m-list">
      <div v-for="n in filtered" :key="n.id" class="m-novel-card-wrap">
        <button type="button" class="m-novel-card" @click="openNovel(n)">
          <div class="m-novel-card__top">
            <div class="m-novel-card__cover" :style="coverStyle(n)">
              <span v-if="!n.cover">{{ (n.title || '书')[0] }}</span>
            </div>
            <div class="m-novel-card__body">
              <h3 class="m-novel-card__title">
                <span v-if="n.pinned">📌 </span>{{ n.title }}
                <span v-if="n.archived" class="m-muted" style="font-size: 0.75rem"> · 已归档</span>
              </h3>
              <p class="m-novel-card__desc">{{ n.description || '暂无简介' }}</p>
              <p v-if="n.tags?.length" class="m-muted" style="font-size: 0.75rem; margin-top: 4px">
                {{ n.tags.join(' · ') }}
              </p>
            </div>
          </div>
          <div class="m-novel-card__progress">
            <div class="m-progress" style="margin: 0 0 4px">
              <div
                class="m-progress__bar"
                :style="{ width: novelProgress(n).pct + '%' }"
              />
            </div>
            <div class="m-novel-card__progress-label">
              {{ novelProgress(n).label }}
              <span v-if="isResumeNovel(n)" class="m-resume-pill">续写中</span>
            </div>
          </div>
          <div class="m-novel-card__meta">
            <span class="m-badge">{{ genreName(n.genre) }}</span>
            <span
              class="m-badge"
              :class="
                n.status === 'completed'
                  ? 'm-badge--ok'
                  : n.status === 'paused'
                    ? 'm-badge--warn'
                    : ''
              "
            >
              {{ statusLabel(n.status) }}
            </span>
            <span>{{ (n.chapterList || []).length }} 章</span>
            <span>{{ formatWords(n.wordCount) }} 字</span>
          </div>
        </button>
        <div class="m-novel-card__actions">
          <button type="button" class="m-chip-btn" @click="openMenu(n)">⋯</button>
        </div>
      </div>
    </div>

    <button type="button" class="m-fab" aria-label="新建作品" @click="openCreate">+</button>

    <!-- create -->
    <div v-if="showCreate" class="m-sheet-mask" @click.self="showCreate = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">新建作品</h2>
        <div class="m-field">
          <label>标题</label>
          <input v-model="form.title" class="m-input" placeholder="作品名称" maxlength="80" />
        </div>
        <div class="m-field">
          <label>类型</label>
          <select v-model="form.genre" class="m-select">
            <option v-for="g in GENRES" :key="g.code" :value="g.code">{{ g.name }}</option>
          </select>
        </div>
        <div class="m-field">
          <label>简介（可选）</label>
          <textarea v-model="form.description" class="m-textarea" rows="3" />
        </div>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost" @click="showCreate = false">取消</button>
          <button type="button" class="m-btn m-btn--primary" :disabled="!form.title.trim()" @click="create">
            创建并写作
          </button>
        </div>
      </div>
    </div>

    <!-- actions menu -->
    <div v-if="menuNovel" class="m-sheet-mask" @click.self="menuNovel = null">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">{{ menuNovel.title }}</h2>
        <div class="m-list-actions">
          <button type="button" class="m-action-row" @click="openNovel(menuNovel)">打开写作</button>
          <button type="button" class="m-action-row" @click="openDetail">详情 / 封面 / 标签</button>
          <button type="button" class="m-action-row" @click="togglePin">
            {{ menuNovel?.pinned ? '取消置顶' : '置顶' }}
          </button>
          <button type="button" class="m-action-row" @click="toggleArchive">
            {{ menuNovel?.archived ? '取消归档' : '归档' }}
          </button>
          <button type="button" class="m-action-row" @click="doDuplicate">复制作品</button>
          <button type="button" class="m-action-row" @click="doExport('txt')">导出 TXT</button>
          <button type="button" class="m-action-row" @click="doExport('md')">导出 Markdown</button>
          <button type="button" class="m-action-row" @click="doExport('epub')">导出 EPUB</button>
          <button type="button" class="m-action-row" style="color: var(--danger)" @click="doDelete">
            删除到回收站
          </button>
        </div>
        <button type="button" class="m-btn m-btn--ghost m-btn--block" style="margin-top: 10px" @click="menuNovel = null">
          关闭
        </button>
      </div>
    </div>

    <!-- detail / cover -->
    <div v-if="showDetail" class="m-sheet-mask" @click.self="showDetail = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">作品详情</h2>
        <div class="m-field">
          <label>标题</label>
          <input v-model="detailForm.title" class="m-input" />
        </div>
        <div class="m-field">
          <label>作者</label>
          <input v-model="detailForm.author" class="m-input" />
        </div>
        <div class="m-field">
          <label>类型</label>
          <select v-model="detailForm.genre" class="m-select">
            <option v-for="g in GENRES" :key="g.code" :value="g.code">{{ g.name }}</option>
          </select>
        </div>
        <div class="m-field">
          <label>状态</label>
          <select v-model="detailForm.status" class="m-select">
            <option value="writing">创作中</option>
            <option value="paused">已暂停</option>
            <option value="completed">已完成</option>
          </select>
        </div>
        <div class="m-field">
          <label>简介</label>
          <textarea v-model="detailForm.description" class="m-textarea" rows="3" />
        </div>
        <div class="m-field">
          <label>标签（逗号分隔）</label>
          <input v-model="detailForm.tagsText" class="m-input" placeholder="修仙, 爽文" />
        </div>
        <div class="m-field">
          <label>封面预设</label>
          <div class="m-chips" style="flex-wrap: wrap">
            <button
              v-for="p in COVER_PRESETS"
              :key="p.id"
              type="button"
              class="m-chip"
              :class="{ 'is-active': detailForm.coverPreset === p.id }"
              :style="{ background: p.css, color: '#fff', border: 'none' }"
              @click="detailForm.coverPreset = p.id; detailForm.cover = ''"
            >
              {{ p.id }}
            </button>
          </div>
        </div>
        <div class="m-field">
          <label>封面图片（可选）</label>
          <input type="file" accept="image/*" @change="onCover" />
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" style="margin-top: 8px" @click="pickNativeCover">
            系统相册选图
          </button>
          <span class="m-hint">将压缩为小图存本地，过大可能占空间</span>
          <div
            v-if="detailForm.cover || detailForm.coverPreset"
            class="m-cover-preview"
            :style="coverStyle({ cover: detailForm.cover, coverPreset: detailForm.coverPreset })"
          />
          <button
            v-if="detailForm.cover || detailForm.coverPreset"
            type="button"
            class="m-btn m-btn--ghost m-btn--sm"
            style="margin-top: 8px"
            @click="detailForm.cover = ''; detailForm.coverPreset = ''"
          >
            清除封面
          </button>
        </div>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost" @click="showDetail = false">取消</button>
          <button type="button" class="m-btn m-btn--primary" @click="saveDetail">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNovels, statusLabel, COVER_PRESETS } from '../../composables/useNovels.js'
import { useGenres } from '../../composables/useGenres.js'
import { useGoals } from '../../composables/useGoals.js'
import { useAchievements } from '../../composables/useAchievements.js'
import { useReadingResume } from '../../composables/useReadingResume.js'
import { runDailyAutoBackup } from '../../composables/useAutoBackup.js'
import toast from '../../services/toast.js'
import { downloadText, downloadBinary } from '../../utils/download.js'
import { novelToMarkdown, novelToEpub, safeName } from '../../utils/exportFormats.js'
import { pickImage, onNativeShare } from '../../utils/bridge.js'
import { compressImageFile, compressDataUrl } from '../../utils/imageCompress.js'
import { parseOutlineToChapters } from '../../composables/useSnapshots.js'

const RECENT_KEY = 'writing91_recent_novels'

const router = useRouter()
const {
  novels,
  sorted,
  activeNovels,
  allTags,
  totalWords,
  load,
  createNovel,
  updateNovel,
  softDeleteNovel,
  setPinned,
  setArchived,
  duplicateNovel,
  exportNovelText,
  getById
} = useNovels()
const { options: GENRES, nameOf: genreName, bumpUsage } = useGenres()
const { todayBanner, weekStats, load: loadGoals, goals } = useGoals()
const { evaluate, unlock } = useAchievements()
const {
  resume,
  load: loadResume,
  clearResume,
  resumeLabel
} = useReadingResume()

const keyword = ref('')
const keywordDebounced = ref('')
let keywordTimer = null
watch(keyword, (v) => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    keywordDebounced.value = v
  }, 180)
})
const statusFilter = ref('all')
const genreFilter = ref('all')
const tagFilter = ref('all')
const showArchived = ref(false)
const recentIds = ref([])
const showCreate = ref(false)
const showDetail = ref(false)
const menuNovel = ref(null)
const form = reactive({ title: '', genre: 'fantasy', description: '' })
const detailForm = reactive({
  id: '',
  title: '',
  author: '',
  genre: 'fantasy',
  status: 'writing',
  tagsText: '',
  coverPreset: '',
  description: '',
  cover: ''
})

const totalChapters = computed(() =>
  novels.value.reduce((s, n) => s + (n.chapterList?.length || 0), 0)
)

const goalBanner = computed(() => todayBanner())
const weekCard = computed(() => {
  const w = weekStats(7)
  // Show even without formal goal if user wrote anything this week
  if (!w.total && !goals.value.length) return null
  return w
})

function weekBarHeight(words) {
  const max = Math.max(1, ...(weekCard.value?.series || []).map((d) => d.words || 0))
  return Math.max(words ? 8 : 2, Math.round(((Number(words) || 0) / max) * 100))
}

function copyWeekReport() {
  const w = weekCard.value || weekStats(7)
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

const resumeCard = computed(() => {
  const r = resume.value
  if (!r?.novelId) return null
  const n = novels.value.find((x) => String(x.id) === String(r.novelId))
  if (!n || n.archived) return null
  // chapter may have been deleted — still open novel
  let chapterTitle = r.chapterTitle || ''
  if (r.chapterId) {
    const ch = (n.chapterList || []).find((c) => String(c.id) === String(r.chapterId))
    if (ch) chapterTitle = ch.title || chapterTitle
  }
  return {
    novelId: n.id,
    chapterId: r.chapterId,
    title: n.title || r.title || '未命名',
    chapterTitle
  }
})

const resumeWhen = computed(() => resumeLabel())

const genreChips = computed(() => (GENRES.value || []).slice(0, 8))

const recentList = computed(() =>
  recentIds.value
    .map((id) => novels.value.find((n) => String(n.id) === String(id)))
    .filter(Boolean)
    .slice(0, 6)
)

const filtered = computed(() => {
  let list = showArchived.value ? sorted.value : activeNovels.value
  if (statusFilter.value !== 'all') {
    list = list.filter((n) => n.status === statusFilter.value)
  }
  if (genreFilter.value !== 'all') {
    list = list.filter((n) => n.genre === genreFilter.value)
  }
  if (tagFilter.value !== 'all') {
    list = list.filter((n) => (n.tags || []).includes(tagFilter.value))
  }
  const k = keywordDebounced.value.trim().toLowerCase()
  if (!k) return list
  return list.filter(
    (n) =>
      (n.title || '').toLowerCase().includes(k) ||
      (n.description || '').toLowerCase().includes(k) ||
      (n.tags || []).some((t) => String(t).toLowerCase().includes(k))
  )
})

function loadRecent() {
  try {
    recentIds.value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    if (!Array.isArray(recentIds.value)) recentIds.value = []
  } catch {
    recentIds.value = []
  }
}

function pushRecent(id) {
  const ids = [String(id), ...recentIds.value.filter((x) => String(x) !== String(id))].slice(0, 12)
  recentIds.value = ids
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

function formatWords(n) {
  const v = Number(n) || 0
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return String(v)
}

function coverStyle(n) {
  if (n?.cover) {
    return {
      backgroundImage: `url(${n.cover})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
  if (n?.coverPreset) {
    const p = COVER_PRESETS.find((x) => x.id === n.coverPreset)
    if (p) return { background: p.css }
  }
  return {}
}

function openCreate() {
  form.title = ''
  form.genre = GENRES.value[0]?.code || 'fantasy'
  form.description = ''
  showCreate.value = true
}

async function create() {
  const title = form.title.trim()
  if (!title) return
  try {
    const novel = await createNovel({
      title,
      genre: form.genre,
      description: form.description.trim()
    })
    try {
      await bumpUsage(form.genre)
    } catch {
      /* ignore */
    }
    showCreate.value = false
    toast.success('已创建')
    router.push(`/write/${novel.id}`)
  } catch (e) {
    toast.error('创建失败：' + (e.message || e))
  }
}

function openNovel(n) {
  menuNovel.value = null
  if (n?.id) pushRecent(n.id)
  router.push(`/write/${n.id}`)
}

function continueWriting() {
  const r = resumeCard.value
  if (!r) return
  pushRecent(r.novelId)
  unlock('resume_1')
  // Writer will pick resume chapter via useReadingResume
  router.push(`/write/${r.novelId}`)
}

function isResumeNovel(n) {
  return !!(resume.value?.novelId && String(resume.value.novelId) === String(n?.id))
}

/** Chapter fill rate + optional word-goal completion for bookshelf cards */
function novelProgress(n) {
  const list = n?.chapterList || []
  const total = list.length
  if (!total) return { pct: 0, label: '暂无章节' }
  const filled = list.filter(
    (c) => (c.wordCount || 0) > 0 || String(c.content || '').trim().length > 0
  ).length
  const pct = Math.round((filled / total) * 100)
  const withGoal = list.filter((c) => (Number(c.wordGoal) || 0) > 0)
  let goalNote = ''
  if (withGoal.length) {
    const met = withGoal.filter((c) => (c.wordCount || 0) >= (c.wordGoal || 0)).length
    goalNote = ` · 目标 ${met}/${withGoal.length}`
  }
  return {
    pct,
    label: `${filled}/${total} 章有正文${goalNote}`
  }
}

function openMenu(n) {
  menuNovel.value = n
}

function openDetail() {
  const n = menuNovel.value
  if (!n) return
  Object.assign(detailForm, {
    id: n.id,
    title: n.title || '',
    author: n.author || '',
    genre: n.genre || 'fantasy',
    status: n.status || 'writing',
    description: n.description || '',
    cover: n.cover || '',
    coverPreset: n.coverPreset || '',
    tagsText: (n.tags || []).join(', ')
  })
  menuNovel.value = null
  showDetail.value = true
}

async function onCover(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  try {
    detailForm.cover = await compressImageFile(file, { max: 320, quality: 0.72 })
    detailForm.coverPreset = ''
    toast.success('封面已压缩')
  } catch (e) {
    toast.warning(e?.message || '图片处理失败')
  }
}

async function saveDetail() {
  const tags = String(detailForm.tagsText || '')
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
  await updateNovel(detailForm.id, {
    title: detailForm.title.trim() || '未命名',
    author: detailForm.author.trim(),
    genre: detailForm.genre,
    status: detailForm.status,
    description: detailForm.description,
    cover: detailForm.cover,
    coverPreset: detailForm.coverPreset,
    tags
  })
  showDetail.value = false
  toast.success('已保存')
}

async function pickNativeCover() {
  const dataUrl = await pickImage()
  if (!dataUrl) {
    toast.info('未选择图片或当前环境不支持')
    return
  }
  try {
    detailForm.cover = await compressDataUrl(dataUrl, { max: 320, quality: 0.72 })
  } catch {
    detailForm.cover = dataUrl
  }
  detailForm.coverPreset = ''
  toast.success('已选用封面')
}

async function togglePin() {
  const n = menuNovel.value
  menuNovel.value = null
  if (!n) return
  await setPinned(n.id, !n.pinned)
  toast.success(n.pinned ? '已取消置顶' : '已置顶')
}

async function toggleArchive() {
  const n = menuNovel.value
  menuNovel.value = null
  if (!n) return
  await setArchived(n.id, !n.archived)
  toast.success(n.archived ? '已取消归档' : '已归档')
}

async function doDuplicate() {
  const n = menuNovel.value
  menuNovel.value = null
  if (!n) return
  const copy = await duplicateNovel(n.id)
  toast.success(copy ? '已复制' : '复制失败')
}

function doExport(fmt = 'txt') {
  const n = menuNovel.value
  menuNovel.value = null
  if (!n) return
  try {
    if (fmt === 'md') {
      downloadText(`${safeName(n.title)}.md`, novelToMarkdown(n), 'text/markdown;charset=utf-8')
    } else if (fmt === 'epub') {
      const bytes = novelToEpub(n)
      downloadBinary(`${safeName(n.title)}.epub`, bytes, 'application/epub+zip')
    } else {
      downloadText(`${safeName(n.title)}.txt`, exportNovelText(n))
    }
    unlock('export_1')
    toast.success('已导出')
  } catch (e) {
    toast.error('导出失败：' + (e.message || e))
  }
}

async function doDelete() {
  const n = menuNovel.value
  if (!n) return
  if (!confirm(`将《${n.title}》移入回收站？`)) return
  menuNovel.value = null
  await softDeleteNovel(n.id)
  toast.success('已移入回收站')
}

function refreshAchievements() {
  const maxChapterWords = novels.value.reduce((m, n) => {
    for (const c of n.chapterList || []) m = Math.max(m, c.wordCount || 0)
    return m
  }, 0)
  const streak = Math.max(0, ...(goals.value || []).map((g) => g.streak || 0))
  const today = new Date()
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const todayWords = (goals.value || []).reduce((s, g) => s + ((g.history && g.history[day]) || 0), 0)
  evaluate({
    novelCount: novels.value.length,
    totalWords: totalWords.value,
    maxChapterWords,
    streak,
    todayWords
  })
}

let unshare = null

onMounted(async () => {
  await load()
  loadGoals()
  loadRecent()
  loadResume()
  // Drop resume if novel was hard-deleted
  if (resume.value?.novelId && !getById(resume.value.novelId)) {
    clearResume()
  }
  runDailyAutoBackup(novels.value).catch(() => {})
  refreshAchievements()
  unshare = onNativeShare(async (text) => {
    const body = String(text || '').trim()
    if (!body) return
    if (!confirm('收到分享文本，要创建为新作品吗？')) return
    const stubs = parseOutlineToChapters(body)
    const title = (stubs[0]?.title || body.slice(0, 20) || '分享导入').slice(0, 40)
    const novel = await createNovel({
      title,
      chapterList: stubs.length
        ? stubs.map((s) => ({
            title: s.title,
            content: s.content || ''
          }))
        : [{ title: '正文', content: body }]
    })
    toast.success('已从分享创建作品')
    router.push(`/write/${novel.id}`)
  })
})

onBeforeUnmount(() => {
  if (keywordTimer) {
    clearTimeout(keywordTimer)
    keywordTimer = null
  }
  try {
    unshare?.()
  } catch {
    /* ignore */
  }
  unshare = null
})
</script>
