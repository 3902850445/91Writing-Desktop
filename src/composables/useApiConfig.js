/**
 * API config — same localStorage keys as legacy (officialApiConfig / customApiConfig).
 */
import { ref, computed } from 'vue'
import apiService from '../services/api.js'

const OFFICIAL_BASE = 'https://ai.91hub.vip/v1'

const official = ref({
  apiKey: '',
  baseURL: OFFICIAL_BASE,
  selectedModel: 'claude-4-sonnet',
  maxTokens: 4096,
  temperature: 0.7
})

const custom = ref({
  apiKey: '',
  baseURL: 'https://api.openai.com/v1',
  selectedModel: 'gpt-3.5-turbo',
  maxTokens: 4096,
  temperature: 0.7
})

const configType = ref('official') // official | custom
const ready = ref(false)

function load() {
  // Always rebuild from storage so import/reset cannot leave stale secrets in memory
  const officialDefaults = {
    apiKey: '',
    baseURL: OFFICIAL_BASE,
    selectedModel: 'claude-4-sonnet',
    maxTokens: 4096,
    temperature: 0.7
  }
  const customDefaults = {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    selectedModel: 'gpt-3.5-turbo',
    maxTokens: 4096,
    temperature: 0.7
  }
  try {
    configType.value = localStorage.getItem('apiConfigType') || 'official'
    const o = localStorage.getItem('officialApiConfig')
    official.value = o
      ? { ...officialDefaults, ...JSON.parse(o), baseURL: OFFICIAL_BASE }
      : { ...officialDefaults }
    const c = localStorage.getItem('customApiConfig')
    custom.value = c
      ? { ...customDefaults, ...JSON.parse(c) }
      : { ...customDefaults }
  } catch (e) {
    console.warn('load api config failed', e)
    official.value = { ...officialDefaults }
    custom.value = { ...customDefaults }
  }
  applyToService()
  ready.value = true
}

function current() {
  return configType.value === 'official' ? official.value : custom.value
}

function applyToService() {
  const cfg = current()
  // Runtime only — never rewrite localStorage from apply path (prevents config pollution)
  apiService.updateConfig(
    {
      apiKey: cfg.apiKey || '',
      baseURL: (cfg.baseURL || '').replace(/\/$/, ''),
      selectedModel: cfg.selectedModel,
      defaultModel: cfg.selectedModel,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature
    },
    { persist: false }
  )
}

function save() {
  try {
    localStorage.setItem('apiConfigType', configType.value)
    localStorage.setItem(
      'officialApiConfig',
      JSON.stringify({ ...official.value, baseURL: OFFICIAL_BASE })
    )
    localStorage.setItem('customApiConfig', JSON.stringify(custom.value))
    // legacy key
    localStorage.setItem('apiConfig', JSON.stringify(current()))
  } catch (e) {
    console.error('save api config failed', e)
    throw e
  }
  applyToService()
}

export function useApiConfig() {
  if (!ready.value) load()

  const isConfigured = computed(() => {
    const c = current()
    return !!(c.apiKey && c.apiKey.trim() && c.baseURL && c.baseURL.trim())
  })

  const active = computed(() => current())

  function setType(type) {
    configType.value = type === 'custom' ? 'custom' : 'official'
    save()
  }

  function updateOfficial(patch) {
    official.value = {
      ...official.value,
      ...patch,
      baseURL: OFFICIAL_BASE
    }
    save()
  }

  function updateCustom(patch) {
    custom.value = { ...custom.value, ...patch }
    save()
  }

  function updateActive(patch) {
    if (configType.value === 'official') updateOfficial(patch)
    else updateCustom(patch)
  }

  /** Fetch OpenAI-compatible /models list */
  async function fetchModels() {
    applyToService()
    const cfg = current()
    if (!cfg.apiKey || !cfg.baseURL) {
      throw new Error('请先配置 API Key 与地址')
    }
    const base = (cfg.baseURL || '').replace(/\/$/, '')
    const res = await fetch(`${base}/models`, {
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`拉取模型失败: ${res.status} ${t.slice(0, 120)}`)
    }
    const data = await res.json()
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : []
    return list
      .map((m) => m.id || m.name || m.model || '')
      .filter(Boolean)
      .sort()
  }

  const COMMON_MODELS = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-3.5-turbo',
    'claude-3-5-sonnet',
    'claude-4-sonnet',
    'deepseek-chat',
    'deepseek-reasoner',
    'gemini-2.0-flash'
  ]

  return {
    official,
    custom,
    configType,
    active,
    isConfigured,
    ready,
    load,
    save,
    setType,
    updateOfficial,
    updateCustom,
    updateActive,
    applyToService,
    fetchModels,
    COMMON_MODELS
  }
}
