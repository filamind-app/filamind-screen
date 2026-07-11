// Bridges settings to the DOM: applies the Pharaonic --fm-* tokens + text direction from the
// roamed core settings, and the device-local display prefs (UI size, contrast, backlight).

import { watch } from 'vue'
import { applySettings, type UserSettings } from '@filamind-app/core'
import { settingsStore } from './settings'
import { localPrefs, UI_SCALE } from './localPrefs'
import { applyBacklight } from './backlight'

function applyRoamed(s: UserSettings): void {
  const { dir } = applySettings(s)
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.fmTheme = s.theme
  root.dataset.fmMotif = s.motifDensity
  root.dataset.fmReduced = String(s.reducedMotion)
  root.lang = s.locale
  root.dir = dir
}

/** Device-local readability (size + contrast) - re-applied on any local-prefs change. */
function applyLocalDisplay(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const scale = UI_SCALE[localPrefs.value.uiSize]
  root.style.setProperty('--ui-fs', String(scale.fs))
  root.style.setProperty('--ui-space', String(scale.space))
  root.style.setProperty('--ui-touch', String(scale.touch))
  root.dataset.fmContrast = localPrefs.value.contrast
}

/** Apply current settings now and re-apply on every change. */
export function initTheme(): void {
  settingsStore.settings.subscribe(applyRoamed)
  watch(localPrefs, applyLocalDisplay, { immediate: true, deep: true })
  // Backlight is a hardware write - drive it ONLY when brightness itself changes, not on every
  // unrelated readability/sleep toggle.
  watch(
    () => localPrefs.value.brightness,
    (b) => void applyBacklight(b),
    { immediate: true },
  )
}
