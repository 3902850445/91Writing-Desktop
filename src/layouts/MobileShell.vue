<template>
  <div class="m-shell" :class="{ 'm-shell--immersive': immersive }">
    <div class="m-shell__body">
      <router-view />
    </div>

    <nav v-if="!immersive" class="m-nav" aria-label="主导航">
      <button
        v-for="item in tabs"
        :key="item.to"
        type="button"
        class="m-nav__item"
        :class="{ 'is-active': isActive(item) }"
        @click="go(item.to)"
      >
        <span v-html="item.icon" />
        <span>{{ item.label }}</span>
      </button>
      <OrientationToggle />
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OrientationToggle from '../components/OrientationToggle.vue'

const route = useRoute()
const router = useRouter()

const immersive = computed(
  () =>
    route.meta?.immersive === true ||
    route.path.startsWith('/write') ||
    route.path.startsWith('/extras')
)

const tabs = [
  {
    to: '/',
    match: ['/'],
    exact: true,
    label: '书架',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
  },
  {
    to: '/tools',
    match: ['/tools'],
    label: '创作',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`
  },
  {
    to: '/more',
    match: ['/more', '/prompts', '/goals', '/genres', '/billing', '/backup', '/stats'],
    label: '更多',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`
  },
  {
    to: '/settings',
    match: ['/settings', '/config'],
    label: '设置',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  }
]

function isActive(item) {
  const p = route.path
  if (item.exact) return p === '/' || p === ''
  return item.match.some((m) => p === m || p.startsWith(m + '/'))
}

function go(to) {
  if (route.path !== to) router.push(to)
}
</script>
