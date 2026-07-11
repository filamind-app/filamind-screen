// vue-i18n bridged to @filamind-app/core's locale metadata (the single source for the locale
// list, RTL, and plurals). English bundled eagerly; the rest lazy. Compiler is bundled
// (not runtimeOnly) because messages load at runtime via import.meta.glob.

import { watch } from 'vue'
import { createI18n, type Composer } from 'vue-i18n'
import { LOCALES, DEFAULT_LOCALE, isRtl } from '@filamind-app/core'
import { settingsStore } from './settings'

type MessageTree = { [key: string]: string | MessageTree }

function assemble(modules: Record<string, { default: MessageTree }>): MessageTree {
  const out: MessageTree = {}
  for (const path in modules) {
    const file = path.split('/').pop()
    if (!file) continue
    out[file.replace('.json', '')] = modules[path]?.default ?? {}
  }
  return out
}

const enModules = import.meta.glob('../locales/en/*.json', { eager: true }) as Record<
  string,
  { default: MessageTree }
>
const enMessages = assemble(enModules)

const lazyLocales = import.meta.glob(['../locales/*/*.json', '!../locales/en/*.json']) as Record<
  string,
  () => Promise<{ default: MessageTree }>
>

// Locales that actually ship a catalog on disk (en eager + whatever folders exist). The
// language switcher and locale detection both bound to these, so we never set <html lang>
// to a code with no messages.
const shippedCodes = new Set<string>([DEFAULT_LOCALE])
for (const path in lazyLocales) {
  const m = /\/locales\/([^/]+)\//.exec(path)
  if (m?.[1]) shippedCodes.add(m[1])
}
export const shippedLocales = LOCALES.filter((l) => shippedCodes.has(l.code))

const initialMessages: Record<string, MessageTree> = { [DEFAULT_LOCALE]: enMessages }

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: initialMessages,
})

export const composer = i18n.global as unknown as Composer

const loaded = new Set<string>([DEFAULT_LOCALE])

export async function loadLocale(code: string): Promise<void> {
  if (loaded.has(code)) return
  const out: MessageTree = {}
  for (const path in lazyLocales) {
    if (!path.includes(`/locales/${code}/`)) continue
    const loader = lazyLocales[path]
    if (!loader) continue
    const mod = await loader()
    const file = path.split('/').pop()
    if (file) out[file.replace('.json', '')] = mod.default
  }
  composer.setLocaleMessage(code, out)
  loaded.add(code)
}

export function applyDocumentLocale(code: string): void {
  if (typeof document === 'undefined') return
  const dir = isRtl(code) ? 'rtl' : 'ltr'
  const root = document.documentElement
  root.lang = code
  root.dir = dir
  // Also set the `direction` CSS property explicitly. The `dir` attribute alone should map to it
  // via the UA stylesheet, but the kiosk's WebKitGTK does not always flip flex layouts from the
  // attribute - so the rail/grid stayed left-to-right while the Arabic text ran right-to-left.
  // An inline style wins over everything and makes flexbox honour the direction.
  root.style.direction = dir
}

/**
 * <html> lang + dir have ONE writer: setLocale, right here. Every locale change - a local pick,
 * a roamed settings change (via initLocaleSync), first boot - flows through setLocale, so the
 * direction always matches the displayed language. The settings handler (applyRoamed) must NOT
 * also write dir, or it can race this back to LTR after the locale changed.
 * A reactive backstop keeps them in sync if the active locale is ever changed another way.
 */
export function initDirectionSync(): void {
  watch(() => composer.locale.value as string, applyDocumentLocale)
}

export async function setLocale(code: string): Promise<void> {
  await loadLocale(code)
  composer.locale.value = code
  applyDocumentLocale(code) // set lang + dir synchronously - do not depend on a watcher firing
}

/** Keep vue-i18n's active locale in sync with the settings store when the locale changes from
 *  somewhere other than the language picker - a roamed change from another surface, an import, or
 *  a reset. Local picks already call setLocale(); the current-locale guard dedupes those. */
export function initLocaleSync(): void {
  let current = composer.locale.value
  settingsStore.settings.subscribe((s) => {
    if (s.locale === current) return
    current = s.locale
    void setLocale(s.locale)
  })
}

/** Pick a locale that actually ships a catalog (never a code we have no messages for). */
export function detectLocale(stored?: string): string {
  if (stored && shippedCodes.has(stored)) return stored
  if (typeof navigator !== 'undefined' && navigator.language) {
    const nav = navigator.language
    if (shippedCodes.has(nav)) return nav
    const base = nav.split('-')[0]
    if (base && shippedCodes.has(base)) return base
  }
  return DEFAULT_LOCALE
}
