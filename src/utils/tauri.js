/**
 * Tauri API wrapper for 91writing desktop app.
 * Provides bridge between frontend and Rust backend commands.
 * 使用 Tauri 2.0 API
 */

import { invoke } from '@tauri-apps/api/core'
import { error, info, warn, LogCategory } from './logger.js'

/**
 * Check if running in Tauri environment.
 * @returns {boolean} True if running in Tauri
 */
export function isTauri(): boolean {
  const result = !!window.__TAURI__ || !!window.__TAURI_INTERNALS__
  info(LogCategory.TAURI_BRIDGE, 'isTauri check', { result })
  return result
}

/**
 * Get application information from Rust backend.
 * @returns {Promise<Object>} App info {version, platform, data_dir}
 */
export async function getAppInfo(): Promise<Object> {
  info(LogCategory.TAURI_BRIDGE, 'getAppInfo called')

  if (!isTauri()) {
    warn(LogCategory.TAURI_BRIDGE, 'Not in Tauri environment, returning fallback', {
      version: '2.7.2',
      platform: 'web',
      data_dir: '/tmp/91writing'
    })
    return {
      version: '2.7.2',
      platform: 'web',
      data_dir: '/tmp/91writing'
    }
  }

  try {
    info(LogCategory.TAURI_BRIDGE, 'Invoking get_app_info command')
    const result = await invoke('get_app_info')
    info(LogCategory.TAURI_BRIDGE, 'get_app_info succeeded', result)
    return result
  } catch (e) {
    error(LogCategory.TAURI_BRIDGE, 'Failed to get app info', { error: e.message }, e)
    return {
      version: '2.7.2',
      platform: 'unknown',
      data_dir: '/tmp/91writing'
    }
  }
}

/**
 * Save text content to a file using Rust backend.
 * @param {string} path - File path
 * @param {string} content - File content
 * @returns {Promise<boolean>} Success status
 */
export async function saveFile(path: string, content: string): Promise<boolean> {
  info(LogCategory.FILE_OPS, 'saveFile called', { path, contentLength: content?.length })

  if (!isTauri()) {
    warn(LogCategory.FILE_OPS, 'saveFile not available in web environment', { path })
    return false
  }

  try {
    info(LogCategory.FILE_OPS, 'Invoking save_file command', { path })
    await invoke('save_file', { path, content })
    info(LogCategory.FILE_OPS, 'save_file succeeded', { path })
    return true
  } catch (e) {
    error(LogCategory.FILE_OPS, 'Failed to save file', { path, error: e.message }, e)
    return false
  }
}

/**
 * Read text file content using Rust backend.
 * @param {string} path - File path
 * @returns {Promise<string>} File content
 */
export async function readFile(path: string): Promise<string> {
  info(LogCategory.FILE_OPS, 'readFile called', { path })

  if (!isTauri()) {
    warn(LogCategory.FILE_OPS, 'readFile not available in web environment', { path })
    return ''
  }

  try {
    info(LogCategory.FILE_OPS, 'Invoking read_file command', { path })
    const content = await invoke('read_file', { path })
    info(LogCategory.FILE_OPS, 'read_file succeeded', { path, contentLength: content?.length })
    return content
  } catch (e) {
    error(LogCategory.FILE_OPS, 'Failed to read file', { path, error: e.message }, e)
    return ''
  }
}

/**
 * Get app data directory from Rust backend.
 * @returns {Promise<string>} Data directory path
 */
export async function getDataDir(): Promise<string> {
  info(LogCategory.STORAGE, 'getDataDir called')

  if (!isTauri()) {
    warn(LogCategory.STORAGE, 'Not in Tauri environment, returning fallback')
    return '/tmp/91writing'
  }

  try {
    info(LogCategory.STORAGE, 'Invoking get_data_dir command')
    const dir = await invoke('get_data_dir')
    info(LogCategory.STORAGE, 'get_data_dir succeeded', { dir })
    return dir
  } catch (e) {
    error(LogCategory.STORAGE, 'Failed to get data dir', { error: e.message }, e)
    return '/tmp/91writing'
  }
}

/**
 * Export novel to various formats (placeholder for future implementation).
 * @param {string} novelId - Novel ID
 * @param {string} format - Export format (txt, epub, pdf, docx)
 * @returns {Promise<boolean>} Success status
 */
export async function exportNovel(novelId: string, format: string): Promise<boolean> {
  info(LogCategory.FILE_OPS, 'exportNovel called', { novelId, format })
  warn(LogCategory.FILE_OPS, 'Export functionality not yet implemented')
  // TODO: Implement export functionality in Rust backend
  return true
}

/**
 * Open file dialog for saving.
 * @param {string} defaultName - Default file name
 * @param {string[]} filters - File type filters
 * @returns {Promise<string|null>} File path or null
 */
export async function saveFileDialog(
  defaultName: string,
  filters: string[] = ['.txt', '.md']
): Promise<string | null> {
  info(LogCategory.FILE_OPS, 'saveFileDialog called', { defaultName, filters })

  if (!isTauri()) {
    warn(LogCategory.FILE_OPS, 'saveFileDialog not available in web environment')
    return null
  }

  try {
    info(LogCategory.FILE_OPS, 'Invoking save_dialog command')
    const { invoke: invokeDialog } = await import('@tauri-apps/api/dialog')
    const path = await invokeDialog('save_dialog', {
      defaultPath: defaultName,
      filters: filters.map((ext) => ({
        name: 'Text Files',
        extensions: [ext.slice(1)]
      }))
    })
    info(LogCategory.FILE_OPS, 'save_dialog succeeded', { path })
    return path
  } catch (e) {
    error(LogCategory.FILE_OPS, 'Failed to open save dialog', { error: e.message }, e)
    return null
  }
}

/**
 * Open file dialog for reading.
 * @param {string[]} filters - File type filters
 * @returns {Promise<string|null>} File path or null
 */
export async function openFileDialog(
  filters: string[] = ['.txt', '.md', '.epub']
): Promise<string | null> {
  info(LogCategory.FILE_OPS, 'openFileDialog called', { filters })

  if (!isTauri()) {
    warn(LogCategory.FILE_OPS, 'openFileDialog not available in web environment')
    return null
  }

  try {
    info(LogCategory.FILE_OPS, 'Invoking open_dialog command')
    const { invoke: invokeDialog } = await import('@tauri-apps/api/dialog')
    const path = await invokeDialog('open_dialog', {
      filters: filters.map((ext) => ({
        name: 'Files',
        extensions: [ext.slice(1)]
      }))
    })
    info(LogCategory.FILE_OPS, 'open_dialog succeeded', { path })
    return path
  } catch (e) {
    error(LogCategory.FILE_OPS, 'Failed to open file dialog', { error: e.message }, e)
    return null
  }
}

export default {
  isTauri,
  getAppInfo,
  saveFile,
  readFile,
  getDataDir,
  exportNovel,
  saveFileDialog,
  openFileDialog
}
