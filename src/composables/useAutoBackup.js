/**
 * Daily auto-backup of novels into localStorage key auto_backup_v1 (IDB via storage patch).
 */
import { flushStorage } from '../services/storage.js'

const META = 'auto_backup_meta'
const DATA = 'auto_backup_v1'

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function runDailyAutoBackup(novels) {
  try {
    const meta = JSON.parse(localStorage.getItem(META) || '{}')
    if (meta.date === today() && meta.count != null) return meta
    const payload = {
      type: 'writing91-auto-backup',
      version: 1,
      date: today(),
      exportedAt: new Date().toISOString(),
      novels: novels || JSON.parse(localStorage.getItem('novels') || '[]')
    }
    localStorage.setItem(DATA, JSON.stringify(payload))
    const next = { date: today(), count: (payload.novels || []).length, at: payload.exportedAt }
    localStorage.setItem(META, JSON.stringify(next))
    await flushStorage()
    return next
  } catch (e) {
    console.warn('auto backup failed', e)
    return null
  }
}

export function getAutoBackupMeta() {
  try {
    return JSON.parse(localStorage.getItem(META) || 'null')
  } catch {
    return null
  }
}

export function getAutoBackupPayload() {
  try {
    return JSON.parse(localStorage.getItem(DATA) || 'null')
  } catch {
    return null
  }
}
