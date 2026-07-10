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
    const err = await ctl.home()
    expect(err).toBe('refusedOffline') // per-call outcome (what consumers must branch on)
    expect(ctl.lastError).toBe('refusedOffline') // diagnostic breadcrumb
  })

  it('names safe mode as the refusal cause, not connectivity', async () => {
    const ctl = useControlStore()
    ctl.toggleSafeMode()
    const err = await ctl.home()
    expect(err).toBe('refusedSafe')
    ctl.toggleSafeMode()
  })
})
