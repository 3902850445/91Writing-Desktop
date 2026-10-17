/**
 * Lightweight line-based diff for snapshot comparison.
 * Returns array of { type: 'same'|'add'|'del', text }.
 */

function lcsTable(a, b) {
  const n = a.length
  const m = b.length
  // Cap to avoid O(n*m) blow-up on huge chapters
  if (n * m > 250_000) {
    return null
  }
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

function splitLines(text) {
  return String(text || '').split(/\r?\n/)
}

/**
 * @param {string} oldText
 * @param {string} newText
 */
export function diffLines(oldText, newText) {
  const a = splitLines(oldText)
  const b = splitLines(newText)
  const dp = lcsTable(a, b)
  const out = []

  if (!dp) {
    // Fallback: whole-block compare
    if (String(oldText) === String(newText)) {
      return a.map((text) => ({ type: 'same', text }))
    }
    for (const text of a) out.push({ type: 'del', text })
    for (const text of b) out.push({ type: 'add', text })
    return out
  }

  let i = a.length
  let j = b.length
  const stack = []
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      stack.push({ type: 'same', text: a[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', text: b[j - 1] })
      j--
    } else if (i > 0) {
      stack.push({ type: 'del', text: a[i - 1] })
      i--
    }
  }
  stack.reverse()
  return stack
}

/** Compact stats for UI */
export function diffStats(rows) {
  let add = 0
  let del = 0
  let same = 0
  for (const r of rows || []) {
    if (r.type === 'add') add++
    else if (r.type === 'del') del++
    else same++
  }
  return { add, del, same }
}
