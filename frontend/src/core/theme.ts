// Bridges settings to the DOM: applies the Pharaonic --fm-* tokens + text direction from the
// roamed core settings, and the device-local display prefs (UI size, contrast, backlight).

import { watch } from 'vue'
import { applySettings, type UserSettings } from '@filamind-app/core'
import { settingsStore } from './settings'
import { localPrefs, UI_SCALE } from './localPrefs'
import { applyBacklight, setBacklightPower } from './backlight'
import { asleep } from './idle'

function applyRoamed(s: UserSettings): void {
  // applySettings applies the theme's --fm-* vars (its return value's `dir` is intentionally
  // NOT used here: <html> lang + dir are owned solely by i18n's initDirectionSync, so this
  // settings handler can never race the direction back to LTR after a locale change).
  applySettings(s)
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.fmTheme = s.theme
  root.dataset.fmMotif = s.motifDensity
  root.dataset.fmReduced = String(s.reducedMotion)
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
  // Screen sleep drives real panel power: sleeping blanks the panel fully (past the brightness
  // floor), waking un-blanks and restores the user's brightness. Keeping this the sole owner of
  // the sleep->hardware write means the black SleepShield overlay always sits over a dark panel.
  watch(asleep, (sleeping) => {
    if (sleeping) {
      void setBacklightPower(false)
    } else {
      void setBacklightPower(true)
      void applyBacklight(localPrefs.value.brightness)
    }
  })
}
