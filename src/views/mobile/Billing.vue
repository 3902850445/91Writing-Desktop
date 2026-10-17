<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>Token 计费</h1>
        <p>本地估算用量（非账单）</p>
      </div>
    </header>

    <div class="m-stats">
      <div class="m-stat">
        <div class="m-stat__val">{{ fmt(stats.totalInputTokens) }}</div>
        <div class="m-stat__label">输入 Token</div>
      </div>
      <div class="m-stat">
        <div class="m-stat__val">{{ fmt(stats.totalOutputTokens) }}</div>
        <div class="m-stat__label">输出 Token</div>
      </div>
      <div class="m-stat">
        <div class="m-stat__val">¥{{ (stats.totalCost || 0).toFixed(2) }}</div>
        <div class="m-stat__label">估算费用</div>
      </div>
    </div>

    <div class="m-section-title">近 7 日</div>
    <div class="m-card" style="margin-bottom: 16px">
      <div v-for="d in trend" :key="d.date" class="m-row-between" style="margin-bottom: 8px; font-size: 0.85rem">
        <span class="m-muted">{{ shortDate(d.date) }}</span>
        <span>{{ d.requestCount }} 次 · {{ d.tokenCount }} tok · ¥{{ Number(d.cost || 0).toFixed(3) }}</span>
      </div>
      <div v-if="!trend.length" class="m-muted">暂无趋势</div>
    </div>

    <div class="m-section-title">最近调用</div>
    <div v-if="!records.length" class="m-empty">
      <p>暂无记录，使用 AI 后会出现在这里</p>
    </div>
    <div v-else class="m-list">
      <div v-for="(r, i) in records.slice(0, 50)" :key="i" class="m-card" style="margin-bottom: 8px">
        <div class="m-row-between">
          <strong style="font-size: 0.9rem">{{ r.model || 'model' }}</strong>
          <span
            class="m-badge"
            :class="r.status === 'success' ? 'm-badge--ok' : 'm-badge--warn'"
          >
            {{ r.status || '—' }}
          </span>
        </div>
        <div class="m-muted" style="font-size: 0.8rem; margin-top: 4px">
          {{ r.type || 'generation' }} · 入 {{ r.inputTokens || 0 }} / 出 {{ r.outputTokens || 0 }}
          <span v-if="r.cost != null"> · ¥{{ Number(r.cost).toFixed(4) }}</span>
        </div>
        <div class="m-muted" style="font-size: 0.75rem; margin-top: 2px">
          {{ formatTime(r.timestamp || r.time || r.date) }}
        </div>
      </div>
    </div>

    <div class="m-section-title">操作</div>
    <div class="m-btn-row">
      <button type="button" class="m-btn m-btn--ghost" @click="refresh">刷新</button>
      <button type="button" class="m-btn m-btn--ghost" @click="cleanOld">清理 30 天前</button>
      <button type="button" class="m-btn m-btn--danger" @click="clear">清空记录</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import billingService from '../../services/billing.js'
import toast from '../../services/toast.js'

const stats = ref({
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCost: 0
})
const records = ref([])
const trend = ref([])

function fmt(n) {
  const v = Number(n) || 0
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return String(v)
}

function formatTime(t) {
  if (!t) return ''
  try {
    return new Date(t).toLocaleString('zh-CN')
  } catch {
    return String(t)
  }
}

function shortDate(d) {
  try {
    const x = new Date(d)
    return `${x.getMonth() + 1}/${x.getDate()}`
  } catch {
    return d
  }
}

function refresh() {
  try {
    stats.value = billingService.getUsageStats?.() || stats.value
    const list = billingService.getBillingRecords?.() || []
    records.value = Array.isArray(list) ? [...list].reverse() : []
    trend.value = billingService.getUsageTrend?.(7) || []
  } catch (e) {
    console.warn(e)
  }
}

function clear() {
  if (!confirm('清空全部计费记录？')) return
  try {
    localStorage.setItem('billing_records', '[]')
    localStorage.setItem(
      'token_usage_stats',
      JSON.stringify({
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        lastResetDate: new Date().toISOString()
      })
    )
    refresh()
    toast.success('已清空')
  } catch {
    toast.error('清空失败')
  }
}

function cleanOld() {
  try {
    const before = (billingService.getBillingRecords?.() || []).length
    billingService.cleanOldRecords?.()
    refresh()
    const after = (billingService.getBillingRecords?.() || []).length
    const n = Math.max(0, before - after)
    toast.success(n ? `已清理 ${n} 条过期记录` : '没有超过 30 天的记录')
  } catch (e) {
    toast.error(e?.message || '清理失败')
  }
}

onMounted(() => {
  try {
    billingService.cleanOldRecords?.()
  } catch {
    /* ignore */
  }
  refresh()
})
</script>
