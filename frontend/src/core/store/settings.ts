// Pinia store mirroring the core SettingsStore into a Vue ref so components re-render on change.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserSettings } from '@filamind-app/core'
import { settingsStore } from '@/core/settings'

export const useSettingsStore = defineStore('settings', () => {
  const state = ref<UserSettings>(settingsStore.value)
  settingsStore.settings.subscribe((s) => (state.value = s))

  function patch(p: Partial<UserSettings>): void {
    settingsStore.patch(p)
  }

  return { state, patch }
})
