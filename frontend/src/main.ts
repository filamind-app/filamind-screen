import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  FULL_CONTROL,
  mergeSubscriptions,
  moonrakerDbPersistence,
  roamSettings,
} from '@filamind-app/core'

import App from './App.vue'
import './assets/styles/main.css'
import { i18n, detectLocale, setLocale, initLocaleSync } from './core/i18n'
import { initTheme } from './core/theme'
import { settingsStore } from './core/settings'
import { session, connector } from './core/session'

async function bootstrap(): Promise<void> {
  await settingsStore.hydrate()
  initTheme()

  // Fixed touch UI: the control baseline plus the heaters the status view shows.
  session.setSubscriptions(
    mergeSubscriptions(FULL_CONTROL, {
      extruder: ['temperature', 'target'],
      heater_bed: ['temperature', 'target'],
    }),
  )

  // Roam settings across surfaces via the printer's Moonraker DB (another surface can reconfigure this screen).
  roamSettings(settingsStore, moonrakerDbPersistence(connector), session.live)

  const locale = detectLocale(settingsStore.value.locale)
  await setLocale(locale)
  if (settingsStore.value.locale !== locale) settingsStore.patch({ locale })
  initLocaleSync() // switch vue-i18n's locale when a roamed/imported settings change moves it

  const app = createApp(App)
  app.use(createPinia())
  app.use(i18n)
  app.mount('#app')
}

void bootstrap()
