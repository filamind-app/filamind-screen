// The app's single SettingsStore, persisted to localStorage under the same key the no-flash
// boot script reads. Shared model with the rest of the suite via @filamind-app/core.

import { SettingsStore, localStoragePersistence } from '@filamind-app/core'

export const SETTINGS_KEY = 'filamind.settings'

export const settingsStore = new SettingsStore(localStoragePersistence(SETTINGS_KEY))
