/**
 * Optional WebDAV sync for full backup JSON — key webdav_config
 * Uses Basic auth + PUT/GET (OpenAI-style not required; plain WebDAV).
 */
import { ref } from 'vue'
import { flushStorage } from '../services/storage.js'

const KEY = 'webdav_config'
const config = ref({
  url: '', // e.g. https://dav.example.com/remote.php/dav/files/user/writing91-full.json
  username: '',
  password: '',
  enabled: false
})
let loaded = false

function load() {
  const defaults = {
    url: '',
    username: '',
    password: '',
    enabled: false
  }
  try {
    const raw = localStorage.getItem(KEY)
    config.value = raw
      ? { ...defaults, ...JSON.parse(raw) }
      : { ...defaults }
  } catch {
    config.value = { ...defaults }
  }
  loaded = true
}

async function save() {
  localStorage.setItem(KEY, JSON.stringify(config.value))
  await flushStorage()
}

function authHeader() {
  const u = config.value.username || ''
  const p = config.value.password || ''
  if (!u && !p) return {}
  const token = btoa(unescape(encodeURIComponent(`${u}:${p}`)))
  return { Authorization: `Basic ${token}` }
}

export function useWebDav() {
  if (!loaded) load()

  async function updateConfig(patch) {
    config.value = { ...config.value, ...patch }
    await save()
  }

  async function upload(payload) {
    const url = (config.value.url || '').trim()
    if (!url) throw new Error('请填写 WebDAV 文件 URL')
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        ...authHeader()
      },
      body
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`上传失败 ${res.status} ${t.slice(0, 120)}`)
    }
    return true
  }

  async function download() {
    const url = (config.value.url || '').trim()
    if (!url) throw new Error('请填写 WebDAV 文件 URL')
    const res = await fetch(url, {
      method: 'GET',
      headers: { ...authHeader() }
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`下载失败 ${res.status} ${t.slice(0, 120)}`)
    }
    const text = await res.text()
    return JSON.parse(text)
  }

  return { config, load, updateConfig, upload, download, save }
}
