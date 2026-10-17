<template>
  <div class="m-page">
    <header class="m-header">
      <div class="m-header__text">
        <h1>更多</h1>
        <p>功能与数据</p>
      </div>
    </header>

    <div class="m-section-title">创作</div>
    <div class="m-card" style="padding: 0; overflow: hidden; margin-bottom: 14px">
      <button
        v-for="item in createItems"
        :key="item.to"
        type="button"
        class="m-action-row"
        @click="$router.push(item.to)"
      >
        <span>{{ item.icon }} {{ item.label }}</span>
        <span class="m-muted">›</span>
      </button>
    </div>

    <div class="m-section-title">管理</div>
    <div class="m-card" style="padding: 0; overflow: hidden; margin-bottom: 14px">
      <button
        v-for="item in manageItems"
        :key="item.to"
        type="button"
        class="m-action-row"
        @click="$router.push(item.to)"
      >
        <span>{{ item.icon }} {{ item.label }}</span>
        <span class="m-muted">›</span>
      </button>
    </div>

    <div class="m-section-title">数据</div>
    <div class="m-card" style="padding: 0; overflow: hidden">
      <button
        v-for="item in dataItems"
        :key="item.to"
        type="button"
        class="m-action-row"
        @click="$router.push(item.to)"
      >
        <span>{{ item.icon }} {{ item.label }}</span>
        <span class="m-muted">›</span>
      </button>
    </div>
  </div>
</template>

<script setup>
const createItems = [
  { to: '/tools', icon: '🛠️', label: '短篇 / 拆书 / 工坊' },
  { to: '/prompts', icon: '💬', label: '提示词库' },
  { to: '/goals', icon: '🎯', label: '写作目标' },
  { to: '/stats', icon: '📈', label: '统计与成就' }
]

const manageItems = [
  { to: '/genres', icon: '🎭', label: '类型管理' },
  { to: '/billing', icon: '📊', label: 'Token 计费' },
  { to: '/settings', icon: '⚙️', label: 'API 设置' }
]

const dataItems = [
  { to: '/backup', icon: '💾', label: '备份 / 回收站 / 粘贴建书' }
]
</script>
