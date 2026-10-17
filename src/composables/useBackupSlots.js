/**
 * Multiple local backup slots (max 7) — key backup_slots
 */
import { ref } from 'vue'
import { flushStorage } from '../services/storage.js'

const KEY = 'backup_slots'
const MAX = 7
const slots = ref([])
let loaded = false

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    slots.value = raw ? JSON.parse(raw) : []
    if (!Array.isArray(slots.value)) slots.value = []
  } catch {
    slots.value = []
  }
  loaded = true
}

async function save() {
  if (slots.value.length > MAX) slots.value = slots.value.slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(slots.value))
  await flushStorage()
}

export function useBackupSlots() {
  if (!loaded) load()

  async function createSlot(label, payload) {
    load()
    const slot = {
      id: `slot_${Date.now().toString(36)}`,
      label: label || `备份 ${new Date().toLocaleString('zh-CN')}`,
      createdAt: new Date().toISOString(),
      novelCount: Array.isArray(payload?.novels) ? payload.novels.length : 0,
      payload
    }
    slots.value.unshift(slot)
    await save()
    return slot
  }

  async function removeSlot(id) {
    load()
    slots.value = slots.value.filter((s) => String(s.id) !== String(id))
    await save()
  }

  function getSlot(id) {
    load()
    return slots.value.find((s) => String(s.id) === String(id)) || null
  }

  return { slots, load, createSlot, removeSlot, getSlot, MAX }
}
