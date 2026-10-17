/**
 * Compress image File / dataURL to small JPEG dataURL for covers.
 */

/**
 * @param {string} dataUrl
 * @param {{ max?: number, quality?: number }} opts
 * @returns {Promise<string>}
 */
export function compressDataUrl(dataUrl, opts = {}) {
  const max = opts.max || 320
  const quality = opts.quality ?? 0.72
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        let w = img.width
        let h = img.height
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h)
          w = Math.round(w * r)
          h = Math.round(h * r)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = dataUrl
  })
}

/**
 * @param {File|Blob} file
 * @param {{ max?: number, quality?: number, maxBytes?: number }} opts
 */
export function compressImageFile(file, opts = {}) {
  const maxBytes = opts.maxBytes || 2 * 1024 * 1024
  if (file.size > maxBytes) {
    return Promise.reject(new Error(`请选择 ${(maxBytes / 1024 / 1024).toFixed(0)}MB 以内的图片`))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      compressDataUrl(String(reader.result), opts).then(resolve).catch(reject)
    }
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}
