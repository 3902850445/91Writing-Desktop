/** Lightweight non-crypto hash for PIN storage (not for high-security secrets). */
export function hashPin(pin, salt = 'writing91') {
  const s = String(salt) + ':' + String(pin || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}
