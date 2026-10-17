/**
 * IndexedDB-backed storage for large writing data.
 *
 * - Migrates heavy localStorage keys into IndexedDB once
 * - Keeps an in-memory cache so existing sync localStorage call sites keep working
 * - Patches localStorage get/set/remove for managed keys after init
 *
 * Small config (API keys, UI prefs) stays in localStorage.
 */

import { error, warn, info, LogCategory } from '../utils/logger.js'

const DB_NAME = 'writing91-db'
const DB_VERSION = 1
const STORE = 'kv'
const META_MIGRATED = '__writing91_idb_migrated_v1'

/** Keys always stored in IndexedDB (large / growing). */
const MANAGED_KEYS = new Set([
  'novels',
  'novels_prev',
  'prompts',
  'writingGoals',
  'novelGenres',
  'novel_chapters',
  'shortStoryConfig',
  'billing_records',
  'token_usage_stats',
  'backup_list',
  'auto_backup_settings',
  'auto_backup_v1',
  'auto_backup_meta',
  'writing91_prefs',
  'writing91_recent_novels',
  'creationStudioSyncConfig',
  'customTemplates',
  'aiApiConfigs',
  'chapterSummaryPromptTemplate',
  'backup_slots',
  'trash_novels',
  'achievements_v1',
  'model_profiles',
  'webdav_config',
  'app_lock_prefs',
  'writing91_widget_stats'
])

/** Prefixes for per-novel payloads. */
const MANAGED_PREFIXES = [
  'characters_',
  'worldview_',
  'worldSettings_',
  'corpus_',
  'events_',
  'snapshots_',
  'focusDraft_',
  'backup_data_',
  'editorPos_',
  'chapterSummary_',
  'chat_',
  'volumes_'
]

/** Values larger than this (chars) are promoted to IDB even if key is unknown. */
const SIZE_PROMOTE_THRESHOLD = 80_000

let dbPromise = null
let ready = false
let readyPromise = null
const memory = new Map()
const pendingWrites = new Map()
let flushTimer = null
let origGetItem = null
let origSetItem = null
let origRemoveItem = null
let origClear = null
let origKey = null
let origLengthDesc = null
let persistRequested = false

function isManagedKey(key) {
  if (key == null) return false
  const k = String(key)
  if (MANAGED_KEYS.has(k)) return true
  return MANAGED_PREFIXES.some((p) => k.startsWith(p))
}

function shouldPromote(key, value) {
  if (isManagedKey(key)) return true
  if (value == null) return false
  // Never put API secrets into IDB promotion by size alone for unknown keys —
  // only promote known large content keys or explicit prefixes.
  return false
}

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
  })
  return dbPromise
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result ? req.result.value : null)
    req.onerror = () => reject(req.error)
  })
}

function idbSet(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).put({ key, value, updatedAt: Date.now() })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Apply multiple put/delete ops in a single readwrite transaction. */
function idbBatch(db, entries) {
  if (!entries.length) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const now = Date.now()
    for (const [key, op] of entries) {
      if (op === null) store.delete(key)
      else store.put({ key, value: op, updatedAt: now })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('IndexedDB batch failed'))
    tx.onabort = () => reject(tx.error || new Error('IndexedDB batch aborted'))
  })
}

function idbGetAllKeys(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAllKeys()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

function idbGetAll(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

function scheduleFlush(immediate = false) {
  if (immediate) {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    flushPending().catch((e) => console.warn('[storage] flush failed', e))
    return
  }
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushPending().catch((e) => console.warn('[storage] flush failed', e))
  }, 120)
}

/** Request persistent storage (reduce eviction risk on Android WebView). */
export async function requestPersist() {
  if (persistRequested || typeof navigator === 'undefined') return false
  persistRequested = true
  try {
    if (navigator.storage?.persist) {
      const ok = await navigator.storage.persist()
      console.info('[storage] persist:', ok)
      return ok
    }
  } catch (e) {
    console.warn('[storage] persist failed', e)
  }
  return false
}

async function flushPending() {
  if (!pendingWrites.size) return
  let db
  try {
    db = await openDb()
  } catch {
    return
  }
  const entries = [...pendingWrites.entries()]
  pendingWrites.clear()
  try {
    // One transaction for all pending keys — much faster on WebView
    await idbBatch(db, entries)
  } catch (e) {
    console.warn('[storage] batch write failed, falling back per-key', e)
    for (const [key, op] of entries) {
      try {
        if (op === null) await idbDelete(db, key)
        else await idbSet(db, key, op)
      } catch (err) {
        console.warn('[storage] write failed for', key, err)
        if (!pendingWrites.has(key)) pendingWrites.set(key, op)
      }
    }
  }
}

function collectLocalKeysToMigrate() {
  const keys = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (isManagedKey(k)) {
        keys.push(k)
        continue
      }
      try {
        const v = origGetItem ? origGetItem(k) : localStorage.getItem(k)
        if (v && v.length >= SIZE_PROMOTE_THRESHOLD && isManagedKey(k)) {
          keys.push(k)
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return keys
}

async function migrateFromLocalStorage(db) {
  const already = origGetItem
    ? origGetItem(META_MIGRATED)
    : localStorage.getItem(META_MIGRATED)
  // Always re-scan managed keys still living in localStorage (partial migrate / new keys)
  const keys = collectLocalKeysToMigrate()
  let migrated = 0
  for (const key of keys) {
    try {
      const raw = origGetItem ? origGetItem(key) : localStorage.getItem(key)
      if (raw == null) continue
      const existing = await idbGet(db, key)
      // Prefer newer / longer payload if both exist
      if (existing != null && existing.length >= raw.length) {
        // IDB already has equal/better data — free localStorage quota
        try {
          if (origRemoveItem) origRemoveItem(key)
          else localStorage.removeItem(key)
        } catch {
          /* ignore */
        }
        memory.set(key, existing)
        migrated++
        continue
      }
      await idbSet(db, key, raw)
      memory.set(key, raw)
      try {
        if (origRemoveItem) origRemoveItem(key)
        else localStorage.removeItem(key)
      } catch {
        /* quota / private mode */
      }
      migrated++
    } catch (e) {
      console.warn('[storage] migrate key failed', key, e)
    }
  }
  try {
    if (origSetItem) origSetItem(META_MIGRATED, String(Date.now()))
    else localStorage.setItem(META_MIGRATED, String(Date.now()))
  } catch {
    /* ignore */
  }
  if (!already) {
    console.info(`[storage] migrated ${migrated} keys localStorage → IndexedDB`)
  } else if (migrated) {
    console.info(`[storage] synced ${migrated} remaining localStorage keys → IndexedDB`)
  }
  return migrated
}

async function hydrateMemory(db) {
  const rows = await idbGetAll(db)
  for (const row of rows) {
    if (row && row.key != null) {
      memory.set(String(row.key), row.value == null ? null : String(row.value))
    }
  }
}

function patchLocalStorage() {
  if (typeof localStorage === 'undefined' || origGetItem) return

  origGetItem = localStorage.getItem.bind(localStorage)
  origSetItem = localStorage.setItem.bind(localStorage)
  origRemoveItem = localStorage.removeItem.bind(localStorage)
  origClear = localStorage.clear.bind(localStorage)
  origKey = localStorage.key.bind(localStorage)

  localStorage.getItem = (key) => {
    const k = String(key)
    if (ready && (memory.has(k) || isManagedKey(k))) {
      if (memory.has(k)) {
        const v = memory.get(k)
        return v == null ? null : v
      }
      return null
    }
    return origGetItem(k)
  }

  localStorage.setItem = (key, value) => {
    const k = String(key)
    const str = value == null ? 'null' : String(value)
    if (shouldPromote(k, str) || memory.has(k)) {
      memory.set(k, str)
      pendingWrites.set(k, str)
      // Critical large keys flush sooner
      // snapshots / auto_backup: flush ASAP; novels debounced (frequent autosave)
      const urgent = k.startsWith('snapshots_') || k === 'auto_backup_v1'
      scheduleFlush(urgent)
      try {
        origRemoveItem(k)
      } catch {
        /* ignore */
      }
      return
    }
    return origSetItem(k, str)
  }

  localStorage.removeItem = (key) => {
    const k = String(key)
    if (memory.has(k) || isManagedKey(k)) {
      memory.delete(k)
      pendingWrites.set(k, null)
      scheduleFlush()
      try {
        origRemoveItem(k)
      } catch {
        /* ignore */
      }
      return
    }
    return origRemoveItem(k)
  }

  // length/key are best-effort; rare callers
  try {
    origLengthDesc = Object.getOwnPropertyDescriptor(Storage.prototype, 'length')
  } catch {
    /* ignore */
  }
}

/**
 * Initialize IndexedDB storage and patch localStorage for large keys.
 * Safe to call multiple times; concurrent callers share one promise.
 */
export function initStorage() {
  info(LogCategory.STORAGE, 'initStorage called')
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    info(LogCategory.STORAGE, 'Initializing storage')
    patchLocalStorage()
    try {
      info(LogCategory.STORAGE, 'Opening IndexedDB')
      const db = await openDb()
      info(LogCategory.STORAGE, 'Migrating from localStorage')
      await migrateFromLocalStorage(db)
      info(LogCategory.STORAGE, 'Hydrating memory cache')
      await hydrateMemory(db)
      ready = true
      info(LogCategory.STORAGE, 'Flushing pending writes')
      await flushPending()
      requestPersist().catch((e) => {
        warn(LogCategory.STORAGE, 'Persist request failed', { error: e.message })
      })
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            flushPending()
          }
        })
        window.addEventListener('pagehide', () => {
          flushPending()
        })
      }
      info(LogCategory.STORAGE, 'Storage ready', {
        keyCount: memory.size
      })
    } catch (e) {
      warn(LogCategory.STORAGE, 'IndexedDB unavailable, falling back to localStorage only', {
        error: e.message
      }, e)
      ready = true
    }
    return ready
  })()
  return readyPromise
}

export function isStorageReady() {
  return ready
}

/** Explicit async API (preferred for new code). */
export async function getJSON(key, fallback = null) {
  await initStorage()
  try {
    const raw = localStorage.getItem(key)
    if (raw == null || raw === '') return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export async function setJSON(key, value) {
  await initStorage()
  localStorage.setItem(key, JSON.stringify(value))
  await flushPending()
}

export async function removeKey(key) {
  await initStorage()
  localStorage.removeItem(key)
  await flushPending()
}

/** Force flush pending IDB writes (e.g. before backup export). */
export async function flushStorage() {
  await flushPending()
}

/** List managed keys currently in memory/IDB (for diagnostics). */
export function listManagedKeys() {
  return [...memory.keys()]
}

/**
 * Best-effort storage usage snapshot for UI warnings.
 * @returns {Promise<{ usage:number, quota:number, usageRatio:number, managedBytes:number, novelsBytes:number }|null>}
 */
export async function estimateStorage() {
  let usage = 0
  let quota = 0
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      usage = Number(est.usage) || 0
      quota = Number(est.quota) || 0
    }
  } catch {
    /* ignore */
  }

  // Sum in-memory managed values (UTF-16 approx 2 bytes/char)
  let managedBytes = 0
  for (const v of memory.values()) {
    if (v != null) managedBytes += String(v).length * 2
  }
  let novelsBytes = 0
  try {
    const n = memory.has('novels')
      ? memory.get('novels')
      : localStorage.getItem('novels')
    if (n) novelsBytes = String(n).length * 2
  } catch {
    /* ignore */
  }

  if (!usage && managedBytes) usage = managedBytes
  const usageRatio = quota > 0 ? usage / quota : 0
  return { usage, quota, usageRatio, managedBytes, novelsBytes }
}

export default {
  initStorage,
  isStorageReady,
  getJSON,
  setJSON,
  removeKey,
  flushStorage,
  requestPersist,
  listManagedKeys,
  estimateStorage
}
