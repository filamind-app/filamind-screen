// Bridges the core SettingsStore to the DOM: applies the Pharaonic --fm-* tokens + text
// direction whenever settings change, and mirrors the theme onto data-fm-* attributes.

import { applySettings, type UserSettings } from '@filamind-app/core'
import { settingsStore } from './settings'

function apply(s: UserSettings): void {
  const { dir } = applySettings(s)
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.fmTheme = s.theme
  root.dataset.fmDensity = s.density
  root.dataset.fmMotif = s.motifDensity
  root.dataset.fmReduced = String(s.reducedMotion)
  root.lang = s.locale
  root.dir = dir
}

/** Apply current settings now and re-apply on every change (Observable emits immediately). */
export function initTheme(): void {
  settingsStore.settings.subscribe(apply)
}
