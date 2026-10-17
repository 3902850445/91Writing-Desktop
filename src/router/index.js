import { createRouter, createWebHashHistory } from 'vue-router'
import MobileShell from '../layouts/MobileShell.vue'

const routes = [
  {
    path: '/',
    component: MobileShell,
    children: [
      {
        path: '',
        name: 'Library',
        component: () => import('../views/mobile/Library.vue'),
        meta: { title: '书架' }
      },
      {
        path: 'tools',
        name: 'Tools',
        component: () => import('../views/mobile/Tools.vue'),
        meta: { title: '创作工具' }
      },
      {
        path: 'more',
        name: 'More',
        component: () => import('../views/mobile/More.vue'),
        meta: { title: '更多' }
      },
      {
        path: 'backup',
        name: 'Backup',
        component: () => import('../views/mobile/Backup.vue'),
        meta: { title: '备份' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/mobile/Settings.vue'),
        meta: { title: '设置' }
      },
      {
        path: 'prompts',
        name: 'Prompts',
        component: () => import('../views/mobile/Prompts.vue'),
        meta: { title: '提示词' }
      },
      {
        path: 'goals',
        name: 'Goals',
        component: () => import('../views/mobile/Goals.vue'),
        meta: { title: '写作目标' }
      },
      {
        path: 'genres',
        name: 'Genres',
        component: () => import('../views/mobile/Genres.vue'),
        meta: { title: '类型' }
      },
      {
        path: 'billing',
        name: 'Billing',
        component: () => import('../views/mobile/Billing.vue'),
        meta: { title: '计费' }
      },
      {
        path: 'stats',
        name: 'Stats',
        component: () => import('../views/mobile/Stats.vue'),
        meta: { title: '统计' }
      },
      {
        path: 'write/:id',
        name: 'Writer',
        component: () => import('../views/mobile/Writer.vue'),
        meta: { title: '写作', immersive: true }
      },
      {
        path: 'extras/:id',
        name: 'Extras',
        component: () => import('../views/mobile/Extras.vue'),
        meta: { title: '设定', immersive: true }
      }
    ]
  },
  { path: '/novels', redirect: '/' },
  { path: '/writer', redirect: '/' },
  { path: '/config', redirect: '/settings' },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    // Restore browser/WebView history position when available; else top of page
    if (saved) return saved
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0, left: 0 }
  }
})

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} · 91写作`
  }
})

export default router
