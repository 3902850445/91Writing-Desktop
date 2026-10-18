/**
 * DOCX 文件读取工具
 * 浏览器环境无法直接解析 .docx（zip 格式），尝试通过 native bridge 解析
 * 纯浏览器环境下返回提示信息
 */

/**
 * 通过 native bridge 读取 docx 纯文本
 * @param {ArrayBuffer} arrayBuffer - docx 文件的 ArrayBuffer
 * @returns {Promise<string>} 纯文本内容
 */
export async function readDocxViaBridge(arrayBuffer) {
  // 尝试通过 Tauri invoke 调用 Rust 后端解析
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    // 将 ArrayBuffer 转为 base64
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    // 调用 Rust 后端解析 docx
    const text = await invoke('parse_docx', { base64Content: base64 })
    return String(text || '')
  } catch (e) {
    // Tauri 不可用（纯浏览器环境）
    throw new Error('docx-parse-unavailable')
  }
}
