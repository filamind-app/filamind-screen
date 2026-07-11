import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/core/i18n'
import NumPad from '../NumPad.vue'

const mountPad = (props: Record<string, unknown> = {}) =>
  mount(NumPad, {
    props: { label: 'Z', min: -2, max: 2, decimal: true, negative: true, ...props },
    global: { plugins: [i18n] },
  })

const key = (w: VueWrapper, label: string) =>
  w.findAll('button.key').find((b) => b.text() === label)!

describe('NumPad extended entry', () => {
  it('confirms a signed decimal value within range', async () => {
    const w = mountPad()
    await key(w, '1').trigger('click')
    await key(w, '.').trigger('click')
    await key(w, '2').trigger('click')
    await key(w, '±').trigger('click')
    await w.find('button.ok').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual([-1.2])
  })

  it('a bare dot starts the value as 0.', async () => {
    const w = mountPad()
    await key(w, '.').trigger('click')
    await key(w, '5').trigger('click')
    await w.find('button.ok').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual([0.5])
  })

  it('keeps OK disabled for out-of-range and incomplete entries', async () => {
    const w = mountPad()
    await key(w, '9').trigger('click') // 9 > max 2
    expect(w.find('button.ok').attributes('disabled')).toBeDefined()
    await key(w, '±').trigger('click') // -9, still out of range below min
    expect(w.find('button.ok').attributes('disabled')).toBeDefined()
  })

  it('a lone minus is incomplete, not zero', async () => {
    const w = mountPad()
    await key(w, '±').trigger('click')
    expect(w.find('button.ok').attributes('disabled')).toBeDefined()
  })

  it('basic mode exposes neither dot nor sign keys', () => {
    const w = mountPad({ decimal: false, negative: false, min: 0, max: 300 })
    const labels = w.findAll('button.key').map((b) => b.text())
    expect(labels).not.toContain('.')
    expect(labels).not.toContain('±')
  })
})
