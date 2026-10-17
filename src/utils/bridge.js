/**
 * Android WebView bridge helpers (no-op on pure browser).
 * Native injects: window.Writing91Bridge
 *
 * Methods:
 *  - getVersion(): string
 *  - keepScreenOn(on: boolean)
 *  - haptic()
 *  - exportText(filename, base64Utf8, mime)
 *  - pickImage() -> async via window.__writing91OnImage(base64dataUrl)
 *  - setWidgetStats(json)
 *  - setAppLockEnabled(on)
 */

export function isAndroidApp() {
  return !!(
    typeof window !== 'undefined' &&
    (window.__WRITING91_ANDROID__ ||
      window.Writing91Bridge ||
      /Writing91Android/i.test(navigator.userAgent || ''))
  )
}

export function bridge() {
  return (typeof window !== 'undefined' && window.Writing91Bridge) || null
}

export function keepScreenOn(on) {
  try {
    bridge()?.keepScreenOn?.(!!on)
  } catch {
    /* ignore */
  }
}

export function getNativeVersion() {
  try {
    return bridge()?.getVersion?.() || ''
  } catch {
    return ''
  }
}

/**
 * Export via native share/save when available.
 * @param {string} filename
 * @param {string} textOrBase64 - UTF-8 text, or raw base64 if alreadyBase64
 * @param {string} mime
 * @param {{ alreadyBase64?: boolean }} [opts]
 */
export function exportViaBridge(filename, textOrBase64, mime = 'text/plain', opts = {}) {
  const b = bridge()
  if (b?.exportText) {
    try {
      const b64 = opts.alreadyBase64
        ? String(textOrBase64 || '')
        : btoa(unescape(encodeURIComponent(String(textOrBase64 ?? ''))))
      b.exportText(filename, b64, mime)
      return true
    } catch (e) {
      console.warn('bridge export failed', e)
    }
  }
  return false
}

export function haptic() {
  try {
    bridge()?.haptic?.()
  } catch {
    /* ignore */
  }
}

/** Ask native to open image picker; resolves with dataURL or null */
export function pickImage() {
  return new Promise((resolve) => {
    const b = bridge()
    if (!b?.pickImage) {
      resolve(null)
      return
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 120000)
    function cleanup() {
      clearTimeout(timer)
      try {
        delete window.__writing91OnImage
      } catch {
        /* ignore */
      }
    }
    window.__writing91OnImage = (dataUrl) => {
      cleanup()
      resolve(dataUrl || null)
    }
    try {
      b.pickImage()
    } catch {
      cleanup()
      resolve(null)
    }
  })
}

export function setWidgetStats(stats) {
  try {
    const json = typeof stats === 'string' ? stats : JSON.stringify(stats || {})
    bridge()?.setWidgetStats?.(json)
    try {
      localStorage.setItem('writing91_widget_stats', json)
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

export function setAppLockEnabled(on) {
  try {
    bridge()?.setAppLockEnabled?.(!!on)
  } catch {
    /* ignore */
  }
}

/** Register share-target handler for native SEND intent */
export function onNativeShare(handler) {
  if (typeof window === 'undefined') return () => {}
  window.__writing91OnShare = (text) => {
    try {
      handler(String(text || ''))
    } catch (e) {
      console.warn('share handler failed', e)
    }
  }
  return () => {
    try {
      delete window.__writing91OnShare
    } catch {
      /* ignore */
    }
  }
}
