/**
 * Unified error logging system for 91writing desktop app.
 * Provides detailed error logs for all functions for troubleshooting.
 */

/**
 * Log levels
 * @enum {string}
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  FATAL: 'FATAL'
}

/**
 * Log categories
 * @enum {string}
 */
export const LogCategory = {
  APP_INIT: 'APP_INIT',
  STORAGE: 'STORAGE',
  API: 'API',
  ROUTER: 'ROUTER',
  COMPOSABLE: 'COMPOSABLE',
  UI: 'UI',
  TRANSITION: 'TRANSITION',
  FILE_OPS: 'FILE_OPS',
  BACKUP: 'BACKUP',
  SETTINGS: 'SETTINGS',
  AUTH: 'AUTH',
  TAURI_BRIDGE: 'TAURI_BRIDGE'
}

/**
 * Log entry structure
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} level - Log level
 * @property {string} category - Log category
 * @property {string} message - Log message
 * @property {Object} details - Additional details
 * @property {string} [stackTrace] - Error stack trace
 */

/**
 * Logger configuration
 */
const config = {
  enabled: true,
  maxEntries: 1000,
  persist: true,
  showConsole: true,
  showTauri: true
}

/**
 * In-memory log storage
 */
let logEntries = []

/**
 * Generate ISO timestamp
 * @returns {string} ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString()
}

/**
 * Format log entry for console output
 * @param {LogEntry} entry - Log entry
 * @returns {string} Formatted log message
 */
function formatConsoleMessage(entry) {
  const timestamp = entry.timestamp.split('T')[1].split('.')[0]
  return `[${timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`
}

/**
 * Format log entry for Tauri log
 * @param {LogEntry} entry - Log entry
 * @returns {string} Formatted Tauri log message
 */
function formatTauriMessage(entry) {
  return `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`
}

/**
 * Save log entry to persistent storage
 * @param {LogEntry} entry - Log entry
 */
async function persistLog(entry) {
  try {
    const logs = JSON.parse(localStorage.getItem('app_logs') || '[]')
    logs.push(entry)
    if (logs.length > config.maxEntries) {
      logs.splice(0, logs.length - config.maxEntries)
    }
    localStorage.setItem('app_logs', JSON.stringify(logs))
  } catch (e) {
    console.error('Failed to persist log:', e)
  }
}

/**
 * Send log entry to Tauri backend
 * @param {LogEntry} entry - Log entry
 */
async function sendToTauri(entry) {
  if (!config.showTauri) return

  try {
    // Use Tauri 2.0 API
    if (window.__TAURI__ && window.__TAURI__.core) {
      const { invoke } = window.__TAURI__.core
      invoke('log_message', {
        level: entry.level,
        category: entry.category,
        message: entry.message,
        details: entry.details,
        timestamp: entry.timestamp
      })
    }
  } catch (e) {
    // Tauri logging failed, ignore
  }
}

/**
 * Core logging function
 * @param {string} level - Log level
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} [details] - Additional details
 * @param {string} [stackTrace] - Error stack trace
 */
function log(level, category, message, details = {}, stackTrace = '') {
  const entry = {
    timestamp: getTimestamp(),
    level,
    category,
    message,
    details,
    stackTrace
  }

  // Store in memory
  logEntries.push(entry)
  if (logEntries.length > config.maxEntries) {
    logEntries.splice(0, logEntries.length - config.maxEntries)
  }

  // Console output
  if (config.showConsole) {
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatConsoleMessage(entry), details)
        break
      case LogLevel.INFO:
        console.info(formatConsoleMessage(entry), details)
        break
      case LogLevel.WARN:
        console.warn(formatConsoleMessage(entry), details)
        break
      case LogLevel.ERROR:
        console.error(formatConsoleMessage(entry), details, stackTrace)
        break
      case LogLevel.FATAL:
        console.error(formatConsoleMessage(entry), details, stackTrace)
        break
    }
  }

  // Persist to storage
  if (config.persist) {
    persistLog(entry)
  }

  // Send to Tauri
  sendToTauri(entry)
}

/**
 * Debug log
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} [details] - Additional details
 */
export function debug(category, message, details = {}) {
  log(LogLevel.DEBUG, category, message, details)
}

/**
 * Info log
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} [details] - Additional details
 */
export function info(category, message, details = {}) {
  log(LogLevel.INFO, category, message, details)
}

/**
 * Warn log
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} [details] - Additional details
 */
export function warn(category, message, details = {}) {
  log(LogLevel.WARN, category, message, details)
}

/**
 * Error log
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} [details] - Additional details
 * @param {Error} [error] - Error object
 */
export function error(category, message, details = {}, error = null) {
  const stackTrace = error ? error.stack : ''
  log(LogLevel.ERROR, category, message, details, stackTrace)
}

/**
 * Fatal log
 * @param {string} category - Log category
 * @param {string} message - Log message
 * @param {Object} [details] - Additional details
 * @param {Error} [error] - Error object
 */
export function fatal(category, message, details = {}, error = null) {
  const stackTrace = error ? error.stack : ''
  log(LogLevel.FATAL, category, message, details, stackTrace)
}

/**
 * Get all log entries
 * @returns {Array<LogEntry>} Log entries
 */
export function getAllLogs() {
  return [...logEntries]
}

/**
 * Get logs by category
 * @param {string} category - Log category
 * @returns {Array<LogEntry>} Filtered log entries
 */
export function getLogsByCategory(category) {
  return logEntries.filter((entry) => entry.category === category)
}

/**
 * Get logs by level
 * @param {string} level - Log level
 * @returns {Array<LogEntry>} Filtered log entries
 */
export function getLogsByLevel(level) {
  return logEntries.filter((entry) => entry.level === level)
}

/**
 * Get error logs
 * @returns {Array<LogEntry>} Error log entries
 */
export function getErrorLogs() {
  return logEntries.filter(
    (entry) => entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL
  )
}

/**
 * Clear all logs
 */
export function clearLogs() {
  logEntries = []
  try {
    localStorage.removeItem('app_logs')
  } catch (e) {
    console.error('Failed to clear logs:', e)
  }
}

/**
 * Export logs to file
 * @returns {string} Log file content
 */
export function exportLogs() {
  return JSON.stringify(logEntries, null, 2)
}

/**
 * Get logger statistics
 * @returns {Object} Statistics {total, byLevel, byCategory, errors}
 */
export function getLogStats() {
  const stats = {
    total: logEntries.length,
    byLevel: {},
    byCategory: {},
    errors: 0
  }

  for (const entry of logEntries) {
    stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1
    stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
      stats.errors++
    }
  }

  return stats
}

/**
 * Wrap async function with logging
 * @param {string} category - Log category
 * @param {string} functionName - Function name
 * @param {Function} fn - Async function
 * @returns {Function} Wrapped function
 */
export function withLogging(category, functionName, fn) {
  return async function (...args) {
    try {
      debug(category, `Calling ${functionName}`, { args })
      const result = await fn(...args)
      debug(category, `Completed ${functionName}`, { result })
      return result
    } catch (error) {
      error(category, `Failed in ${functionName}`, { args, error: error.message }, error)
      throw error
    }
  }
}

export default {
  LogLevel,
  LogCategory,
  config,
  debug,
  info,
  warn,
  error,
  fatal,
  getAllLogs,
  getLogsByCategory,
  getLogsByLevel,
  getErrorLogs,
  clearLogs,
  exportLogs,
  getLogStats,
  withLogging
}
