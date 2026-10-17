<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>提示词库</h1>
        <p>{{ prompts.length }} 条模板</p>
      </div>
      <div class="m-btn-row" style="flex: 0; gap: 6px">
        <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="exportPrompts">导出</button>
        <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="importInput?.click()">导入</button>
        <button type="button" class="m-btn m-btn--primary m-btn--sm" @click="openCreate">新建</button>
      </div>
    </header>
    <input ref="importInput" type="file" accept="application/json,.json" style="display: none" @change="onImport" />

    <div class="m-chips">
      <button
        v-for="c in PROMPT_CATEGORIES"
        :key="c.key"
        type="button"
        class="m-chip"
        :class="{ 'is-active': cat === c.key }"
        @click="cat = c.key"
      >
        {{ c.icon }} {{ c.name }}
      </button>
    </div>

    <div class="m-list">
      <div v-for="p in filtered" :key="p.id" class="m-card" style="margin-bottom: 10px">
        <div class="m-row-between">
          <strong>{{ p.title }}</strong>
          <span class="m-badge">{{ catName(p.category) }}</span>
        </div>
        <p class="m-muted" style="margin: 6px 0; font-size: 0.85rem">
          {{ p.description || p.content?.slice(0, 100) }}
        </p>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="edit(p)">编辑</button>
          <button
            type="button"
            class="m-btn m-btn--danger m-btn--sm"
            :disabled="p.builtin"
            @click="remove(p)"
          >
            删除
          </button>
        </div>
      </div>
      <div v-if="!filtered.length" class="m-empty">
        <p>该分类暂无提示词</p>
      </div>
    </div>

    <div v-if="sheet" class="m-sheet-mask" @click.self="sheet = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">{{ form.id ? '编辑' : '新建' }}提示词</h2>
        <div class="m-field">
          <label>标题</label>
          <input v-model="form.title" class="m-input" />
        </div>
        <div class="m-field">
          <label>分类</label>
          <select v-model="form.category" class="m-select">
            <option
              v-for="c in PROMPT_CATEGORIES.filter((x) => x.key !== 'all')"
              :key="c.key"
              :value="c.key"
            >
              {{ c.name }}
            </option>
          </select>
        </div>
        <div class="m-field">
          <label>说明</label>
          <input v-model="form.description" class="m-input" />
        </div>
        <div class="m-field">
          <label>内容</label>
          <div class="m-chips" style="padding-bottom: 8px">
            <button
              v-for="v in vars"
              :key="v"
              type="button"
              class="m-chip"
              @click="insertVar(v)"
            >
              {{ '{' + v + '}' }}
            </button>
          </div>
          <textarea ref="contentEl" v-model="form.content" class="m-textarea" rows="6" />
          <span class="m-hint">点上方变量插入到光标处</span>
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
import { usePrompts, PROMPT_CATEGORIES } from '../../composables/usePrompts.js'
import toast from '../../services/toast.js'
import { downloadJson } from '../../utils/download.js'

const { prompts, byCategory, addPrompt, updatePrompt, removePrompt, load, save: persist } = usePrompts()
const cat = ref('all')
const sheet = ref(false)
const contentEl = ref(null)
const importInput = ref(null)
const vars = ['上文', '原文', '书名', '类型', '简介', '章节']
const form = reactive({
  id: '',
  title: '',
  category: 'content',
  description: '',
  content: ''
})

const filtered = computed(() => byCategory(cat.value))

function catName(key) {
  return PROMPT_CATEGORIES.find((c) => c.key === key)?.name || key
}

function insertVar(name) {
  const token = `{${name}}`
  const el = contentEl.value
  if (el && typeof el.selectionStart === 'number') {
    const s = el.selectionStart
    const e = el.selectionEnd
    form.content = form.content.slice(0, s) + token + form.content.slice(e)
    requestAnimationFrame(() => {
      el.focus()
      const p = s + token.length
      el.setSelectionRange(p, p)
    })
  } else {
    form.content += token
  }
}

function exportPrompts() {
  downloadJson('91writing-prompts.json', {
    type: 'writing91-prompts',
    version: 2,
    exportedAt: new Date().toISOString(),
    prompts: prompts.value
  })
  toast.success('已导出提示词')
}

function onImport(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  file.text().then(async (text) => {
    try {
      const json = JSON.parse(text)
      const list = Array.isArray(json.prompts)
        ? json.prompts
        : Array.isArray(json)
          ? json
          : null
      if (!list) throw new Error('无法识别格式')
      localStorage.setItem('prompts', JSON.stringify(list))
      load()
      toast.success(`已导入 ${list.length} 条`)
    } catch (e) {
      toast.error(e?.message || '导入失败')
    }
  })
}

function openCreate() {
  Object.assign(form, { id: '', title: '', category: 'content', description: '', content: '' })
  sheet.value = true
}

function edit(p) {
  Object.assign(form, {
    id: p.id,
    title: p.title,
    category: p.category,
    description: p.description || '',
    content: p.content || ''
  })
  sheet.value = true
}

async function save() {
  if (!form.title.trim() || !form.content.trim()) {
    toast.warning('请填写标题和内容')
    return
  }
  if (form.id) {
    await updatePrompt(form.id, {
      title: form.title.trim(),
      category: form.category,
      description: form.description,
      content: form.content
    })
  } else {
    await addPrompt({ ...form })
  }
  sheet.value = false
  toast.success('已保存')
}

async function remove(p) {
  if (p.builtin) return
  if (!confirm(`删除「${p.title}」？`)) return
  await removePrompt(p.id)
  toast.success('已删除')
}
</script>
