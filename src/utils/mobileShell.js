/**
 * Mobile / Android WebView shell helpers:
 * - --app-vh tracks visualViewport (keyboard-aware)
 * - data-keyboard-open on <html> when soft keyboard likely visible
 * - data-route for route-specific chrome (e.g. hide bottom nav on writer)
 * - Screen orientation detection (landscape/portrait)
 * - Device type detection (desktop/tablet/phone)
 */

import {
  Orientation,
  DeviceType,
  getScreenOrientation,
  detectDeviceType,
  getScaleFactors,
  isLandscape,
  isPortrait
} from './screenAdaptation.js'

let installed = false
let lastInnerHeight = 0
let measureRaf = 0
let focusTimer = 0

function measureViewportNow() {
  const vv = window.visualViewport
  const h = (vv && vv.height) || window.innerHeight || 0
  const w = (vv && vv.width) || window.innerWidth || 0
  const offsetTop = (vv && vv.offsetTop) || 0

  document.documentElement.style.setProperty('--app-vh', `${h}px`)
  document.documentElement.style.setProperty('--app-vw', `${w}px`)
  document.documentElement.style.setProperty('--vv-offset-top', `${offsetTop}px`)

  // Keyboard heuristic: visual viewport much shorter than layout viewport
  const layoutH = window.innerHeight || lastInnerHeight || h
  if (layoutH > 0) lastInnerHeight = layoutH
  const shrink = layoutH - h
  const keyboardOpen = shrink > 120 || (vv && layoutH > 0 && h / layoutH < 0.78)

  document.documentElement.classList.toggle('keyboard-open', !!keyboardOpen)
  document.documentElement.setAttribute(
    'data-keyboard',
    keyboardOpen ? 'open' : 'closed'
  )

  // Focused field scroll-into-view on Android (helps fixed toolbars)
  if (keyboardOpen) {
    const el = document.activeElement
    if (
      el &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable)
    ) {
      try {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch {
        /* ignore */
      }
    }
  }
}

/** Coalesce high-frequency resize/scroll into one paint frame. */
function measureViewport() {
  if (measureRaf) return
  measureRaf = requestAnimationFrame(() => {
    measureRaf = 0
    measureViewportNow()
  })
}

function scheduleMeasure(delay = 50) {
  if (focusTimer) clearTimeout(focusTimer)
  focusTimer = setTimeout(() => {
    focusTimer = 0
    measureViewport()
  }, delay)
}

function detectAndroid() {
  try {
    const ua = navigator.userAgent || ''
    if (
      /Android/i.test(ua) ||
      window.Writing91Android ||
      window.__WRITING91_ANDROID__
    ) {
      document.documentElement.classList.add('writing91-android')
      document.documentElement.setAttribute('data-platform', 'android')
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function detectTauri() {
  try {
    if (window.__TAURI__ || window.__TAURI_INTERNALS__) {
      document.documentElement.classList.add('is-tauri')
      document.documentElement.setAttribute('data-platform', 'tauri')
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Detect screen orientation and set CSS classes.
 * Landscape mode = desktop layout, Portrait mode = mobile layout.
 */
function detectScreenOrientation() {
  try {
    const orientation = getScreenOrientation()
    const deviceType = detectDeviceType()
    const scaleFactors = getScaleFactors()

    // Set orientation class on <html>
    document.documentElement.classList.remove('is-landscape', 'is-portrait')
    document.documentElement.classList.add(
      orientation === Orientation.LANDSCAPE ? 'is-landscape' : 'is-portrait'
    )

    // Set device type class
    document.documentElement.classList.remove('is-desktop', 'is-tablet', 'is-phone')
    document.documentElement.classList.add('is-' + deviceType)

    // Set data attributes
    document.documentElement.setAttribute('data-orientation', orientation)
    document.documentElement.setAttribute('data-device', deviceType)
    document.documentElement.setAttribute('data-scale-x', scaleFactors.scaleX.toFixed(2))
    document.documentElement.setAttribute('data-scale-y', scaleFactors.scaleY.toFixed(2))
    document.documentElement.setAttribute('data-scale-font', scaleFactors.scaleFont.toFixed(2))

    return orientation
  } catch {
    /* ignore */
  }
}

function detectStandaloneMobile() {
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  const narrow = window.innerWidth <= 1024
  if (coarse || narrow || document.documentElement.classList.contains('writing91-android')) {
    document.documentElement.classList.add('is-touch-shell')
  }
}

/**
 * Install viewport + keyboard listeners (idempotent).
 */
export function installMobileShell() {
  if (installed || typeof window === 'undefined') return
  installed = true

  detectAndroid()
  detectTauri()
  detectScreenOrientation()
  detectStandaloneMobile()
  measureViewportNow()

  // Re-detect orientation on resize/orientation change
  window.addEventListener('resize', detectScreenOrientation, { passive: true })
  window.addEventListener('orientationchange', detectScreenOrientation, { passive: true })

  window.addEventListener('resize', measureViewport, { passive: true })
  window.addEventListener('orientationchange', () => {
    scheduleMeasure(80)
    scheduleMeasure(320)
  })

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', measureViewport, {
      passive: true
    })
    window.visualViewport.addEventListener('scroll', measureViewport, {
      passive: true
    })
  }

  // Focus changes often correlate with keyboard
  document.addEventListener('focusin', () => scheduleMeasure(50), true)
  document.addEventListener('focusout', () => scheduleMeasure(50), true)

  const syncOnline = () => {
    const on = navigator.onLine !== false
    document.documentElement.classList.toggle('is-offline', !on)
    document.documentElement.setAttribute('data-online', on ? '1' : '0')
  }
  syncOnline()
  window.addEventListener('online', syncOnline)
  window.addEventListener('offline', syncOnline)
}

/**
 * Sync route path onto <html> for CSS (writer immersion etc.).
 * Real routes are /write/:id and /extras/:id (not /writer).
 */
export function setRouteChrome(path = '') {
  const p = String(path || '')
  document.documentElement.setAttribute('data-route', p)
  const isImmersive =
    p === '/write' ||
    p.startsWith('/write/') ||
    p === '/extras' ||
    p.startsWith('/extras/')
  document.documentElement.classList.toggle('route-writer', isImmersive)
  document.documentElement.classList.toggle('hide-bottom-nav', isImmersive)
}

export default {
  installMobileShell,
  setRouteChrome
}
