<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>类型管理</h1>
        <p>{{ genres.length }} 种类型</p>
      </div>
      <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="openCreate">添加</button>
    </header>

    <div class="m-list">
      <div v-for="g in genres" :key="g.code || g.id" class="m-card" style="margin-bottom: 10px">
        <div class="m-row-between">
          <strong>{{ g.name }}</strong>
          <span class="m-muted" style="font-size: 0.8rem">{{ g.code || g.id }}</span>
        </div>
        <p class="m-muted" style="margin: 6px 0; font-size: 0.85rem">
          {{ (g.tags || []).join(' · ') || '无标签' }}
        </p>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="edit(g)">编辑</button>
          <button type="button" class="m-btn m-btn--danger m-btn--sm" @click="remove(g)">删除</button>
        </div>
      </div>
    </div>

    <div v-if="sheet" class="m-sheet-mask" @click.self="sheet = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">{{ form.code && editing ? '编辑类型' : '添加类型' }}</h2>
        <div class="m-field">
          <label>名称</label>
          <input v-model="form.name" class="m-input" placeholder="例如：无限流" />
        </div>
        <div class="m-field">
          <label>代码（英文标识）</label>
          <input
            v-model="form.code"
            class="m-input"
            :disabled="editing"
            placeholder="infinite"
          />
        </div>
        <div class="m-field">
          <label>标签（逗号分隔）</label>
          <input v-model="form.tagsStr" class="m-input" placeholder="穿越, 副本" />
        </div>
        <div class="m-field">
          <label>创作提示（可选）</label>
          <textarea v-model="form.prompt" class="m-textarea" rows="3" />
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
import { reactive, ref } from 'vue'
import { useGenres } from '../../composables/useGenres.js'
import toast from '../../services/toast.js'

const { genres, addGenre, updateGenre, removeGenre } = useGenres()
const sheet = ref(false)
const editing = ref(false)
const form = reactive({ code: '', name: '', tagsStr: '', prompt: '' })

function openCreate() {
  editing.value = false
  Object.assign(form, { code: '', name: '', tagsStr: '', prompt: '' })
  sheet.value = true
}

function edit(g) {
  editing.value = true
  Object.assign(form, {
    code: g.code || g.id,
    name: g.name,
    tagsStr: (g.tags || []).join(', '),
    prompt: g.prompt || ''
  })
  sheet.value = true
}

async function save() {
  if (!form.name.trim()) {
    toast.warning('请填写名称')
    return
  }
  const tags = form.tagsStr
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  try {
    if (editing.value) {
      await updateGenre(form.code, { name: form.name.trim(), tags, prompt: form.prompt })
    } else {
      await addGenre({
        code: form.code || form.name,
        name: form.name.trim(),
        tags,
        prompt: form.prompt
      })
    }
    sheet.value = false
    toast.success('已保存')
  } catch (e) {
    toast.error(e?.message || '保存失败')
  }
}

async function remove(g) {
  if (!confirm(`删除类型「${g.name}」？`)) return
  await removeGenre(g.code || g.id)
  toast.success('已删除')
}
</script>
