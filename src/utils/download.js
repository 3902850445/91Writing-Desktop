import { exportViaBridge } from './bridge.js'

function bytesToBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Download text/json; prefer native bridge, then data: URL on Android WebView. */
export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const body = typeof text === 'string' ? text : String(text ?? '')
  if (exportViaBridge(filename, body, mime.split(';')[0] || 'text/plain')) {
    return
  }
  const useData =
    typeof window !== 'undefined' &&
    (window.__WRITING91_ANDROID__ || /Android/i.test(navigator.userAgent || ''))

  if (useData) {
    try {
      const b64 = btoa(unescape(encodeURIComponent(body)))
      const a = document.createElement('a')
      a.href = `data:${mime.split(';')[0]};base64,${b64}`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    } catch {
      /* fall through */
    }
  }

  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadJson(filename, data) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}

/**
 * Download binary (Uint8Array / ArrayBuffer).
 * On Android, pass raw base64 to bridge WITHOUT UTF-8 re-encoding.
 */
export function downloadBinary(filename, data, mime = 'application/octet-stream') {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  try {
    const b64 = bytesToBase64(bytes)
    if (exportViaBridge(filename, b64, mime, { alreadyBase64: true })) {
      return
    }
  } catch {
    /* fall through to blob */
  }

  // Browser / fallback — blob download
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
