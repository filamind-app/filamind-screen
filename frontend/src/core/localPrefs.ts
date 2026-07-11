// Device-local preferences. Unlike theme/language (which roam across FilaMind surfaces via
// the shared settings store), these describe THIS physical panel - they live in the webview's
// own localStorage and never sync.

import { ref, watch } from 'vue'

const KEY = 'fm-screen-prefs'

export type SleepMinutes = 0 | 1 | 5 | 15

export interface LocalPrefs {
  /** Blank the screen after this many idle minutes (0 = never). Never while a job is active. */
  sleepMin: SleepMinutes
}

const DEFAULTS: LocalPrefs = { sleepMin: 5 }

function load(): LocalPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    const n = raw['sleepMin']
    return { sleepMin: n === 0 || n === 1 || n === 5 || n === 15 ? n : DEFAULTS.sleepMin }
  } catch {
    return { ...DEFAULTS }
  }
}

export const localPrefs = ref<LocalPrefs>(load())

watch(
  localPrefs,
  (p) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p))
    } catch {
      // storage unavailable - the preference just doesn't persist
    }
  },
  { deep: true },
)
