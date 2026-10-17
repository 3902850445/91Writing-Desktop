/**
 * Markdown / EPUB export helpers (no heavy deps).
 */

function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function safeName(s) {
  return String(s || 'export')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 80)
}

function chapterAppendix(c) {
  const bits = []
  if (c?.notes) bits.push(`> 备注：${String(c.notes).replace(/\n/g, ' ')}`)
  const todos = Array.isArray(c?.todos) ? c.todos : []
  if (todos.length) {
    bits.push('')
    bits.push('**待办**')
    todos.forEach((t) => {
      bits.push(`- [${t.done ? 'x' : ' '}] ${t.text}`)
    })
  }
  return bits
}

/** Full novel → Markdown string */
export function novelToMarkdown(novel, opts = {}) {
  if (!novel) return ''
  const withMeta = opts.withMeta !== false
  const lines = []
  lines.push(`# ${novel.title || '未命名'}`)
  lines.push('')
  if (novel.author) lines.push(`> 作者：${novel.author}`)
  if (novel.description) {
    lines.push('')
    lines.push(stripHtml(novel.description))
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  ;(novel.chapterList || []).forEach((c, i) => {
    lines.push(`## ${c.title || `第${i + 1}章`}`)
    lines.push('')
    if (withMeta) {
      const app = chapterAppendix(c)
      if (app.length) {
        lines.push(...app)
        lines.push('')
      }
    }
    lines.push(stripHtml(c.content || '') || '（空）')
    lines.push('')
  })
  return lines.join('\n')
}

export function chapterToMarkdown(novel, chapter, opts = {}) {
  const t = novel?.title || '未命名'
  const ct = chapter?.title || '章节'
  const withMeta = opts.withMeta !== false
  const parts = [`# ${t}`, '', `## ${ct}`, '']
  if (withMeta) {
    const app = chapterAppendix(chapter)
    if (app.length) {
      parts.push(...app)
      parts.push('')
    }
  }
  parts.push(stripHtml(chapter?.content || ''))
  parts.push('')
  return parts.join('\n')
}

/* ---------- minimal ZIP (store only) for EPUB ---------- */

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function u16(n) {
  const b = new Uint8Array(2)
  b[0] = n & 0xff
  b[1] = (n >>> 8) & 0xff
  return b
}

function u32(n) {
  const b = new Uint8Array(4)
  b[0] = n & 0xff
  b[1] = (n >>> 8) & 0xff
  b[2] = (n >>> 16) & 0xff
  b[3] = (n >>> 24) & 0xff
  return b
}

function concat(chunks) {
  const len = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

function enc(str) {
  return new TextEncoder().encode(str)
}

/** Build uncompressed ZIP from {name: string|Uint8Array} */
export function buildZip(files) {
  const localParts = []
  const centralParts = []
  let offset = 0
  const entries = Object.entries(files)

  for (const [name, content] of entries) {
    const nameBytes = enc(name)
    const data = typeof content === 'string' ? enc(content) : content
    const crc = crc32(data)
    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0), // store
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes
    ])
    localParts.push(localHeader, data)
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    ])
    centralParts.push(central)
    offset += localHeader.length + data.length
  }

  const centralDir = concat(centralParts)
  const local = concat(localParts)
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(local.length),
    u16(0)
  ])
  return concat([local, centralDir, end])
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function chapterXhtml(title, body) {
  const paras = stripHtml(body)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeXml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh">
<head><meta charset="utf-8"/><title>${escapeXml(title)}</title>
<style>body{font-family:serif;line-height:1.7;padding:1em}h1{font-size:1.4em}</style>
</head>
<body>
<h1>${escapeXml(title)}</h1>
${paras || '<p></p>'}
</body></html>`
}

/** Build EPUB bytes (Uint8Array) for a novel */
export function novelToEpub(novel) {
  const title = novel?.title || '未命名'
  const author = novel?.author || '佚名'
  const chapters = novel?.chapterList || []
  const bookId = `writing91-${novel?.id || Date.now()}`

  const files = {
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  }

  const manifestItems = []
  const spineItems = []
  const navPoints = []

  chapters.forEach((c, i) => {
    const href = `chap${String(i + 1).padStart(3, '0')}.xhtml`
    const id = `c${i + 1}`
    const ct = c.title || `第${i + 1}章`
    files[`OEBPS/${href}`] = chapterXhtml(ct, c.content || '')
    manifestItems.push(
      `<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`
    )
    spineItems.push(`<itemref idref="${id}"/>`)
    navPoints.push(`<li><a href="${href}">${escapeXml(ct)}</a></li>`)
  })

  files['OEBPS/nav.xhtml'] = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8"/><title>目录</title></head>
<body>
<nav epub:type="toc"><h1>目录</h1><ol>
${navPoints.join('\n') || '<li><a href="chap001.xhtml">正文</a></li>'}
</ol></nav>
</body></html>`

  files['OEBPS/content.opf'] = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>zh</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine>
    ${spineItems.join('\n    ')}
  </spine>
</package>`

  // mimetype must be first and uncompressed — our zip builder stores all uncompressed
  // Rebuild with mimetype first
  const ordered = { mimetype: files.mimetype }
  for (const [k, v] of Object.entries(files)) {
    if (k !== 'mimetype') ordered[k] = v
  }
  return buildZip(ordered)
}

export { stripHtml, safeName }
