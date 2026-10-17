<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>创作工具</h1>
        <p>短篇 · 拆书 · 工坊</p>
      </div>
    </header>

    <div class="m-segment">
      <button type="button" :class="{ 'is-active': tab === 'short' }" @click="tab = 'short'">短篇</button>
      <button type="button" :class="{ 'is-active': tab === 'analysis' }" @click="tab = 'analysis'">
        拆书
      </button>
      <button type="button" :class="{ 'is-active': tab === 'studio' }" @click="tab = 'studio'">
        工坊
      </button>
    </div>

    <!-- Short story -->
    <template v-if="tab === 'short'">
      <div class="m-field">
        <label>主题 / 梗概</label>
        <textarea v-model="shortTheme" class="m-textarea" rows="3" placeholder="一句话故事概念…" />
      </div>
      <div class="m-field">
        <label>字数约</label>
        <select v-model="shortLen" class="m-select">
          <option value="800">800 字</option>
          <option value="1500">1500 字</option>
          <option value="3000">3000 字</option>
        </select>
      </div>
      <button
        type="button"
        class="m-btn m-btn--primary m-btn--block"
        :disabled="busy || !shortTheme.trim()"
        @click="genShort"
      >
        {{ busy ? '生成中…' : '生成短篇' }}
      </button>
      <button
        v-if="isStreaming"
        type="button"
        class="m-btn m-btn--danger m-btn--block"
        style="margin-top: 8px"
        @click="stop"
      >
        停止
      </button>
      <div v-if="output" class="m-card" style="margin-top: 14px; white-space: pre-wrap">{{ output }}</div>
      <div v-if="output" class="m-btn-row" style="margin-top: 10px">
        <button type="button" class="m-btn m-btn--ghost" @click="copyOut">复制</button>
        <button type="button" class="m-btn m-btn--primary" @click="saveAsNovel">存为新作品</button>
      </div>
    </template>

    <!-- Book analysis -->
    <template v-else-if="tab === 'analysis'">
      <div class="m-field">
        <label>粘贴章节或段落</label>
        <textarea v-model="analysisText" class="m-textarea" rows="8" placeholder="待分析文本…" />
      </div>
      <button
        type="button"
        class="m-btn m-btn--primary m-btn--block"
        :disabled="busy || !analysisText.trim()"
        @click="genAnalysis"
      >
        {{ busy ? '分析中…' : '拆书分析' }}
      </button>
      <button
        v-if="isStreaming"
        type="button"
        class="m-btn m-btn--danger m-btn--block"
        style="margin-top: 8px"
        @click="stop"
      >
        停止
      </button>
      <div v-if="output" class="m-card" style="margin-top: 14px; white-space: pre-wrap">{{ output }}</div>
    </template>

    <!-- Studio: outline generator -->
    <template v-else>
      <div class="m-field">
        <label>作品名</label>
        <input v-model="studioTitle" class="m-input" placeholder="书名" />
      </div>
      <div class="m-field">
        <label>类型 / 卖点</label>
        <input v-model="studioGenre" class="m-input" placeholder="玄幻 · 废柴逆袭" />
      </div>
      <div class="m-field">
        <label>补充设定</label>
        <textarea v-model="studioExtra" class="m-textarea" rows="3" />
      </div>
      <button
        type="button"
        class="m-btn m-btn--primary m-btn--block"
        :disabled="busy || !studioTitle.trim()"
        @click="genOutline"
      >
        {{ busy ? '生成中…' : '生成大纲' }}
      </button>
      <button
        v-if="isStreaming"
        type="button"
        class="m-btn m-btn--danger m-btn--block"
        style="margin-top: 8px"
        @click="stop"
      >
        停止
      </button>
      <div v-if="output" class="m-card" style="margin-top: 14px; white-space: pre-wrap">{{ output }}</div>
      <button
        v-if="output"
        type="button"
        class="m-btn m-btn--primary m-btn--block"
        style="margin-top: 10px"
        @click="saveOutlineNovel"
      >
        创建作品并写入大纲章
      </button>
    </template>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useApiConfig } from '../../composables/useApiConfig.js'
import { useNovels } from '../../composables/useNovels.js'
import apiService from '../../services/api.js'
import toast from '../../services/toast.js'
import { keepScreenOn } from '../../utils/bridge.js'

const router = useRouter()
const { isConfigured, applyToService } = useApiConfig()
const { createNovel, updateChapter, load } = useNovels()

const tab = ref('short')
const shortTheme = ref('')
const shortLen = ref('1500')
const analysisText = ref('')
const studioTitle = ref('')
const studioGenre = ref('')
const studioExtra = ref('')
const output = ref('')
const busy = ref(false)
const isStreaming = ref(false)
let abortController = null

function ensureApi() {
  if (!isConfigured.value) {
    toast.warning('请先配置 API')
    router.push('/settings')
    return false
  }
  applyToService()
  return true
}

async function stream(prompt, type) {
  if (!ensureApi()) return
  busy.value = true
  isStreaming.value = true
  output.value = ''
  abortController = new AbortController()
  keepScreenOn(true)
  let raf = 0
  let pending = ''
  const flushUi = () => {
    raf = 0
    output.value = pending
  }
  try {
    await apiService.generateTextStream(
      prompt,
      { type, signal: abortController.signal },
      (_c, full) => {
        pending = full
        if (!raf) raf = requestAnimationFrame(flushUi)
      }
    )
    if (raf) cancelAnimationFrame(raf)
    if (pending) output.value = pending
    toast.success('完成')
  } catch (e) {
    if (raf) cancelAnimationFrame(raf)
    if (pending) output.value = pending
    if (e?.name === 'AbortError' || e?.message === 'GENERATION_ABORTED') {
      if (e.partial) output.value = e.partial
      toast.info('已停止')
    } else {
      toast.error(e?.message || '失败')
    }
  } finally {
    busy.value = false
    isStreaming.value = false
    abortController = null
    keepScreenOn(false)
  }
}

function stop() {
  abortController?.abort()
}

onBeforeUnmount(() => {
  if (abortController) {
    try {
      abortController.abort()
    } catch {
      /* ignore */
    }
    abortController = null
  }
  keepScreenOn(false)
})

function genShort() {
  stream(
    `请写一篇约 ${shortLen.value} 字的短篇小说，主题：${shortTheme.value}\n要求：完整起承转合，直接输出正文。`,
    'short-story'
  )
}

function genAnalysis() {
  stream(
    `请对以下文本做拆书分析，包含：结构节奏、人物动机、对话/描写比例、可改进点、可借鉴套路。用条理清晰的中文。\n\n【文本】\n${analysisText.value.slice(0, 8000)}`,
    'book-analysis'
  )
}

function genOutline() {
  stream(
    `请为小说《${studioTitle.value}》生成详细大纲。\n类型/卖点：${studioGenre.value}\n补充：${studioExtra.value}\n\n要求：8-12 章，每章用 ### 标题，下附 3 句剧情要点。`,
    'outline'
  )
}

async function copyOut() {
  try {
    await navigator.clipboard.writeText(output.value)
    toast.success('已复制')
  } catch {
    toast.error('复制失败')
  }
}

async function saveAsNovel() {
  await load()
  const n = await createNovel({
    title: shortTheme.value.slice(0, 20) || '短篇',
    description: shortTheme.value,
    genre: 'other'
  })
  const ch = n.chapterList?.[0]
  if (ch) {
    await updateChapter(n.id, ch.id, { title: '正文', content: output.value })
  }
  toast.success('已存为作品')
  router.push(`/write/${n.id}`)
}

async function saveOutlineNovel() {
  await load()
  const n = await createNovel({
    title: studioTitle.value,
    description: studioGenre.value,
    genre: 'other'
  })
  const ch = n.chapterList?.[0]
  if (ch) {
    await updateChapter(n.id, ch.id, { title: '大纲', content: output.value })
  }
  toast.success('已创建')
  router.push(`/write/${n.id}`)
}
</script>
