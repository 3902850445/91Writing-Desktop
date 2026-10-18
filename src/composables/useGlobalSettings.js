/**
 * 全局设定管理 — 小说世界观设定的增删改查
 * 支持 AI 提议 → 人工审核 → 生效的流程
 */
import { ref } from 'vue'

const PROPOSALS_KEY = 'global_settings_proposals'

export function useGlobalSettings() {
  const proposals = ref([])

  function load() {
    try {
      const raw = localStorage.getItem(PROPOSALS_KEY)
      proposals.value = raw ? JSON.parse(raw) : []
    } catch {
      proposals.value = []
    }
  }

  function approveProposal(id) {
    const p = proposals.value.find((x) => x.id === id)
    if (!p) return false
    p.status = 'approved'
    save()
    return true
  }

  function rejectProposal(id) {
    const p = proposals.value.find((x) => x.id === id)
    if (!p) return false
    p.status = 'rejected'
    save()
    return true
  }

  function save() {
    try {
      localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals.value))
    } catch {
      /* ignore */
    }
  }

  load()

  return {
    proposals,
    load,
    approveProposal,
    rejectProposal
  }
}
