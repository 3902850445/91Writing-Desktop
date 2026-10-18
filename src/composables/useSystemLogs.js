/**
 * 系统日志视图管理
 * - 读取 logger 的内存日志 + 持久化日志
 * - 按级别/分类筛选
 * - 导出为文本文件
 * - 清空日志
 */
import { ref, computed } from 'vue'
import {
  getAllLogs,
  getErrorLogs,
  clearLogs,
  exportLogs,
  getLogStats,
  LogLevel
} from '../utils/logger.js'

export function useSystemLogs() {
  const logs = ref([])
  const filterLevel = ref('all') // all | DEBUG | INFO | WARN | ERROR | FATAL
  const filterCategory = ref('all')
  const expandedId = ref(null)

  /** 刷新日志列表（从内存 + localStorage 读取） */
  function refresh() {
    // 优先从内存读取（最完整），内存为空时从 localStorage 恢复
    let entries = getAllLogs()
    if (entries.length === 0) {
      try {
        entries = JSON.parse(localStorage.getItem('app_logs') || '[]')
      } catch {
        entries = []
      }
    }
    logs.value = entries
  }

  /** 过滤后的日志 */
  const filteredLogs = computed(() => {
    let list = logs.value
    if (filterLevel.value !== 'all') {
      list = list.filter((e) => e.level === filterLevel.value)
    }
    if (filterCategory.value !== 'all') {
      list = list.filter((e) => e.category === filterCategory.value)
    }
    // 最新的在前
    return [...list].reverse()
  })

  /** 统计信息 */
  const stats = computed(() => getLogStats())

  /** 是否有错误日志 */
  const hasErrors = computed(
    () => stats.value.errors > 0
  )

  /** 导出日志为文本（可下载） */
  function exportAsText() {
    const data = logs.value
    if (!data.length) return ''

    let text = '91写作 - 系统日志\n'
    text += `导出时间：${new Date().toLocaleString('zh-CN')}\n`
    text += `总记录数：${data.length}\n`
    text += `错误数：${stats.value.errors}\n`
    text += `${'='.repeat(60)}\n\n`

    for (const entry of data) {
      text += `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}\n`
      if (entry.details && Object.keys(entry.details).length > 0) {
        text += `  详情：${JSON.stringify(entry.details, null, 2).replace(/\n/g, '\n  ')}\n`
      }
      if (entry.stackTrace) {
        text += `  堆栈：${entry.stackTrace}\n`
      }
      text += '\n'
    }

    return text
  }

  /** 导出为 JSON（原始格式） */
  function exportAsJSON() {
    return JSON.stringify(logs.value, null, 2)
  }

  /** 触发下载 */
  function downloadLogs(format = 'txt') {
    const content = format === 'json' ? exportAsJSON() : exportAsText()
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/plain'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `91writing-logs-${Date.now()}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /** 清空所有日志 */
  function clearAll() {
    if (!confirm('确定清空所有日志记录？此操作不可恢复。')) return
    clearLogs()
    logs.value = []
  }

  /** 切换展开/收起 */
  function toggleExpand(id) {
    expandedId.value = expandedId.value === id ? null : id
  }

  /** 错误日志列表 */
  const errorLogs = computed(() => getErrorLogs())

  return {
    logs,
    filteredLogs,
    stats,
    hasErrors,
    errorLogs,
    filterLevel,
    filterCategory,
    expandedId,
    refresh,
    downloadLogs,
    clearAll,
    toggleExpand
  }
}
