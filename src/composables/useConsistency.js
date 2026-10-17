/**
 * Lightweight consistency checks across a novel.
 */
import { findNext } from '../utils/textFind.js'

function strip(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {object} novel
 * @param {{ characters?: Array<{name?:string}> }} extras
 * @returns {Array<{type:string, severity:string, message:string, chapterId?:any, chapterIndex?:number, start?:number, end?:number}>}
 */
export function checkNovelConsistency(novel, extras = {}) {
  const issues = []
  const chapters = novel?.chapterList || []
  const charNames = (extras.characters || [])
    .map((c) => c.name || c.title)
    .filter((n) => n && String(n).length >= 2)

  // empty chapters
  chapters.forEach((c, i) => {
    const body = strip(c.content)
    if (!body) {
      issues.push({
        type: 'empty',
        severity: 'warn',
        message: `「${c.title || `第${i + 1}章`}」正文为空`,
        chapterId: c.id,
        chapterIndex: i
      })
    } else if (body.length < 50) {
      issues.push({
        type: 'short',
        severity: 'info',
        message: `「${c.title || `第${i + 1}章`}」过短（${body.length} 字）`,
        chapterId: c.id,
        chapterIndex: i
      })
    }
  })

  // character name missing from book (defined but never appears)
  if (charNames.length) {
    const all = chapters.map((c) => strip(c.content)).join('\n')
    for (const name of charNames) {
      if (!findNext(all, name, 0, { caseSensitive: true })) {
        issues.push({
          type: 'char_unused',
          severity: 'info',
          message: `设定角色「${name}」未在正文中出现`
        })
      }
    }
  }

  // detect character-like names that appear a lot but not in roster (heuristic: 2-char CJK repeated)
  // skip heavy NLP — just flag duplicate consecutive paragraphs across chapters
  const seenParas = new Map()
  chapters.forEach((c, i) => {
    const paras = strip(c.content)
      .split(/[。！？\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 20)
    for (const p of paras) {
      const key = p.slice(0, 40)
      if (seenParas.has(key)) {
        const prev = seenParas.get(key)
        issues.push({
          type: 'duplicate',
          severity: 'warn',
          message: `疑似重复句：与第${prev + 1}章相似 — 「${key.slice(0, 24)}…」`,
          chapterId: c.id,
          chapterIndex: i
        })
        break
      }
      seenParas.set(key, i)
    }
  })

  // title duplicates
  const titles = new Map()
  chapters.forEach((c, i) => {
    const t = String(c.title || '').trim()
    if (!t) return
    if (titles.has(t)) {
      issues.push({
        type: 'dup_title',
        severity: 'warn',
        message: `章节标题重复：「${t}」`,
        chapterId: c.id,
        chapterIndex: i
      })
    } else titles.set(t, i)
  })

  return issues.slice(0, 60)
}
