/**
 * Multiple API model profiles for quick switch — key model_profiles
 */
import { ref, computed } from 'vue'
import { flushStorage } from '../services/storage.js'
import { useApiConfig } from './useApiConfig.js'

const KEY = 'model_profiles'
const profiles = ref([])
const activeId = ref('')
let loaded = false

function uid() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    profiles.value = raw ? JSON.parse(raw) : []
    if (!Array.isArray(profiles.value)) profiles.value = []
    activeId.value = localStorage.getItem('model_profile_active') || ''
  } catch {
    profiles.value = []
  }
  loaded = true
}

async function save() {
  localStorage.setItem(KEY, JSON.stringify(profiles.value))
  localStorage.setItem('model_profile_active', activeId.value || '')
  await flushStorage()
}

export function useModelProfiles() {
  if (!loaded) load()
  const { updateCustom, setType, custom } = useApiConfig()

  const active = computed(
    () => profiles.value.find((p) => String(p.id) === String(activeId.value)) || null
  )

  async function upsert(profile) {
    load()
    const p = {
      id: profile.id || uid(),
      name: profile.name || '未命名',
      apiKey: profile.apiKey || '',
      baseURL: (profile.baseURL || '').replace(/\/$/, ''),
      selectedModel: profile.selectedModel || '',
      temperature: profile.temperature ?? 0.7,
      maxTokens: profile.maxTokens ?? 4096
    }
    const i = profiles.value.findIndex((x) => String(x.id) === String(p.id))
    if (i >= 0) profiles.value[i] = p
    else profiles.value.push(p)
    await save()
    return p
  }

  async function remove(id) {
    profiles.value = profiles.value.filter((p) => String(p.id) !== String(id))
    if (String(activeId.value) === String(id)) activeId.value = ''
    await save()
  }

  async function activate(id) {
    const p = profiles.value.find((x) => String(x.id) === String(id))
    if (!p) return false
    activeId.value = p.id
    setType('custom')
    updateCustom({
      apiKey: p.apiKey,
      baseURL: p.baseURL,
      selectedModel: p.selectedModel,
      temperature: p.temperature,
      maxTokens: p.maxTokens
    })
    // updateCustom already persists + applyToService via save()
    await save()
    return true
  }

  /** Snapshot current custom config as a profile */
  async function saveCurrentAs(name) {
    const c = custom.value
    return upsert({
      name: name || c.selectedModel || '当前配置',
      apiKey: c.apiKey,
      baseURL: c.baseURL,
      selectedModel: c.selectedModel,
      temperature: c.temperature,
      maxTokens: c.maxTokens
    })
  }

  return {
    profiles,
    activeId,
    active,
    load,
    upsert,
    remove,
    activate,
    saveCurrentAs
  }
}
