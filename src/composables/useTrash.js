/**
 * Soft-delete trash for novels — key trash_novels
 */
import { ref } from 'vue'
import { flushStorage } from '../services/storage.js'

const KEY = 'trash_novels'
const MAX = 50
const items = ref([])
let loaded = false

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    items.value = raw ? JSON.parse(raw) : []
    if (!Array.isArray(items.value)) items.value = []
  } catch {
    items.value = []
  }
  loaded = true
}

async function save() {
  if (items.value.length > MAX) items.value = items.value.slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(items.value))
  await flushStorage()
}

export function useTrash() {
  if (!loaded) load()

  async function softDelete(novel) {
    if (!novel) return
    load()
    items.value.unshift({
      ...JSON.parse(JSON.stringify(novel)),
      _trashedAt: new Date().toISOString()
    })
    await save()
  }

  async function restore(id) {
    load()
    const idx = items.value.findIndex((n) => String(n.id) === String(id))
    if (idx < 0) return null
    const [n] = items.value.splice(idx, 1)
    await save()
    delete n._trashedAt
    return n
  }

  async function purge(id) {
    load()
    items.value = items.value.filter((n) => String(n.id) !== String(id))
    await save()
  }

  async function purgeAll() {
    items.value = []
    await save()
  }

  function list() {
    load()
    return items.value
  }

  return { items, load, softDelete, restore, purge, purgeAll, list }
}
