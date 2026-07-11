import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import { setLocale, initDirectionSync } from '@/core/i18n'

// The <html> direction must follow the ACTIVE i18n locale, no matter how the locale changed
// (a local pick or a roamed settings change) - the bug was Arabic text with an LTR layout.
describe('document direction follows the active locale', () => {
  afterEach(async () => {
    await setLocale('en')
    await nextTick()
  })

  it('flips to RTL for Arabic and back to LTR for English (attribute AND direction property)', async () => {
    initDirectionSync()
    await setLocale('ar')
    await nextTick()
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
    // The inline `direction` is what actually flips the flex layout on the device webview.
    expect(document.documentElement.style.direction).toBe('rtl')

    await setLocale('en')
    await nextTick()
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.style.direction).toBe('ltr')
  })
})
