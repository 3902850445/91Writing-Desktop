import { createApp } from 'vue'
import router from './router'
import App from './App.vue'
import './mobile.css'
import './styles/desktop.css'
import './styles/landscape.css'
import './styles/portrait.css'
import { initStorage } from './services/storage.js'
import { error, warn, info, LogCategory } from './utils/logger.js'
import { installMobileShell, setRouteChrome } from './utils/mobileShell.js'
import { usePrefs } from './composables/usePrefs.js'
import { hashPin } from './utils/simpleHash.js'
import { initOrientationSystem } from './utils/orientationControl.js'

function ensureAppLock() {
  info(LogCategory.APP_INIT, 'ensureAppLock called')
  try {
    const raw = localStorage.getItem('app_lock_prefs')
    if (!raw) {
      info(LogCategory.APP_INIT, 'No app lock configured')
      return true
    }
    const lock = JSON.parse(raw)
    if (!lock?.enabled || !lock?.pin) {
      info(LogCategory.APP_INIT, 'App lock disabled')
      return true
    }
    info(LogCategory.APP_INIT, 'App lock enabled, requiring PIN')
    // Simple PIN gate (WebView-friendly)
    for (let i = 0; i < 3; i++) {
      const input = window.prompt(i === 0 ? '输入应用 PIN 解锁' : 'PIN 错误，请重试')
      if (input == null) {
        warn(LogCategory.APP_INIT, 'PIN input cancelled')
        return false
      }
      const ok =
        lock.pinHash
          ? hashPin(input) === lock.pinHash
          : String(input) === String(lock.pin) // legacy plain pin
      if (ok) {
        info(LogCategory.APP_INIT, 'PIN correct')
        // Migrate legacy plain PIN → pinHash on successful unlock
        if (!lock.pinHash && lock.pin) {
          try {
            localStorage.setItem(
              'app_lock_prefs',
              JSON.stringify({ enabled: true, pinHash: hashPin(input) })
            )
            info(LogCategory.APP_INIT, 'PIN migrated to hash')
          } catch (e) {
            error(LogCategory.APP_INIT, 'Failed to migrate PIN', { error: e.message }, e)
          }
        }
        return true
      }
      warn(LogCategory.APP_INIT, 'PIN incorrect')
    }
    warn(LogCategory.APP_INIT, 'PIN attempts exhausted')
    return false
  } catch (e) {
    error(LogCategory.APP_INIT, 'ensureAppLock error', { error: e.message }, e)
    return true
  }
}

async function bootstrap() {
  info(LogCategory.APP_INIT, 'Application bootstrap started')
  try {
    info(LogCategory.STORAGE, 'Initializing storage')
    await initStorage()
    info(LogCategory.STORAGE, 'Storage initialized')
  } catch (e) {
    error(LogCategory.STORAGE, 'Storage init failed, continuing', { error: e.message }, e)
  }

  if (!ensureAppLock()) {
    warn(LogCategory.APP_INIT, 'Application locked')
    document.body.innerHTML =
      '<div style="padding:24px;font-family:sans-serif;text-align:center">已锁定。请重新打开应用并输入正确 PIN。</div>'
    return
  }

  info(LogCategory.APP_INIT, 'Applying theme')
  usePrefs().applyTheme()
  info(LogCategory.APP_INIT, 'Installing mobile shell')
  installMobileShell()
  info(LogCategory.APP_INIT, 'Initializing orientation system')
  initOrientationSystem()

  info(LogCategory.APP_INIT, 'Creating Vue app')
  const app = createApp(App)
  app.use(router)

  router.afterEach((to) => {
    info(LogCategory.ROUTER, 'Route changed', { path: to.path })
    setRouteChrome(to.path)
  })
  setRouteChrome(router.currentRoute.value?.path || '/')

  info(LogCategory.APP_INIT, 'Mounting Vue app')
  app.mount('#app')
  info(LogCategory.APP_INIT, 'Application bootstrap completed')
}

bootstrap().catch((err) => {
  error(LogCategory.APP_INIT, 'Application bootstrap failed', { error: err.message }, err)
  try {
    info(LogCategory.APP_INIT, 'Applying theme in error handler')
    usePrefs().applyTheme()
  } catch {
    /* ignore */
  }
  installMobileShell()
  const app = createApp(App)
  app.use(router)
  app.mount('#app')
})
