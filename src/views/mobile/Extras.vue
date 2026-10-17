<template>
  <div class="m-page">
    <header class="m-header">
      <button type="button" class="m-icon-btn" @click="$router.back()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div class="m-header__text">
        <h1>设定面板</h1>
        <p>{{ novelTitle || '作品设定' }}</p>
      </div>
    </header>

    <div class="m-segment">
      <button
        v-for="t in tabs"
        :key="t.key"
        type="button"
        :class="{ 'is-active': tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <button type="button" class="m-btn m-btn--primary m-btn--block" style="margin-bottom: 12px" @click="openAdd">
      + 添加{{ currentLabel }}
    </button>

    <div class="m-list">
      <div v-for="item in currentList" :key="item.id" class="m-card" style="margin-bottom: 10px">
        <div class="m-row-between">
          <strong>{{ item.name || item.title }}</strong>
          <span v-if="item.date" class="m-muted" style="font-size: 0.8rem">{{ item.date }}</span>
        </div>
        <p class="m-muted" style="margin: 6px 0; font-size: 0.88rem; white-space: pre-wrap">
          {{ (item.description || item.content || '').slice(0, 200) }}
        </p>
        <div class="m-btn-row">
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" @click="openEdit(item)">编辑</button>
          <button type="button" class="m-btn m-btn--danger m-btn--sm" @click="remove(item)">删除</button>
        </div>
      </div>
      <div v-if="!currentList.length" class="m-empty">
        <p>暂无{{ currentLabel }}，写作时 AI 可引用此处摘要</p>
      </div>
    </div>

    <div v-if="sheet" class="m-sheet-mask" @click.self="sheet = false">
      <div class="m-sheet">
        <div class="m-sheet__handle" />
        <h2 class="m-sheet__title">{{ form.id ? '编辑' : '添加' }}{{ currentLabel }}</h2>
        <div class="m-field">
          <label>名称</label>
          <input v-model="form.title" class="m-input" />
        </div>
        <div v-if="tab === 'events'" class="m-field">
          <label>时间 / 节点</label>
          <input v-model="form.date" class="m-input" placeholder="第3章 / 十年前" />
        </div>
        <div class="m-field">
          <label>内容</label>
          <textarea v-model="form.content" class="m-textarea" rows="5" />
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useNovels } from '../../composables/useNovels.js'
import { useNovelExtras } from '../../composables/useNovelExtras.js'
import toast from '../../services/toast.js'

const route = useRoute()
const novelId = computed(() => route.params.id)
const { load, getById } = useNovels()
const {
  characters,
  worldview,
  corpus,
  events,
  loadAll,
  addItem,
  removeItem,
  updateItem
} = useNovelExtras(novelId)

const novelTitle = ref('')
const tab = ref('characters')
const sheet = ref(false)
const form = reactive({ id: '', title: '', content: '', date: '' })

const tabs = [
  { key: 'characters', label: '角色' },
  { key: 'worldview', label: '世界观' },
  { key: 'corpus', label: '语料' },
  { key: 'events', label: '事件' }
]

const currentLabel = computed(() => tabs.find((t) => t.key === tab.value)?.label || '')
const currentList = computed(() => {
  if (tab.value === 'characters') return characters.value
  if (tab.value === 'worldview') return worldview.value
  if (tab.value === 'corpus') return corpus.value
  return events.value
})

function openAdd() {
  Object.assign(form, { id: '', title: '', content: '', date: '' })
  sheet.value = true
}

function openEdit(item) {
  Object.assign(form, {
    id: item.id,
    title: item.name || item.title || '',
    content: item.description || item.content || '',
    date: item.date || ''
  })
  sheet.value = true
}

async function save() {
  if (!form.title.trim()) {
    toast.warning('请填写名称')
    return
  }
  const payload = {
    title: form.title.trim(),
    name: form.title.trim(),
    content: form.content,
    description: form.content,
    date: form.date
  }
  if (form.id) {
    await updateItem(tab.value, form.id, payload)
  } else {
    await addItem(tab.value, payload)
  }
  sheet.value = false
  toast.success('已保存')
}

async function remove(item) {
  if (!confirm('确定删除？')) return
  await removeItem(tab.value, item.id)
  toast.success('已删除')
}

onMounted(async () => {
  await load()
  novelTitle.value = getById(novelId.value)?.title || ''
  loadAll()
})
</script>
