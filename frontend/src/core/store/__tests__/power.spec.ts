import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock the session layer: a call() spy, a mutable live flag, and a captured notify_power_changed
// listener so we can drive live updates by hand.
const state = vi.hoisted(() => ({
  call: vi.fn(),
  liveValue: true,
  powerCb: null as ((c: { device: string; status: string }[]) => void) | null,
}))

vi.mock('@/core/session', () => ({
  connector: { call: (...a: unknown[]) => state.call(...a) },
  session: {
    live: {
      get value() {
        return state.liveValue
      },
      subscribe: () => () => {},
    },
  },
  onPowerChanged: (fn: (c: { device: string; status: string }[]) => void) => {
    state.powerCb = fn
    return () => {}
  },
}))
vi.mock('@/core/toast', () => ({ toast: vi.fn() }))
vi.mock('@/core/i18n', () => ({ composer: { t: (k: string) => k } }))

import { usePowerStore } from '@/core/store/power'

describe('power store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    state.call.mockReset()
    state.liveValue = true
    state.powerCb = null
  })

  it('populates devices from a successful query', async () => {
    state.call.mockResolvedValueOnce({ devices: [{ device: 'PSU', status: 'off' }] })
    const p = usePowerStore()
    await p.refresh()
    expect(p.devices).toHaveLength(1)
    expect(p.hasPower).toBe(true)
  })

  it('keeps the last-known list when a refresh fails (a transient drop must not blank the tab)', async () => {
    state.call.mockResolvedValueOnce({ devices: [{ device: 'PSU', status: 'on' }] })
    const p = usePowerStore()
    await p.refresh()
    state.call.mockRejectedValueOnce(new Error('connection dropped'))
    await p.refresh()
    expect(p.devices).toHaveLength(1)
    expect(p.hasPower).toBe(true)
  })

  it('an authoritative empty reply clears the list (printer with no power devices)', async () => {
    state.call.mockResolvedValueOnce({ devices: [{ device: 'PSU', status: 'on' }] })
    const p = usePowerStore()
    await p.refresh()
    state.call.mockResolvedValueOnce({ devices: [] })
    await p.refresh()
    expect(p.hasPower).toBe(false)
  })

  it('toggle posts the toggle action and applies the returned status', async () => {
    state.call.mockResolvedValueOnce({ devices: [{ device: 'PSU', status: 'off' }] })
    const p = usePowerStore()
    await p.refresh()
    state.call.mockResolvedValueOnce({ PSU: 'on' })
    await p.toggle('PSU')
    expect(state.call).toHaveBeenLastCalledWith('machine.device_power.post_device', {
      device: 'PSU',
      action: 'toggle',
    })
    expect(p.devices[0]?.status).toBe('on')
  })

  it('does not toggle while offline', async () => {
    state.call.mockResolvedValueOnce({ devices: [{ device: 'PSU', status: 'off' }] })
    const p = usePowerStore()
    await p.refresh()
    state.liveValue = false
    state.call.mockClear()
    await p.toggle('PSU')
    expect(state.call).not.toHaveBeenCalled()
  })

  it('applies a live notify_power_changed event', async () => {
    state.call.mockResolvedValue({ devices: [{ device: 'PSU', status: 'off' }] })
    const p = usePowerStore()
    p.init()
    await p.refresh()
    expect(state.powerCb).toBeTruthy()
    state.powerCb?.([{ device: 'PSU', status: 'on' }])
    expect(p.devices[0]?.status).toBe('on')
  })
})
