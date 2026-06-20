import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { detectLocale } from '@/core/i18n'
import { useSessionStore } from '@/core/store/session'
import { useControlStore } from '@/core/store/control'

describe('i18n detectLocale', () => {
  it('keeps a valid stored locale', () => {
    expect(detectLocale('ar')).toBe('ar')
  })
  it('falls back to en for an unknown stored locale', () => {
    expect(detectLocale('zz')).toBe('en')
  })
})

describe('session store trust gate', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('starts offline until a live connection seeds it', () => {
    const store = useSessionStore()
    expect(store.trust).toBe('offline')
    expect(store.live).toBe(false)
  })
})

describe('control write gate', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('refuses gated actions when the printer is not live', async () => {
    const ctl = useControlStore()
    await ctl.home()
    expect(ctl.lastError).toBe('refused')
  })
})
