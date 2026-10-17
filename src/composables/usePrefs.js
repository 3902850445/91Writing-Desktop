/**
 * UI prefs — localStorage key writing91_prefs
 */
import { ref } from 'vue'

const KEY = 'writing91_prefs'
const prefs = ref({
  theme: 'dark',
  fontSize: 17,
  lineHeight: 1.75,
  readingMode: false,
  /** chars of chapter body sent as AI context tail */
  contextChars: 2500,
  /** include previous chapter summary when continuing */
  includePrevChapter: true,
  /** show session word count / elapsed in writer status */
  showSessionStats: true,
  /** 0 = off; otherwise pomodoro minutes */
  pomodoroMinutes: 0,
  /** prefer cached AI summary over raw tail for prev chapter */
  preferChapterSummary: true,
  /** writer paper style: default | parchment | night */
  writerPaper: 'default',
  /** default chapter word goal (0 = off) */
  chapterWordGoal: 0,
  /** autosave delay ms */
  autosaveMs: 800
})
let loaded = false

function load() {
  // Always re-read so backup import / external writes refresh UI (was no-op after first load)
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const defaults = {
        theme: 'dark',
        fontSize: 17,
        lineHeight: 1.75,
        readingMode: false,
        contextChars: 2500,
        includePrevChapter: true,
        showSessionStats: true,
        pomodoroMinutes: 0,
        preferChapterSummary: true,
        writerPaper: 'default',
        chapterWordGoal: 0,
        autosaveMs: 800
      }
      prefs.value = { ...defaults, ...JSON.parse(raw) }
    }
  } catch {
    /* ignore */
  }
  loaded = true
  applyTheme()
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs.value))
  } catch {
    /* ignore */
  }
  applyTheme()
}

function applyTheme() {
  if (typeof document === 'undefined') return
  const t = prefs.value.theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.style.setProperty(
    '--editor-font-size',
    `${prefs.value.fontSize || 17}px`
  )
  document.documentElement.style.setProperty(
    '--editor-line-height',
    String(prefs.value.lineHeight || 1.75)
  )
  document.documentElement.setAttribute(
    'data-writer-paper',
    prefs.value.writerPaper || 'default'
  )
}

export function usePrefs() {
  load()

  function setTheme(theme) {
    prefs.value.theme = theme === 'light' ? 'light' : 'dark'
    save()
  }

  function setFontSize(n) {
    prefs.value.fontSize = Math.min(28, Math.max(14, Number(n) || 17))
    save()
  }

  function setLineHeight(n) {
    prefs.value.lineHeight = Math.min(2.4, Math.max(1.3, Number(n) || 1.75))
    save()
  }

  function setContextChars(n) {
    prefs.value.contextChars = Math.min(12000, Math.max(800, Number(n) || 2500))
    save()
  }

  function setIncludePrevChapter(on) {
    prefs.value.includePrevChapter = !!on
    save()
  }

  function setShowSessionStats(on) {
    prefs.value.showSessionStats = !!on
    save()
  }

  function setPomodoroMinutes(n) {
    const v = Number(n) || 0
    prefs.value.pomodoroMinutes = [0, 15, 25, 45, 50].includes(v) ? v : 0
    save()
  }

  function setPreferChapterSummary(on) {
    prefs.value.preferChapterSummary = !!on
    save()
  }

  function setWriterPaper(mode) {
    const m = ['default', 'parchment', 'night'].includes(mode) ? mode : 'default'
    prefs.value.writerPaper = m
    save()
  }

  function setChapterWordGoal(n) {
    const v = Math.max(0, Math.min(50000, Number(n) || 0))
    prefs.value.chapterWordGoal = v
    save()
  }

  function setAutosaveMs(n) {
    const v = Math.max(400, Math.min(5000, Number(n) || 800))
    prefs.value.autosaveMs = v
    save()
  }

  function toggleReadingMode() {
    prefs.value.readingMode = !prefs.value.readingMode
    save()
  }

  return {
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
    setAutosaveMs,
    toggleReadingMode,
    applyTheme,
    load
  }
}

if (typeof window !== 'undefined') {
  load()
}
