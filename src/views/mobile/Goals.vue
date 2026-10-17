<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>写作目标</h1>
        <p>今日 {{ todayKey() }}</p>
      </div>
      <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="openCreate">新建</button>
    </header>

    <div class="m-section-title">近 14 日热力</div>
    <div class="m-card" style="margin-bottom: 16px">
      <div class="m-heat">
        <div
          v-for="d in heat"
          :key="d.date"
          class="m-heat__cell"
          :class="['m-heat__l' + d.level, { 'is-today': d.isToday }]"
          :title="d.date + ': ' + d.words + ' 字'"
        >
          <span class="m-heat__label">{{ d.label }}</span>
        </div>
      </div>
      <p class="m-hint" style="margin: 10px 0 0">颜色越深表示当日写得越多（相对每日目标）</p>
    </div>

    <div v-if="!goals.length" class="m-empty">
      <div class="m-empty__icon">🎯</div>
      <h3>还没有目标</h3>
      <p>设定每日字数，写作页保存时自动累计</p>
      <button type="button" class="m-btn m-btn--primary" @click="openCreate">创建目标</button>
    </div>

    <div v-else class="m-list">
      <div v-for="g in goals" :key="g.id" class="m-card" style="margin-bottom: 10px">
        <div class="m-row-between">
          <strong>{{ g.title }}</strong>
          <span class="m-badge">{{ typeLabel(g.type) }}</span>
        </div>
        <div style="margin: 10px 0 6px">
          <div class="m-progress">
            <div class="m-progress__bar" :style="{ width: progressPct(g) + '%' }" />
          </div>
        </div>
        <div class="m-row-between m-muted" style="font-size: 0.85rem">
          <span>{{ g.progress || 0 }} / {{ g.target }} 字（{{ progressPct(g) }}%）</span>
          <span v-if="g.type === 'daily'">连续 {{ g.streak || 0 }} 天</span>
        </div>
        <div class="m-btn-row" style="margin-top: 10px">
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="edit(g)">调整</button>
          <button type="button" class="m-btn m-btn--danger m-btn--sm" @click="remove(g)">删除</button>
        </div>
      </div>
    </div>

    <div v-if="sheet" class="m-sheet-mask" @click.self="sheet = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">{{ form.id ? '调整目标' : '新建目标' }}</h2>
        <div class="m-field">
          <label>名称</label>
          <input v-model="form.title" class="m-input" placeholder="每日写作" />
        </div>
        <div class="m-field">
          <label>周期</label>
          <select v-model="form.type" class="m-select" :disabled="!!form.id">
            <option value="daily">每日</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
          </select>
        </div>
        <div class="m-field">
          <label>目标字数</label>
          <input v-model.number="form.target" class="m-input" type="number" min="100" step="100" />
        </div>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost" @click="sheet = false">取消</button>
          <button type="button" class="m-btn m-btn--primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useGoals } from '../../composables/useGoals.js'
import toast from '../../services/toast.js'

const { goals, addGoal, updateGoal, removeGoal, progressPct, todayKey, heatDays, load } = useGoals()
const heat = computed(() => heatDays(14))
load()
const sheet = ref(false)
const form = reactive({ id: '', title: '', type: 'daily', target: 2000 })

function typeLabel(t) {
  return { daily: '每日', weekly: '每周', monthly: '每月' }[t] || t
}

function openCreate() {
  Object.assign(form, { id: '', title: '', type: 'daily', target: 2000 })
  sheet.value = true
}

function edit(g) {
  Object.assign(form, { id: g.id, title: g.title, type: g.type, target: g.target })
  sheet.value = true
}

async function save() {
  if (!form.target || form.target < 1) {
    toast.warning('请填写目标字数')
    return
  }
  if (form.id) {
    await updateGoal(form.id, { title: form.title || form.title, target: Number(form.target) })
  } else {
    await addGoal({
      type: form.type,
      target: Number(form.target),
      title: form.title
    })
  }
  sheet.value = false
  toast.success('已保存')
}

async function remove(g) {
  if (!confirm(`删除目标「${g.title}」？`)) return
  await removeGoal(g.id)
  toast.success('已删除')
}
</script>
