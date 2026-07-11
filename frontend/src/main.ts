import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { moonrakerDbPersistence, roamSettings } from '@filamind-app/core'

import App from './App.vue'
import './assets/styles/main.css'
import {
  i18n,
  detectLocale,
  setLocale,
  initLocaleSync,
  initDirectionSync,
  markAppReady,
} from './core/i18n'
import { initTheme } from './core/theme'
import { settingsStore } from './core/settings'
import { session, connector } from './core/session'
import { baseSubscriptions, watchHeaterDiscovery } from './core/heaters'

async function bootstrap(): Promise<void> {
  await settingsStore.hydrate()
  initTheme()

  // The control baseline plus the `heaters` discovery object; the discovery watcher then
  // subscribes whatever heaters/sensors THIS printer actually has (multi-extruder, chamber...).
  session.setSubscriptions(baseSubscriptions())
  watchHeaterDiscovery()

  // Roam settings across surfaces via the printer's Moonraker DB (another surface can reconfigure this screen).
  roamSettings(settingsStore, moonrakerDbPersistence(connector), session.live)

  initDirectionSync() // <html> lang+dir follow the active i18n locale (single source of truth)
  const locale = detectLocale(settingsStore.value.locale)
  await setLocale(locale)
  if (settingsStore.value.locale !== locale) settingsStore.patch({ locale })
  initLocaleSync() // switch vue-i18n's locale when a roamed/imported settings change moves it

  const app = createApp(App)
  app.use(createPinia())
  app.use(i18n)
  app.mount('#app')
  markAppReady() // from here a locale-direction flip triggers a one-off reload for a clean layout

  // Drop the boot splash once the app has mounted.
  const splash = document.getElementById('fm-splash')
  if (splash) {
    splash.style.opacity = '0'
    setTimeout(() => splash.remove(), 300)
  }
}

void bootstrap()
  .then(() => {
    // Clear the one-shot retry latch on a clean boot so a genuine failure on a LATER boot still
    // gets its retry.
    try {
      sessionStorage.removeItem('fm-boot-retried')
    } catch {
      /* sessionStorage unavailable */
    }
  })
  .catch((err) => {
    // A boot-time throw (a failed dynamic locale-chunk import on a partial/corrupt install, a
    // hydrate error) must NOT leave the kiosk frozen on the splash logo forever. Retry once - a
    // transient chunk/network failure at cold boot self-heals - then, if it still fails, replace the
    // splash with a visible message instead of reload-thrashing a genuinely broken install.
    console.error('[filamind-screen] bootstrap failed', err)
    let alreadyRetried = true
    try {
      alreadyRetried = sessionStorage.getItem('fm-boot-retried') === '1'
      if (!alreadyRetried) sessionStorage.setItem('fm-boot-retried', '1')
    } catch {
      /* no sessionStorage: skip the auto-retry and go straight to the message */
    }
    if (!alreadyRetried) {
      setTimeout(() => location.reload(), 3000)
      return
    }
    const splash = document.getElementById('fm-splash')
    if (splash) {
      splash.style.flexDirection = 'column'
      splash.style.gap = '1rem'
      splash.style.color = '#f3ecd8'
      splash.style.fontFamily = 'system-ui, sans-serif'
      const msg = document.createElement('p')
      msg.textContent = 'FilaMind could not start. It will try again on the next power cycle.'
      msg.style.cssText = 'margin:0;max-width:80vw;text-align:center;font-size:1rem;line-height:1.4'
      splash.appendChild(msg)
    }
  })
