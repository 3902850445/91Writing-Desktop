/**
 * Lightweight toast — no Element Plus.
 * Usage: toast.success('ok') / toast.error('fail') / toast.info('…')
 */

let host = null
let hideTimer = null

function ensureHost() {
  if (host || typeof document === 'undefined') return host
  host = document.createElement('div')
  host.id = 'app-toast-host'
  host.setAttribute('aria-live', 'polite')
  document.body.appendChild(host)
  return host
}

function show(message, type = 'info', duration = 2200) {
  const el = ensureHost()
  if (!el) {
    console.log(`[toast:${type}]`, message)
    return
  }
  if (hideTimer) clearTimeout(hideTimer)
  el.className = `app-toast app-toast--${type} app-toast--show`
  el.textContent = String(message || '')
  hideTimer = setTimeout(() => {
    el.classList.remove('app-toast--show')
  }, duration)
}

export const toast = {
  info: (m, d) => show(m, 'info', d),
  success: (m, d) => show(m, 'success', d),
  error: (m, d) => show(m, 'error', d ?? 3200),
  warning: (m, d) => show(m, 'warning', d)
}

export default toast
