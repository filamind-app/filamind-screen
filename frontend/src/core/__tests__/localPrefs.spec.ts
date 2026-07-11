import { afterEach, describe, expect, it, vi } from 'vitest'

describe('localPrefs validation + UI scale', () => {
  afterEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  async function freshPrefs() {
    vi.resetModules()
    return await import('@/core/localPrefs')
  }

  it('defaults when storage is empty', async () => {
    localStorage.clear()
    const { localPrefs } = await freshPrefs()
    expect(localPrefs.value).toMatchObject({
      sleepMin: 5,
      uiSize: 'md',
      contrast: 'normal',
      brightness: 1,
    })
  })

  it('clamps a stored zero brightness to the default (never black with no way back)', async () => {
    localStorage.setItem('fm-screen-prefs', JSON.stringify({ brightness: 0 }))
    const { localPrefs } = await freshPrefs()
    expect(localPrefs.value.brightness).toBe(1)
  })

  it('rejects an out-of-set uiSize and keeps a valid one', async () => {
    localStorage.setItem('fm-screen-prefs', JSON.stringify({ uiSize: 'huge' }))
    const bad = await freshPrefs()
    expect(bad.localPrefs.value.uiSize).toBe('md')

    localStorage.setItem('fm-screen-prefs', JSON.stringify({ uiSize: 'xl' }))
    const good = await freshPrefs()
    expect(good.localPrefs.value.uiSize).toBe('xl')
  })

  it('every UI size maps to positive scale factors, growing sm -> xl', async () => {
    const { UI_SCALE } = await freshPrefs()
    const order = ['sm', 'md', 'lg', 'xl'] as const
    for (const k of order) {
      expect(UI_SCALE[k].fs).toBeGreaterThan(0)
      expect(UI_SCALE[k].touch).toBeGreaterThan(0)
    }
    expect(UI_SCALE.sm.fs).toBeLessThan(UI_SCALE.md.fs)
    expect(UI_SCALE.md.fs).toBeLessThan(UI_SCALE.lg.fs)
    expect(UI_SCALE.lg.fs).toBeLessThan(UI_SCALE.xl.fs)
  })

  it('persists a change back to storage', async () => {
    localStorage.clear()
    const { localPrefs } = await freshPrefs()
    localPrefs.value.uiSize = 'lg'
    await Promise.resolve()
    const saved = JSON.parse(localStorage.getItem('fm-screen-prefs') ?? '{}')
    expect(saved.uiSize).toBe('lg')
  })
})
