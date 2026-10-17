<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>设置</h1>
        <p>API · 显示 · 关于</p>
      </div>
    </header>

    <div class="m-section-title">显示</div>
    <div class="m-card" style="margin-bottom: 16px">
      <div class="m-segment" style="margin-bottom: 12px">
        <button type="button" :class="{ 'is-active': prefs.theme === 'dark' }" @click="setTheme('dark')">
          深色
        </button>
        <button type="button" :class="{ 'is-active': prefs.theme === 'light' }" @click="setTheme('light')">
          浅色
        </button>
      </div>
      <div class="m-field">
        <label>编辑字号（{{ prefs.fontSize }}px）</label>
        <input
          :value="prefs.fontSize"
          class="m-input"
          type="range"
          min="14"
          max="24"
          step="1"
          @input="setFontSize(Number($event.target.value))"
        />
      </div>
      <div class="m-field">
        <label>行距（{{ prefs.lineHeight }}）</label>
        <input
          :value="prefs.lineHeight"
          class="m-input"
          type="range"
          min="1.4"
          max="2.2"
          step="0.05"
          @input="setLineHeight(Number($event.target.value))"
        />
      </div>
      <div class="m-field">
        <label>AI 上下文长度（{{ prefs.contextChars }} 字）</label>
        <input
          :value="prefs.contextChars"
          class="m-input"
          type="range"
          min="800"
          max="8000"
          step="200"
          @input="setContextChars(Number($event.target.value))"
        />
        <span class="m-hint">续写/润色时带入的正文末尾长度</span>
      </div>
      <label class="m-hint" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
        <input
          type="checkbox"
          :checked="prefs.includePrevChapter"
          @change="setIncludePrevChapter($event.target.checked)"
        />
        续写时附带上一章片段
      </label>
      <label class="m-hint" style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px">
        <input
          type="checkbox"
          :checked="prefs.preferChapterSummary"
          @change="setPreferChapterSummary($event.target.checked)"
        />
        优先使用 AI 章节摘要（若已生成）
      </label>
      <label class="m-hint" style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px">
        <input
          type="checkbox"
          :checked="prefs.showSessionStats"
          @change="setShowSessionStats($event.target.checked)"
        />
        写作页显示本次字数 / 用时
      </label>
      <div class="m-field">
        <label>专注计时（番茄钟）</label>
        <select
          class="m-select"
          :value="prefs.pomodoroMinutes"
          @change="setPomodoroMinutes(Number($event.target.value))"
        >
          <option :value="0">关闭</option>
          <option :value="15">15 分钟</option>
          <option :value="25">25 分钟</option>
          <option :value="45">45 分钟</option>
        </select>
      </div>
      <div class="m-field">
        <label>本章目标字数（0 关闭，{{ prefs.chapterWordGoal || 0 }}）</label>
        <input
          :value="prefs.chapterWordGoal || 0"
          class="m-input"
          type="range"
          min="0"
          max="8000"
          step="100"
          @input="setChapterWordGoal(Number($event.target.value))"
        />
        <span class="m-hint">写作页显示本章进度条</span>
      </div>
      <div class="m-field">
        <label>自动保存间隔（{{ prefs.autosaveMs || 800 }} ms）</label>
        <input
          :value="prefs.autosaveMs || 800"
          class="m-input"
          type="range"
          min="400"
          max="2500"
          step="100"
          @input="setAutosaveMs(Number($event.target.value))"
        />
      </div>
      <div class="m-field">
        <label>写作纸感</label>
        <div class="m-segment">
          <button
            type="button"
            :class="{ 'is-active': (prefs.writerPaper || 'default') === 'default' }"
            @click="setWriterPaper('default')"
          >
            默认
          </button>
          <button
            type="button"
            :class="{ 'is-active': prefs.writerPaper === 'parchment' }"
            @click="setWriterPaper('parchment')"
          >
            羊皮纸
          </button>
          <button
            type="button"
            :class="{ 'is-active': prefs.writerPaper === 'night' }"
            @click="setWriterPaper('night')"
          >
            夜墨
          </button>
        </div>
      </div>
    </div>

    <div class="m-section-title">API 配置</div>
    <div class="m-card" style="margin-bottom: 16px">
      <div class="m-segment" style="margin-bottom: 14px">
        <button
          type="button"
          :class="{ 'is-active': configType === 'official' }"
          @click="setType('official')"
        >
          官方
        </button>
        <button
          type="button"
          :class="{ 'is-active': configType === 'custom' }"
          @click="setType('custom')"
        >
          自定义
        </button>
      </div>

      <div class="m-field">
        <label>API Key</label>
        <input
          v-model="form.apiKey"
          class="m-input"
          type="password"
          autocomplete="off"
          placeholder="sk-…"
        />
      </div>

      <div v-if="configType === 'custom'" class="m-field">
        <label>Base URL</label>
        <input
          v-model="form.baseURL"
          class="m-input"
          type="url"
          placeholder="https://api.openai.com/v1"
        />
        <span class="m-hint">OpenAI 兼容接口，路径需含 /v1（按服务商要求）</span>
        <span
          v-if="form.baseURL && form.baseURL.trim().toLowerCase().startsWith('http:')"
          class="m-danger-text"
          style="display: block; margin-top: 6px"
        >
          正在使用 HTTP（非加密）。局域网自建代理可用；公网请优先 HTTPS。
        </span>
      </div>
      <div v-else class="m-field">
        <label>Base URL</label>
        <input class="m-input" :value="form.baseURL" disabled />
        <span class="m-hint">官方通道地址固定</span>
      </div>

      <div class="m-field">
        <label>模型</label>
        <input v-model="form.selectedModel" class="m-input" list="model-list" placeholder="gpt-3.5-turbo" />
        <datalist id="model-list">
          <option v-for="m in modelOptions" :key="m" :value="m" />
        </datalist>
        <div class="m-chips" style="margin-top: 8px; padding-bottom: 0">
          <button
            v-for="m in COMMON_MODELS.slice(0, 6)"
            :key="m"
            type="button"
            class="m-chip"
            :class="{ 'is-active': form.selectedModel === m }"
            @click="form.selectedModel = m"
          >
            {{ m }}
          </button>
        </div>
        <button
          type="button"
          class="m-btn m-btn--ghost m-btn--sm"
          style="margin-top: 8px"
          :disabled="loadingModels"
          @click="loadModels"
        >
          {{ loadingModels ? '拉取中…' : '从接口拉取模型列表' }}
        </button>
      </div>

      <div class="m-field">
        <label>Temperature（{{ form.temperature }}）</label>
        <input
          v-model.number="form.temperature"
          class="m-input"
          type="number"
          min="0"
          max="2"
          step="0.1"
        />
      </div>

      <div class="m-field">
        <label>Max Tokens（可选）</label>
        <input
          v-model.number="form.maxTokens"
          class="m-input"
          type="number"
          min="0"
          step="256"
          placeholder="4096"
        />
      </div>

      <div class="m-btn-row">
        <button type="button" class="m-btn m-btn--ghost" :disabled="testing" @click="testApi">
          {{ testing ? '测试中…' : '测试连接' }}
        </button>
        <button type="button" class="m-btn m-btn--primary" @click="save">保存</button>
      </div>

      <p class="m-hint" style="margin-top: 12px">
        状态：
        <strong :style="{ color: isConfigured ? 'var(--success)' : 'var(--warning)' }">
          {{ isConfigured ? '已配置' : '未配置' }}
        </strong>
      </p>
    </div>

    <div class="m-section-title">WebDAV 同步（可选）</div>
    <div class="m-card" style="margin-bottom: 16px">
      <p class="m-hint" style="margin: 0 0 10px">
        填写完整文件 URL（含文件名）。密码仅存本机。建议使用 HTTPS。
      </p>
      <label class="m-hint" style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px">
        <input type="checkbox" :checked="webdavEnabled" @change="toggleWebdav($event.target.checked)" />
        启用 WebDAV
      </label>
      <div class="m-field">
        <label>文件 URL</label>
        <input v-model="webdavForm.url" class="m-input" placeholder="https://…/writing91-full.json" />
      </div>
      <div class="m-field">
        <label>用户名</label>
        <input v-model="webdavForm.username" class="m-input" autocomplete="off" />
      </div>
      <div class="m-field">
        <label>密码</label>
        <input v-model="webdavForm.password" class="m-input" type="password" autocomplete="off" />
      </div>
      <button type="button" class="m-btn m-btn--primary m-btn--block" @click="saveWebdav">保存 WebDAV</button>
    </div>

    <div class="m-section-title">应用锁</div>
    <div class="m-card" style="margin-bottom: 16px">
      <label class="m-hint" style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px">
        <input type="checkbox" :checked="appLockOn" @change="toggleAppLock($event.target.checked)" />
        启动时要求解锁（PIN）
      </label>
      <div v-if="appLockOn" class="m-field">
        <label>设置 / 修改 PIN（4～8 位数字）</label>
        <input v-model="appLockPin" class="m-input" type="password" inputmode="numeric" maxlength="8" />
        <button type="button" class="m-btn m-btn--ghost m-btn--block" style="margin-top: 8px" @click="saveAppLockPin">
          保存 PIN
        </button>
      </div>
    </div>

    <div class="m-section-title">模型档案（快切）</div>
    <div class="m-card" style="margin-bottom: 16px">
      <p class="m-hint" style="margin: 0 0 10px">保存多套自定义 API，写作页可快速切换。</p>
      <div class="m-field">
        <label>档案名称</label>
        <input v-model="profileName" class="m-input" placeholder="如 DeepSeek / 本地" />
      </div>
      <button type="button" class="m-btn m-btn--primary m-btn--block" @click="saveProfile">
        将当前自定义配置存为档案
      </button>
      <div v-for="p in profiles" :key="p.id" class="m-row-between" style="margin-top: 10px; gap: 8px">
        <button type="button" class="m-btn m-btn--ghost m-btn--sm" style="flex: 1" @click="switchProfile(p.id)">
          {{ p.name }}{{ String(p.id) === String(activeProfileId) ? ' · 使用中' : '' }}
        </button>
        <button type="button" class="m-btn m-btn--danger m-btn--sm" @click="deleteProfile(p.id)">删</button>
      </div>
    </div>

    <div class="m-section-title">关于</div>
    <div class="m-card">
      <div class="m-row-between" style="margin-bottom: 8px">
        <span class="m-muted">应用</span>
        <span>91写作 Android</span>
      </div>
      <div class="m-row-between" style="margin-bottom: 8px">
        <span class="m-muted">版本</span>
        <span>{{ appVersion }}</span>
      </div>
      <div class="m-row-between" style="margin-bottom: 8px">
        <span class="m-muted">界面</span>
        <span>移动端 v2.7.2</span>
      </div>
      <div class="m-row-between">
        <span class="m-muted">数据</span>
        <span>仅本地存储</span>
      </div>
      <p class="m-hint" style="margin-top: 12px">
        AI 请求发往你配置的接口；作品数据默认只存本机。
      </p>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch, onMounted, computed } from 'vue'
import { useApiConfig } from '../../composables/useApiConfig.js'
import { usePrefs } from '../../composables/usePrefs.js'
import { useModelProfiles } from '../../composables/useModelProfiles.js'
import { useWebDav } from '../../composables/useWebDav.js'
import apiService from '../../services/api.js'
import toast from '../../services/toast.js'
import { getNativeVersion, setAppLockEnabled } from '../../utils/bridge.js'
import { hashPin } from '../../utils/simpleHash.js'

const {
  configType,
  official,
  custom,
  isConfigured,
  setType,
  updateOfficial,
  updateCustom,
  applyToService,
  load,
  fetchModels,
  COMMON_MODELS
} = useApiConfig()

const {
  prefs,
  setTheme,
  setFontSize,
  setLineHeight,
  setContextChars,
  setIncludePrevChapter,
  setShowSessionStats,
  setPomodoroMinutes,
  setPreferChapterSummary,
  setWriterPaper,
  setChapterWordGoal,
  setAutosaveMs
} = usePrefs()

const {
  profiles,
  activeId: activeProfileId,
  saveCurrentAs,
  activate: activateProfile,
  remove: removeProfile,
  load: loadProfiles
} = useModelProfiles()
const profileName = ref('')
const webdav = useWebDav()
const webdavEnabled = computed(() => !!webdav.config.value.enabled)
const webdavForm = reactive({
  url: '',
  username: '',
  password: ''
})
const appLockOn = ref(false)
const appLockPin = ref('')

const remoteModels = ref([])
const loadingModels = ref(false)
const modelOptions = computed(() => {
  const set = new Set([...(remoteModels.value || []), ...COMMON_MODELS])
  return [...set]
})

const form = reactive({
  apiKey: '',
  baseURL: '',
  selectedModel: '',
  temperature: 0.7,
  maxTokens: 4096
})

const testing = ref(false)
const appVersion = ref(getNativeVersion() || '2.2.0-web')

function syncForm() {
  const src = configType.value === 'official' ? official.value : custom.value
  form.apiKey = src.apiKey || ''
  form.baseURL = src.baseURL || ''
  form.selectedModel = src.selectedModel || ''
  form.temperature = src.temperature ?? 0.7
  form.maxTokens = src.maxTokens ?? 4096
}

function save() {
  const patch = {
    apiKey: form.apiKey.trim(),
    selectedModel: form.selectedModel.trim(),
    temperature: Number(form.temperature) || 0.7,
    maxTokens: form.maxTokens ? Number(form.maxTokens) : null
  }
  if (configType.value === 'custom') {
    patch.baseURL = (form.baseURL || '').trim().replace(/\/$/, '')
    updateCustom(patch)
  } else {
    updateOfficial(patch)
  }
  syncForm()
  toast.success('已保存')
}

async function loadModels() {
  loadingModels.value = true
  try {
    save()
    const list = await fetchModels()
    remoteModels.value = list
    toast.success(`已获取 ${list.length} 个模型`)
  } catch (e) {
    toast.error(e?.message || '拉取失败')
  } finally {
    loadingModels.value = false
  }
}

async function testApi() {
  save()
  applyToService()
  testing.value = true
  try {
    const text = await apiService.generateText('请只回复：ok', {
      maxTokens: 16,
      type: 'test'
    })
    toast.success('连接成功：' + String(text || '').slice(0, 40))
  } catch (e) {
    toast.error(e?.message || '连接失败')
  } finally {
    testing.value = false
  }
}

async function saveProfile() {
  if (configType.value !== 'custom') {
    toast.warning('请先切换到自定义并保存配置')
    return
  }
  save()
  const p = await saveCurrentAs(profileName.value.trim() || form.selectedModel || '档案')
  loadProfiles()
  profileName.value = ''
  toast.success(`已保存档案「${p.name}」`)
}

async function switchProfile(id) {
  const ok = await activateProfile(id)
  if (ok) {
    syncForm()
    toast.success('已切换档案')
  }
}

async function deleteProfile(id) {
  if (!confirm('删除该档案？')) return
  await removeProfile(id)
  loadProfiles()
  toast.success('已删除')
}

async function toggleWebdav(on) {
  await webdav.updateConfig({ enabled: !!on })
}

async function saveWebdav() {
  await webdav.updateConfig({
    url: webdavForm.url.trim(),
    username: webdavForm.username.trim(),
    password: webdavForm.password,
    enabled: true
  })
  toast.success('WebDAV 已保存')
}

function toggleAppLock(on) {
  appLockOn.value = !!on
  try {
    localStorage.setItem('app_lock_prefs', JSON.stringify({ enabled: appLockOn.value }))
  } catch {
    /* ignore */
  }
  setAppLockEnabled(appLockOn.value)
  if (!on) toast.info('已关闭应用锁')
  else toast.info('请设置 PIN')
}

function saveAppLockPin() {
  const pin = String(appLockPin.value || '').trim()
  if (!/^\d{4,8}$/.test(pin)) {
    toast.warning('PIN 需为 4～8 位数字')
    return
  }
  try {
    localStorage.setItem(
      'app_lock_prefs',
      JSON.stringify({ enabled: true, pinHash: hashPin(pin) })
    )
  } catch {
    toast.error('保存失败')
    return
  }
  appLockOn.value = true
  setAppLockEnabled(true)
  appLockPin.value = ''
  toast.success('PIN 已保存')
}

watch(configType, syncForm)
onMounted(() => {
  load()
  loadProfiles()
  webdav.load()
  webdavForm.url = webdav.config.value.url || ''
  webdavForm.username = webdav.config.value.username || ''
  webdavForm.password = webdav.config.value.password || ''
  try {
    const lock = JSON.parse(localStorage.getItem('app_lock_prefs') || '{}')
    appLockOn.value = !!lock.enabled
  } catch {
    appLockOn.value = false
  }
  syncForm()
  appVersion.value = getNativeVersion() || window.__WRITING91_VERSION__ || '2.7.2-web'
})
</script>
