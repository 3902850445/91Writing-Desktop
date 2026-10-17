/**
 * Per-novel extras: characters / worldview / corpus / events.
 * Keys: characters_{id}, worldview_{id}, corpus_{id}, events_{id}
 * (worldview key also tries worldSettings_{id} legacy if present)
 */
import { ref } from 'vue'
import { flushStorage } from '../services/storage.js'

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

function readKey(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

async function writeKey(key, list) {
  localStorage.setItem(key, JSON.stringify(list))
  await flushStorage()
}

export function useNovelExtras(novelIdRef) {
  const characters = ref([])
  const worldview = ref([])
  const corpus = ref([])
  const events = ref([])

  function nid() {
    return typeof novelIdRef === 'object' ? novelIdRef.value : novelIdRef
  }

  function keys() {
    const id = nid()
    return {
      characters: `characters_${id}`,
      worldview: `worldview_${id}`,
      corpus: `corpus_${id}`,
      events: `events_${id}`
    }
  }

  function loadAll() {
    const id = nid()
    if (!id) {
      characters.value = []
      worldview.value = []
      corpus.value = []
      events.value = []
      return
    }
    const k = keys()
    characters.value = readKey(k.characters)
    // legacy fallback
    let wv = readKey(k.worldview)
    if (!wv.length) wv = readKey(`worldSettings_${id}`)
    worldview.value = wv
    corpus.value = readKey(k.corpus)
    events.value = readKey(k.events)
  }

  async function saveCharacters(list) {
    characters.value = list
    await writeKey(keys().characters, list)
  }
  async function saveWorldview(list) {
    worldview.value = list
    await writeKey(keys().worldview, list)
  }
  async function saveCorpus(list) {
    corpus.value = list
    await writeKey(keys().corpus, list)
  }
  async function saveEvents(list) {
    events.value = list
    await writeKey(keys().events, list)
  }

  async function addItem(kind, payload) {
    const item = {
      id: uid(kind.slice(0, 1)),
      title: payload.title || payload.name || '未命名',
      name: payload.name || payload.title || '未命名',
      content: payload.content || payload.description || '',
      description: payload.description || payload.content || '',
      type: payload.type || '',
      date: payload.date || '',
      createdAt: new Date().toISOString()
    }
    if (kind === 'characters') await saveCharacters([item, ...characters.value])
    if (kind === 'worldview') await saveWorldview([item, ...worldview.value])
    if (kind === 'corpus') await saveCorpus([item, ...corpus.value])
    if (kind === 'events') await saveEvents([item, ...events.value])
    return item
  }

  async function removeItem(kind, id) {
    const filt = (arr) => arr.filter((x) => String(x.id) !== String(id))
    if (kind === 'characters') await saveCharacters(filt(characters.value))
    if (kind === 'worldview') await saveWorldview(filt(worldview.value))
    if (kind === 'corpus') await saveCorpus(filt(corpus.value))
    if (kind === 'events') await saveEvents(filt(events.value))
  }

  async function updateItem(kind, id, patch) {
    const map = (arr) =>
      arr.map((x) => (String(x.id) === String(id) ? { ...x, ...patch, id: x.id } : x))
    if (kind === 'characters') await saveCharacters(map(characters.value))
    if (kind === 'worldview') await saveWorldview(map(worldview.value))
    if (kind === 'corpus') await saveCorpus(map(corpus.value))
    if (kind === 'events') await saveEvents(map(events.value))
  }

  /** Compact context block for AI prompts */
  function buildContextSummary(maxLen = 1200) {
    const parts = []
    if (characters.value.length) {
      parts.push(
        '【角色】' +
          characters.value
            .slice(0, 8)
            .map((c) => `${c.name || c.title}:${(c.description || c.content || '').slice(0, 80)}`)
            .join('；')
      )
    }
    if (worldview.value.length) {
      parts.push(
        '【世界观】' +
          worldview.value
            .slice(0, 6)
            .map((w) => `${w.title || w.name}:${(w.content || w.description || '').slice(0, 80)}`)
            .join('；')
      )
    }
    if (events.value.length) {
      parts.push(
        '【事件】' +
          events.value
            .slice(0, 6)
            .map((e) => `${e.date || ''} ${e.title}:${(e.content || '').slice(0, 60)}`)
            .join('；')
      )
    }
    if (corpus.value.length) {
      parts.push(
        '【语料参考】' +
          corpus.value
            .slice(0, 3)
            .map((c) => (c.content || '').slice(0, 100))
            .join(' | ')
      )
    }
    let s = parts.join('\n')
    if (s.length > maxLen) s = s.slice(0, maxLen) + '…'
    return s
  }

  return {
    characters,
    worldview,
    corpus,
    events,
    loadAll,
    addItem,
    removeItem,
    updateItem,
    buildContextSummary
  }
}
