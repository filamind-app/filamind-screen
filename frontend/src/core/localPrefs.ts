// Device-local preferences. Unlike theme/language (which roam across FilaMind surfaces via
// the shared settings store), these describe THIS physical panel - its readability and its
// backlight - so they live in the webview's own localStorage and never sync (a 3-inch panel
// and a 10-inch one want different sizes).

import { ref, watch } from 'vue'

const KEY = 'fm-screen-prefs'

export type SleepMinutes = 0 | 1 | 5 | 15
/** One knob for text + spacing + touch-target size; the panel's readability at a glance. */
export type UiSize = 'sm' | 'md' | 'lg' | 'xl'
export type Contrast = 'normal' | 'high'

export interface LocalPrefs {
  /** Blank the screen after this many idle minutes (0 = never). Never while a job is active. */
  sleepMin: SleepMinutes
  /** Overall interface size (text, spacing, touch targets scale together). */
  uiSize: UiSize
  /** High-contrast lifts muted text to full strength for bright rooms / low vision. */
  contrast: Contrast
  /** Backlight level 0.1..1 (1 = full). The panel boots at full; this only dims. */
  brightness: number
}

const DEFAULTS: LocalPrefs = { sleepMin: 5, uiSize: 'md', contrast: 'normal', brightness: 1 }

const UI_SIZES: readonly UiSize[] = ['sm', 'md', 'lg', 'xl']

function load(): LocalPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>
    const n = raw['sleepMin']
    const b = raw['brightness']
    return {
      sleepMin: n === 0 || n === 1 || n === 5 || n === 15 ? n : DEFAULTS.sleepMin,
      uiSize: UI_SIZES.includes(raw['uiSize'] as UiSize)
        ? (raw['uiSize'] as UiSize)
        : DEFAULTS.uiSize,
      contrast: raw['contrast'] === 'high' ? 'high' : 'normal',
      // Clamp to a floor so a stored 0 can never black the panel out with no way back.
      brightness: typeof b === 'number' && b >= 0.1 && b <= 1 ? b : DEFAULTS.brightness,
    }
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

/** The scale multipliers for each UI size (text · spacing · touch ride these together). */
export const UI_SCALE: Record<UiSize, { fs: number; space: number; touch: number }> = {
  sm: { fs: 0.9, space: 0.92, touch: 0.92 },
  md: { fs: 1, space: 1, touch: 1 },
  lg: { fs: 1.13, space: 1.08, touch: 1.12 },
  xl: { fs: 1.28, space: 1.16, touch: 1.25 },
}
