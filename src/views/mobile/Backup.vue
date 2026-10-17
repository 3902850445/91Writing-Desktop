<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>备份</h1>
        <p>导出 / 导入本地数据</p>
      </div>
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
        <div class="m-stat__label">字数</div>
      </div>
    </div>

    <div v-if="storageHint" class="m-card" style="margin-bottom: 14px" :style="storageWarn ? { borderColor: 'var(--warning)' } : {}">
      <strong style="font-size: 0.9rem">本机占用</strong>
      <p class="m-hint" style="margin: 6px 0 0">{{ storageHint }}</p>
      <p v-if="storageWarn" class="m-danger-text" style="margin: 8px 0 0; font-size: 0.85rem">
        空间较紧张：建议导出备份并清理回收站 / 旧备份槽。
      </p>
    </div>

    <div class="m-section-title">自动备份</div>
    <div class="m-card" style="margin-bottom: 16px">
      <p class="m-hint" style="margin: 0 0 8px">
        每日首次打开书架时自动备份作品到本机。
      </p>
      <p v-if="autoMeta" class="m-muted" style="font-size: 0.85rem; margin: 0 0 10px">
        最近：{{ autoMeta.date }} · {{ autoMeta.count }} 部
      </p>
      <p v-else class="m-muted" style="font-size: 0.85rem; margin: 0 0 10px">尚未生成自动备份</p>
      <div class="m-btn-row">
        <button type="button" class="m-btn m-btn--ghost" :disabled="busy" @click="doAutoNow">立即备份</button>
        <button
          type="button"
          class="m-btn m-btn--primary"
          :disabled="busy || !autoMeta"
          @click="restoreAuto"
        >
          从自动备份恢复
        </button>
      </div>
    </div>

    <div class="m-section-title">导出</div>
    <div class="m-card" style="margin-bottom: 16px">
      <p class="m-hint" style="margin: 0 0 12px">
        分类导出或完整备份。完整包含 API 配置，请勿外传。
      </p>
      <div class="m-btn-row" style="margin-bottom: 8px">
        <button type="button" class="m-btn m-btn--primary" :disabled="busy" @click="exportNovels">
          作品
        </button>
        <button type="button" class="m-btn m-btn--ghost" :disabled="busy" @click="exportCategory('prompts')">
          提示词
        </button>
      </div>
      <div class="m-btn-row" style="margin-bottom: 8px">
        <button type="button" class="m-btn m-btn--ghost" :disabled="busy" @click="exportCategory('writingGoals')">
          目标
        </button>
        <button type="button" class="m-btn m-btn--ghost" :disabled="busy" @click="exportCategory('novelGenres')">
          类型
        </button>
      </div>
      <button type="button" class="m-btn m-btn--ghost m-btn--block" :disabled="busy" @click="exportFull(false)">
        导出完整备份（含 API Key，勿外传）
      </button>
      <button
        type="button"
        class="m-btn m-btn--primary m-btn--block"
        style="margin-top: 8px"
        :disabled="busy"
        @click="exportFull(true)"
      >
        导出安全备份（脱敏，无密钥）
      </button>
      <button
        type="button"
        class="m-btn m-btn--ghost m-btn--block"
        style="margin-top: 8px"
        :disabled="busy || !todoExportCount"
        @click="exportAllTodos"
      >
        导出全部作品待办清单（{{ todoExportCount }} 项未完成）
      </button>
    </div>

    <div class="m-section-title">导入</div>
    <div class="m-card" style="margin-bottom: 16px">
      <p class="m-hint" style="margin: 0 0 12px">
        导入会<strong>合并</strong>同 id 作品（以文件为准覆盖），新 id 直接加入。建议先导出当前数据。
      </p>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        style="display: none"
        @change="onFile"
      />
      <div class="m-btn-row">
        <button type="button" class="m-btn m-btn--primary" :disabled="busy" @click="pickFile">
          选择 JSON 导入
        </button>
      </div>
      <div v-if="pendingImport" class="m-import-preview">
        <strong>导入预览</strong>
        <p class="m-hint" style="margin: 6px 0">
          共 {{ pendingImport.count }} 部 · 示例：{{ pendingImport.sample.join('、') || '—' }}
          <span v-if="pendingImport.safe"> · 安全备份</span>
        </p>
        <label
          v-if="pendingImport.config"
          class="m-hint"
          style="display: flex; gap: 8px; align-items: center; margin: 8px 0"
        >
          <input v-model="importConfigToo" type="checkbox" />
          同时合并设置/配置（密钥为空时不覆盖本地）
        </label>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost" @click="pendingImport = null">取消</button>
          <button type="button" class="m-btn m-btn--primary" :disabled="busy" @click="confirmImport">
            确认合并导入
          </button>
        </div>
      </div>
      <p v-if="lastMsg" class="m-hint" style="margin-top: 12px">{{ lastMsg }}</p>
    </div>

    <div class="m-section-title">WebDAV</div>
    <div class="m-card" style="margin-bottom: 16px">
      <p class="m-hint" style="margin: 0 0 10px">
        使用设置中配置的 WebDAV URL 上传/下载完整备份 JSON。
      </p>
      <p class="m-hint" style="margin: 0 0 10px">
        默认上传<strong>脱敏</strong>备份（不含 API Key）。完整含密钥上传需二次确认。
      </p>
      <div class="m-btn-row">
        <button type="button" class="m-btn m-btn--primary" :disabled="busy" @click="uploadWebdav(true)">
          上传（安全）
        </button>
        <button type="button" class="m-btn m-btn--ghost" :disabled="busy" @click="uploadWebdav(false)">
          上传（含密钥）
        </button>
      </div>
      <button
        type="button"
        class="m-btn m-btn--ghost m-btn--block"
        style="margin-top: 8px"
        :disabled="busy"
        @click="downloadWebdav"
      >
        从 WebDAV 拉取
      </button>
    </div>

    <div class="m-section-title">历史备份槽</div>
    <div class="m-card" style="margin-bottom: 16px">
      <p class="m-hint" style="margin: 0 0 10px">最多保存 {{ slotMax }} 份本机快照，可一键恢复作品列表。</p>
      <button type="button" class="m-btn m-btn--primary m-btn--block" :disabled="busy" @click="saveSlot">
        保存当前到备份槽
      </button>
      <div v-for="s in slots" :key="s.id" class="m-card" style="margin-top: 10px; background: var(--bg-soft)">
        <div class="m-row-between">
          <strong style="font-size: 0.9rem">{{ s.label }}</strong>
          <span class="m-muted" style="font-size: 0.75rem">{{ s.novelCount }} 部</span>
        </div>
        <p class="m-muted" style="font-size: 0.75rem; margin: 4px 0 8px">{{ formatTime(s.createdAt) }}</p>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--primary m-btn--sm" :disabled="busy" @click="restoreSlot(s)">
            恢复
          </button>
          <button type="button" class="m-btn m-btn--danger m-btn--sm" :disabled="busy" @click="removeSlot(s.id)">
            删除
          </button>
        </div>
      </div>
    </div>

    <div class="m-section-title">粘贴建书</div>
    <div class="m-card" style="margin-bottom: 16px">
      <div class="m-field">
        <label>作品名</label>
        <input v-model="pasteTitle" class="m-input" placeholder="可选，默认取首行" />
      </div>
      <div class="m-field">
        <label>正文 / 大纲</label>
        <textarea v-model="pasteText" class="m-textarea" rows="6" placeholder="支持 ### 章节标题，或纯文本" />
      </div>
      <button
        type="button"
        class="m-btn m-btn--primary m-btn--block"
        :disabled="busy || !pasteText.trim()"
        @click="createFromPaste"
      >
        创建为新作品
      </button>
    </div>

    <div class="m-section-title">回收站</div>
    <div class="m-card" style="margin-bottom: 16px">
      <p v-if="!trashItems.length" class="m-muted" style="margin: 0">回收站为空</p>
      <div v-for="t in trashItems" :key="t.id" class="m-row-between" style="margin-bottom: 8px; gap: 8px">
        <div style="min-width: 0; flex: 1">
          <strong style="font-size: 0.9rem">{{ t.title }}</strong>
          <div class="m-muted" style="font-size: 0.75rem">{{ formatTime(t._trashedAt) }}</div>
        </div>
        <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="restoreTrash(t.id)">还原</button>
        <button type="button" class="m-btn m-btn--danger m-btn--sm" @click="purgeTrash(t.id)">清除</button>
      </div>
      <button
        v-if="trashItems.length"
        type="button"
        class="m-btn m-btn--ghost m-btn--block"
        style="margin-top: 8px"
        @click="purgeAllTrash"
      >
        清空回收站
      </button>
    </div>

    <div class="m-section-title">危险操作</div>
    <div class="m-card">
      <p class="m-danger-text" style="margin: 0 0 12px">
        清空全部作品不可恢复（不影响 API 配置；不经回收站）。
      </p>
      <button type="button" class="m-btn m-btn--danger m-btn--block" :disabled="busy" @click="clearAll">
        清空全部作品
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useNovels } from '../../composables/useNovels.js'
import { useBackupSlots } from '../../composables/useBackupSlots.js'
import { useTrash } from '../../composables/useTrash.js'
import { useAchievements } from '../../composables/useAchievements.js'
import { flushStorage, estimateStorage } from '../../services/storage.js'
import {
  getAutoBackupMeta,
  getAutoBackupPayload,
  runDailyAutoBackup
} from '../../composables/useAutoBackup.js'
import { parseOutlineToChapters } from '../../composables/useSnapshots.js'
import { useWebDav } from '../../composables/useWebDav.js'
import { useApiConfig } from '../../composables/useApiConfig.js'
import { useGoals } from '../../composables/useGoals.js'
import { usePrompts } from '../../composables/usePrompts.js'
import { usePrefs } from '../../composables/usePrefs.js'
import { useModelProfiles } from '../../composables/useModelProfiles.js'
import { useGenres } from '../../composables/useGenres.js'
import toast from '../../services/toast.js'
import { downloadText } from '../../utils/download.js'

const { novels, totalWords, load, replaceAll, createNovel, restoreFromTrash } = useNovels()
const { load: loadApiConfig } = useApiConfig()
const { load: loadGoals } = useGoals()
const { load: loadPrompts } = usePrompts()
const { load: loadPrefs, applyTheme } = usePrefs()
const { load: loadProfiles } = useModelProfiles()
const { load: loadGenres } = useGenres()
const {
  slots,
  load: loadSlots,
  createSlot,
  removeSlot: removeBackupSlot,
  MAX: slotMax
} = useBackupSlots()
const trash = useTrash()
const { unlock } = useAchievements()
const webdav = useWebDav()
const busy = ref(false)
const lastMsg = ref('')
const fileInput = ref(null)
const autoMeta = ref(null)
const pendingImport = ref(null)
const importConfigToo = ref(false)
const pasteTitle = ref('')
const pasteText = ref('')
const trashItems = computed(() => trash.items.value)

const todoExportCount = computed(() => {
  let n = 0
  for (const novel of novels.value || []) {
    for (const c of novel.chapterList || []) {
      n += (c.todos || []).filter((t) => !t.done).length
    }
  }
  return n
})

function safeFileName(s) {
  return String(s || 'export')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 60)
}

function exportAllTodos() {
  const books = []
  let totalOpen = 0
  let totalAll = 0
  for (const novel of novels.value || []) {
    const chapters = []
    for (let i = 0; i < (novel.chapterList || []).length; i++) {
      const c = novel.chapterList[i]
      const todos = c.todos || []
      if (!todos.length && !c.notes) continue
      const open = todos.filter((t) => !t.done)
      totalAll += todos.length
      totalOpen += open.length
      chapters.push({
        index: i,
        title: c.title || `第${i + 1}章`,
        notes: c.notes || '',
        todos
      })
    }
    if (chapters.length) {
      books.push({ title: novel.title || '未命名', chapters })
    }
  }
  if (!books.length) {
    toast.info('所有作品都还没有待办或备注')
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
    lines.push(`# 《${b.title}》`)
    lines.push('')
    for (const ch of b.chapters) {
      lines.push(`## 第${ch.index + 1}章 ${ch.title}`)
      if (ch.notes) lines.push(`> 备注：${String(ch.notes).replace(/\n/g, ' ')}`)
      lines.push('')
      if (ch.todos.length) {
        for (const todo of ch.todos) {
          lines.push(`- [${todo.done ? 'x' : ' '}] ${todo.text}`)
        }
      } else {
        lines.push('_（仅有备注，无待办）_')
      }
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }
  downloadText(
    `91writing-all-todos-${dateStamp()}.md`,
    lines.join('\n'),
    'text/markdown;charset=utf-8'
  )
  unlock('export_1')
  toast.success(`已导出 ${totalOpen} 项未完成 / 共 ${totalAll} 项`)
}
const storageHint = ref('')
const storageWarn = ref(false)

function formatBytes(n) {
  const v = Number(n) || 0
  if (v >= 1024 * 1024 * 1024) return (v / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  if (v >= 1024 * 1024) return (v / 1024 / 1024).toFixed(1) + ' MB'
  if (v >= 1024) return (v / 1024).toFixed(0) + ' KB'
  return v + ' B'
}

async function refreshStorageHint() {
  try {
    const est = await estimateStorage()
    if (!est) {
      storageHint.value = ''
      storageWarn.value = false
      return
    }
    const parts = []
    if (est.quota > 0) {
      parts.push(`已用 ${formatBytes(est.usage)} / ${formatBytes(est.quota)}`)
      parts.push(`约 ${(est.usageRatio * 100).toFixed(1)}%`)
    } else if (est.usage > 0) {
      parts.push(`估计占用 ${formatBytes(est.usage)}`)
    }
    if (est.novelsBytes > 0) parts.push(`作品数据约 ${formatBytes(est.novelsBytes)}`)
    if (trashItems.value.length) parts.push(`回收站 ${trashItems.value.length} 部`)
    storageHint.value = parts.join(' · ')
    storageWarn.value = est.quota > 0 ? est.usageRatio >= 0.8 : est.novelsBytes >= 8 * 1024 * 1024
  } catch {
    storageHint.value = ''
    storageWarn.value = false
  }
}

const totalChapters = computed(() =>
  novels.value.reduce((s, n) => s + (n.chapterList?.length || 0), 0)
)

function formatWords(n) {
  const v = Number(n) || 0
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return String(v)
}

function downloadJson(filename, data) {
  const text = JSON.stringify(data, null, 2)
  // Prefer data: URL on Android WebView (blob: downloads are blocked by the shell)
  const useData =
    typeof window !== 'undefined' &&
    (window.__WRITING91_ANDROID__ || /Android/i.test(navigator.userAgent || ''))

  if (useData) {
    const b64 =
      typeof btoa === 'function'
        ? btoa(unescape(encodeURIComponent(text)))
        : null
    if (b64) {
      const a = document.createElement('a')
      a.href = `data:application/json;base64,${b64}`
      a.download = filename
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    }
  }

  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

async function exportNovels() {
  busy.value = true
  try {
    await flushStorage()
    await load()
    const payload = {
      type: 'writing91-novels',
      version: 2,
      exportedAt: new Date().toISOString(),
      novels: novels.value
    }
    const name = `91writing-novels-${dateStamp()}.json`
    downloadJson(name, payload)
    lastMsg.value = `已导出 ${novels.value.length} 部作品`
    unlock('export_1')
    toast.success('导出已开始')
  } catch (e) {
    toast.error('导出失败')
  } finally {
    busy.value = false
  }
}

async function exportCategory(key) {
  busy.value = true
  try {
    await flushStorage()
    const raw = localStorage.getItem(key)
    let data
    try {
      data = raw ? JSON.parse(raw) : []
    } catch {
      data = raw
    }
    const payload = {
      type: `writing91-${key}`,
      version: 2,
      exportedAt: new Date().toISOString(),
      [key]: data
    }
    downloadJson(`91writing-${key}-${dateStamp()}.json`, payload)
    lastMsg.value = `已导出 ${key}`
    toast.success('已导出')
  } catch {
    toast.error('导出失败')
  } finally {
    busy.value = false
  }
}

function redactSecretsInData(data) {
  const secretKeys = ['officialApiConfig', 'customApiConfig', 'apiConfig', 'webdav_config', 'model_profiles']
  const out = { ...data }
  for (const k of secretKeys) {
    if (out[k] == null) continue
    try {
      const obj = typeof out[k] === 'string' ? JSON.parse(out[k]) : out[k]
      if (Array.isArray(obj)) {
        out[k] = JSON.stringify(
          obj.map((p) => (p && typeof p === 'object' ? { ...p, apiKey: '', password: '' } : p))
        )
      } else if (obj && typeof obj === 'object') {
        out[k] = JSON.stringify({ ...obj, apiKey: '', password: '' })
      }
    } catch {
      /* leave as-is if not json */
    }
  }
  // never export app lock pin
  delete out.app_lock_prefs
  return out
}

async function exportFull(safe = false) {
  busy.value = true
  try {
    await flushStorage()
    await load()
    const keys = [
      'novels',
      'officialApiConfig',
      'customApiConfig',
      'apiConfigType',
      'apiConfig',
      'writingGoals',
      'novelGenres',
      'prompts',
      'billing_records',
      'token_usage_stats',
      'writing91_prefs',
      'model_profiles'
    ]
    let data = {}
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k)
        if (v != null) data[k] = v
      } catch {
        /* ignore */
      }
    }
    // novels already managed — ensure latest
    data.novels = JSON.stringify(novels.value)
    if (safe) data = redactSecretsInData(data)

    const payload = {
      type: 'writing91-full-backup',
      version: 2,
      safe: !!safe,
      exportedAt: new Date().toISOString(),
      data
    }
    const name = safe
      ? `91writing-safe-${dateStamp()}.json`
      : `91writing-full-${dateStamp()}.json`
    downloadJson(name, payload)
    lastMsg.value = safe ? '已导出安全备份（无 API Key）' : '已导出完整备份（含配置）'
    unlock('export_1')
    toast.success(safe ? '安全备份已导出' : '完整备份已导出')
  } catch (e) {
    toast.error('导出失败')
  } finally {
    busy.value = false
  }
}

function dateStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function pickFile() {
  fileInput.value?.click()
}

async function doAutoNow() {
  busy.value = true
  try {
    await load()
    // force new backup by clearing date meta trick — write via run with novels
    localStorage.removeItem('auto_backup_meta')
    autoMeta.value = await runDailyAutoBackup(novels.value)
    lastMsg.value = '已写入今日自动备份'
    toast.success('自动备份完成')
  } catch {
    toast.error('备份失败')
  } finally {
    busy.value = false
  }
}

async function restoreAuto() {
  const payload = getAutoBackupPayload()
  if (!payload?.novels) {
    toast.warning('没有自动备份')
    return
  }
  pendingImport.value = {
    count: payload.novels.length,
    sample: payload.novels.slice(0, 5).map((n) => n.title || '未命名'),
    novels: payload.novels,
    source: 'auto'
  }
}

async function confirmImport() {
  const pending = pendingImport.value
  if (!pending) return
  const list = Array.isArray(pending.novels) ? pending.novels : []
  // Allow config-only confirm when novels empty but config present
  if (!list.length && !(importConfigToo.value && pending.config)) {
    toast.warning('没有可导入的内容')
    return
  }
  busy.value = true
  try {
    // Optional config merge (never applied before confirm)
    if (importConfigToo.value && pending.config) {
      const data = pending.config
      for (const [k, v] of Object.entries(data)) {
        if (k === 'novels' || k === 'app_lock_prefs') continue
        try {
          if (typeof v === 'string') mergeConfigValue(k, v)
        } catch {
          /* ignore */
        }
      }
    }

    let added = 0
    let updated = 0
    if (list.length) {
      await load()
      const map = new Map(novels.value.map((n) => [String(n.id), n]))
      for (const n of list) {
        if (!n) continue
        if (n.id && map.has(String(n.id))) {
          map.set(String(n.id), n)
          updated++
        } else {
          map.set(String(n.id || `imp_${added}`), n)
          added++
        }
      }
      await replaceAll([...map.values()])
    }
    // Reload in-memory modules so UI/API see imported data immediately
    const mergedConfig = !!(importConfigToo.value && pending.config)
    try {
      loadGoals()
      loadPrompts()
      loadGenres()
      if (mergedConfig) {
        loadApiConfig()
        loadPrefs()
        applyTheme()
        loadProfiles()
      }
    } catch {
      /* ignore reload errors */
    }
    lastMsg.value = `导入完成：写入 ${added}，覆盖 ${updated}${mergedConfig ? ' · 已合并配置' : ''}`
    pendingImport.value = null
    importConfigToo.value = false
    toast.success('导入成功')
    refreshStorageHint()
  } catch (e) {
    toast.error(e?.message || '导入失败')
  } finally {
    busy.value = false
  }
}

async function onFile(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  busy.value = true
  lastMsg.value = ''
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    let incoming = []

    // Category-only backups
    if (json?.type === 'writing91-prompts' && json.prompts) {
      localStorage.setItem('prompts', JSON.stringify(json.prompts))
      loadPrompts()
      lastMsg.value = '已导入提示词'
      toast.success('提示词已导入')
      return
    }
    if (json?.type === 'writing91-writingGoals' && json.writingGoals) {
      localStorage.setItem('writingGoals', JSON.stringify(json.writingGoals))
      loadGoals()
      lastMsg.value = '已导入写作目标'
      toast.success('目标已导入')
      return
    }
    if (json?.type === 'writing91-novelGenres' && json.novelGenres) {
      localStorage.setItem('novelGenres', JSON.stringify(json.novelGenres))
      loadGenres()
      lastMsg.value = '已导入类型'
      toast.success('类型已导入')
      return
    }
    // Legacy prompts export format
    if (json?.type === 'prompts' && Array.isArray(json.prompts)) {
      localStorage.setItem('prompts', JSON.stringify(json.prompts))
      loadPrompts()
      lastMsg.value = '已导入旧版提示词格式'
      toast.success('提示词已导入')
      return
    }

    let pendingConfig = null
    let safeFlag = false

    if (json?.type === 'writing91-novels' && Array.isArray(json.novels)) {
      incoming = json.novels
    } else if (json?.type === 'writing91-full-backup' && json.data) {
      // Do NOT apply config until user confirms — prevents secret wipe & surprise overwrites
      const data = json.data
      pendingConfig = data
      safeFlag = !!json.safe
      if (data.novels) {
        incoming =
          typeof data.novels === 'string' ? JSON.parse(data.novels) : data.novels
      }
    } else if (Array.isArray(json)) {
      incoming = json
    } else if (Array.isArray(json.novels)) {
      incoming = json.novels
    } else {
      throw new Error('无法识别的备份格式')
    }

    if (!Array.isArray(incoming)) incoming = []

    pendingImport.value = {
      count: incoming.length,
      sample: incoming.slice(0, 5).map((n) => n?.title || '未命名'),
      novels: incoming,
      source: 'file',
      config: pendingConfig,
      safe: safeFlag
    }
    // Default: don't merge config for safe backups (usually empty secrets)
    importConfigToo.value = !!(pendingConfig && !safeFlag)
    lastMsg.value = `待确认：${incoming.length} 部作品${pendingConfig ? '（含配置可选）' : ''}`
    return
  } catch (e) {
    console.error(e)
    lastMsg.value = '导入失败：' + (e.message || e)
    toast.error(e?.message || '导入失败')
  } finally {
    busy.value = false
  }
}

async function clearAll() {
  if (!confirm('确定清空全部作品？此操作不可恢复。')) return
  if (!confirm('再次确认：所有章节正文将删除。')) return
  busy.value = true
  try {
    await replaceAll([])
    lastMsg.value = '已清空作品'
    toast.success('已清空')
  } catch (e) {
    toast.error('清空失败')
  } finally {
    busy.value = false
  }
}

function formatTime(t) {
  try {
    return new Date(t).toLocaleString('zh-CN')
  } catch {
    return t || ''
  }
}

async function saveSlot() {
  busy.value = true
  try {
    await load()
    await createSlot(undefined, {
      type: 'writing91-slot',
      version: 2,
      novels: novels.value
    })
    loadSlots()
    toast.success('已保存到备份槽')
  } catch (e) {
    toast.error(e?.message || '保存失败')
  } finally {
    busy.value = false
  }
}

async function restoreSlot(s) {
  if (!s?.payload?.novels) {
    toast.warning('槽位数据无效')
    return
  }
  if (!confirm(`用该备份覆盖当前书架（${s.novelCount} 部）？建议先另存一槽。`)) return
  busy.value = true
  try {
    await replaceAll(s.payload.novels)
    toast.success('已从备份槽恢复')
  } catch (e) {
    toast.error(e?.message || '恢复失败')
  } finally {
    busy.value = false
  }
}

async function removeSlot(id) {
  await removeBackupSlot(id)
  loadSlots()
  toast.success('已删除槽位')
}

async function createFromPaste() {
  const body = pasteText.value.trim()
  if (!body) return
  busy.value = true
  try {
    const stubs = parseOutlineToChapters(body)
    const title =
      pasteTitle.value.trim() ||
      stubs[0]?.title ||
      body.split(/\n/)[0].slice(0, 30) ||
      '粘贴导入'
    await createNovel({
      title,
      chapterList: stubs.length
        ? stubs.map((s) => ({ title: s.title, content: s.content || '' }))
        : [{ title: '正文', content: body }]
    })
    pasteText.value = ''
    pasteTitle.value = ''
    toast.success('已创建作品')
  } catch (e) {
    toast.error(e?.message || '创建失败')
  } finally {
    busy.value = false
  }
}

async function restoreTrash(id) {
  const n = await restoreFromTrash(id)
  trash.load()
  if (n) toast.success(`已还原《${n.title}》`)
  else toast.warning('还原失败')
}

async function purgeTrash(id) {
  if (!confirm('永久删除该作品？')) return
  // drop related extras so IDB does not keep orphan data
  const prefixes = ['characters_','worldview_','worldSettings_','corpus_','events_','snapshots_','focusDraft_','editorPos_','chapterSummary_','chat_','volumes_']
  for (const p of prefixes) {
    try { localStorage.removeItem(p + id) } catch { /* ignore */ }
  }
  await trash.purge(id)
  trash.load()
  refreshStorageHint()
  toast.success('已清除')
}

async function purgeAllTrash() {
  if (!confirm('清空回收站？不可恢复')) return
  const prefixes = ['characters_','worldview_','worldSettings_','corpus_','events_','snapshots_','focusDraft_','editorPos_','chapterSummary_','chat_','volumes_']
  for (const item of trash.items.value || []) {
    for (const p of prefixes) {
      try { localStorage.removeItem(p + item.id) } catch { /* ignore */ }
    }
  }
  await trash.purgeAll()
  trash.load()
  refreshStorageHint()
  toast.success('回收站已空')
}

async function buildFullPayload({ safe = true } = {}) {
  await flushStorage()
  await load()
  const keys = [
    'novels',
    'officialApiConfig',
    'customApiConfig',
    'apiConfigType',
    'apiConfig',
    'writingGoals',
    'novelGenres',
    'prompts',
    'billing_records',
    'token_usage_stats',
    'writing91_prefs',
    'model_profiles'
  ]
  let data = {}
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k)
      if (v != null) data[k] = v
    } catch {
      /* ignore */
    }
  }
  data.novels = JSON.stringify(novels.value)
  if (safe) data = redactSecretsInData(data)
  return {
    type: 'writing91-full-backup',
    version: 2,
    safe: !!safe,
    exportedAt: new Date().toISOString(),
    data
  }
}

async function uploadWebdav(safe = true) {
  if (!safe && !confirm('将把 API Key 等密钥上传到 WebDAV，确定？')) return
  busy.value = true
  try {
    webdav.load()
    if (!webdav.config.value.url) {
      toast.warning('请先在设置中配置 WebDAV')
      return
    }
    const payload = await buildFullPayload({ safe })
    await webdav.upload(payload)
    unlock('export_1')
    toast.success(safe ? '已上传安全备份' : '已上传完整备份（含密钥）')
  } catch (e) {
    toast.error(e?.message || '上传失败')
  } finally {
    busy.value = false
  }
}

/** Avoid wiping local secrets when remote safe backup has empty keys */
function mergeConfigValue(key, remoteRaw) {
  const secretKeys = new Set(['officialApiConfig', 'customApiConfig', 'apiConfig', 'webdav_config', 'model_profiles'])
  if (!secretKeys.has(key)) {
    localStorage.setItem(key, remoteRaw)
    return
  }
  try {
    const remote = JSON.parse(remoteRaw)
    const localRaw = localStorage.getItem(key)
    const local = localRaw ? JSON.parse(localRaw) : null
    if (Array.isArray(remote)) {
      // model_profiles: keep local if remote entries have empty keys
      if (!remote.length && local) return
      localStorage.setItem(key, remoteRaw)
      return
    }
    if (remote && typeof remote === 'object') {
      const merged = { ...(local && typeof local === 'object' ? local : {}), ...remote }
      // If remote blanked secrets, keep local secrets
      if (!remote.apiKey && local?.apiKey) merged.apiKey = local.apiKey
      if (!remote.password && local?.password) merged.password = local.password
      localStorage.setItem(key, JSON.stringify(merged))
      return
    }
  } catch {
    /* fall through */
  }
  localStorage.setItem(key, remoteRaw)
}

async function downloadWebdav() {
  busy.value = true
  try {
    webdav.load()
    if (!webdav.config.value.url) {
      toast.warning('请先在设置中配置 WebDAV')
      return
    }
    const json = await webdav.download()
    let incoming = []
    let pendingConfig = null
    // Parse only — never write config until user confirms import
    if (json?.type === 'writing91-full-backup' && json.data) {
      pendingConfig = json.data
      if (json.data.novels) {
        incoming =
          typeof json.data.novels === 'string'
            ? JSON.parse(json.data.novels)
            : json.data.novels
      }
    } else if (json?.type === 'writing91-novels' && Array.isArray(json.novels)) {
      incoming = json.novels
    } else if (Array.isArray(json?.novels)) {
      incoming = json.novels
    } else if (Array.isArray(json)) {
      incoming = json
    } else {
      throw new Error('无法识别的远程备份')
    }
    if (!Array.isArray(incoming)) incoming = []
    pendingImport.value = {
      count: incoming.length,
      sample: incoming.slice(0, 5).map((n) => n?.title || '未命名'),
      novels: incoming,
      source: 'webdav',
      config: pendingConfig,
      safe: !!json?.safe
    }
    importConfigToo.value = !!(pendingConfig && !json?.safe)
    toast.info(
      json?.safe
        ? '已拉取安全备份，请确认合并作品（配置默认不导入）'
        : '已拉取，请确认合并导入'
    )
  } catch (e) {
    toast.error(e?.message || '下载失败')
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await load()
  loadSlots()
  trash.load()
  autoMeta.value = getAutoBackupMeta()
  runDailyAutoBackup(novels.value).then((m) => {
    if (m) autoMeta.value = m
  })
  refreshStorageHint()
})
</script>
