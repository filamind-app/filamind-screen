import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { moonrakerDbPersistence, roamSettings } from '@filamind-app/core'

import App from './App.vue'
import './assets/styles/main.css'
import { i18n, detectLocale, setLocale, initLocaleSync, initDirectionSync } from './core/i18n'
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

  // Drop the boot splash once the app has mounted.
  const splash = document.getElementById('fm-splash')
  if (splash) {
    splash.style.opacity = '0'
    setTimeout(() => splash.remove(), 300)
  }
}

void bootstrap()
