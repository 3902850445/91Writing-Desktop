<template>
  <div class="m-shell" :class="{ 'm-shell--immersive': immersive }">
    <!-- 沉浸式返回按钮：全局沉浸或路由沉浸时显示在左上角 -->
    <button
      v-if="immersive && showBack"
      class="m-shell__back"
      type="button"
      aria-label="返回"
      @click="goBack"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>

    <div class="m-shell__body">
      <router-view />
    </div>

    <!-- 边缘手势返回热区：仅全局沉浸模式启用 -->
    <div
      v-if="immersiveNav && !immersive"
      class="m-shell__edge"
      aria-hidden="true"
    />

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
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OrientationToggle from '../components/OrientationToggle.vue'
import { usePrefs } from '../composables/usePrefs.js'

const route = useRoute()
const router = useRouter()
const { prefs } = usePrefs()

/** 全局沉浸式导航偏好 */
const immersiveNav = computed(() => !!prefs.value.immersiveNav)

/**
 * 沉浸状态 = 路由元信息沉浸 OR 全局沉浸偏好
 * 写作页、设定页始终沉浸；全局沉浸开启时所有页面沉浸
 */
const immersive = computed(
  () =>
    route.meta?.immersive === true ||
    immersiveNav.value ||
    route.path.startsWith('/write') ||
    route.path.startsWith('/extras')
)

/** 是否显示左上角返回按钮 */
const showBack = computed(
  () =>
    !!prefs.value.immersiveShowBack &&
    route.meta?.immersive !== true &&
    route.path.startsWith('/write') === false &&
    route.path.startsWith('/extras') === false
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
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
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

/** 边缘手势返回：返回上一页或首页 */
function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

// ---------- 边缘手势返回 ----------
// 全局沉浸模式开启时，监听底部边缘上滑手势触发返回
let edgeTouchStartY = 0
let edgeTouchStartX = 0
let edgeGestureActive = false

function onEdgeTouchStart(e) {
  if (!immersiveNav.value) return
  const touch = e.changedTouches[0]
  if (!touch) return
  // 只响应从底部 24px 热区开始的触摸
  const vh = window.innerHeight || document.documentElement.clientHeight
  if (touch.clientY < vh - 24) return
  edgeTouchStartY = touch.clientY
  edgeTouchStartX = touch.clientX
  edgeGestureActive = true
}

function onEdgeTouchEnd(e) {
  if (!edgeGestureActive) return
  edgeGestureActive = false
  const touch = e.changedTouches[0]
  if (!touch) return
  const dy = touch.clientY - edgeTouchStartY
  const dx = touch.clientX - edgeTouchStartX
  // 上滑超过 40px 且水平偏移小于 60px，触发返回
  if (dy < -40 && Math.abs(dx) < 60) {
    goBack()
  }
}

onMounted(() => {
  document.addEventListener('touchstart', onEdgeTouchStart, { passive: true })
  document.addEventListener('touchend', onEdgeTouchEnd, { passive: true })
})

onUnmounted(() => {
  document.removeEventListener('touchstart', onEdgeTouchStart)
  document.removeEventListener('touchend', onEdgeTouchEnd)
})
</script>

<style scoped>
/* 沉浸式返回按钮：固定左上角，避开安全区 */
.m-shell__back {
  position: fixed;
  top: calc(10px + var(--safe-top));
  left: 10px;
  z-index: 50;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: var(--bg-glass);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  color: var(--text);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.18s, transform 0.12s;
  box-shadow: var(--shadow);
}

.m-shell__back:hover {
  background: var(--accent-soft);
}

.m-shell__back:active {
  transform: scale(0.94);
}

.m-shell__back svg {
  width: 22px;
  height: 22px;
}

/* 边缘手势热区：底部 24px 全宽，仅全局沉浸时启用 */
.m-shell__edge {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 24px;
  z-index: 39; /* 低于导航栏 z-index:40，不遮挡点击 */
  pointer-events: auto;
}
</style>
