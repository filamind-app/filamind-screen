import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const state = vi.hoisted(() => ({
  call: vi.fn(),
  liveValue: true,
  updateCb: null as ((r: { message?: string; complete?: boolean }) => void) | null,
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
  onUpdateResponse: (fn: (r: { message?: string; complete?: boolean }) => void) => {
    state.updateCb = fn
    return () => {}
  },
}))
vi.mock('@/core/toast', () => ({ toast: vi.fn() }))
vi.mock('@/core/i18n', () => ({ composer: { t: (k: string) => k } }))

import { useUpdatesStore } from '@/core/store/updates'

const STATUS = {
  version_info: {
    klipper: {
      configured_type: 'git_repo',
      version: 'v1-1',
      remote_version: 'v1-2',
      is_valid: true,
    },
    moonraker: { configured_type: 'git_repo', version: 'v2', remote_version: 'v2', is_valid: true },
    webclient: { configured_type: 'web', version: 'a', remote_version: 'a' },
    system: { configured_type: 'system', package_count: 3 },
  },
  busy: false,
}

describe('updates store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    state.call.mockReset()
    state.liveValue = true
    state.updateCb = null
  })

  it('parses versions, the system package count, and the update-available flag', async () => {
    state.call.mockResolvedValueOnce(STATUS)
    const up = useUpdatesStore()
    await up.refresh()
    expect(up.hasComponents).toBe(true)
    expect(up.components.find((c) => c.name === 'klipper')?.updateAvailable).toBe(true)
    expect(up.components.find((c) => c.name === 'moonraker')?.updateAvailable).toBe(false)
    expect(up.components.find((c) => c.name === 'system')?.updateAvailable).toBe(true) // 3 packages
    expect(up.outdated).toBe(2) // klipper + system
  })

  it('keeps the last-known list when a refresh fails', async () => {
    state.call.mockResolvedValueOnce(STATUS)
    const up = useUpdatesStore()
    await up.refresh()
    state.call.mockRejectedValueOnce(new Error('dropped'))
    await up.refresh()
    expect(up.hasComponents).toBe(true)
  })

  it('routes update() to the right endpoint per component', async () => {
    state.call.mockResolvedValue(STATUS)
    const up = useUpdatesStore()
    await up.refresh()
    state.call.mockClear()
    state.call.mockResolvedValue({})
    await up.update('klipper')
    expect(state.call.mock.calls.some((c) => c[0] === 'machine.update.klipper')).toBe(true)
    state.call.mockClear()
    state.call.mockResolvedValue({})
    await up.update('webclient')
    expect(
      state.call.mock.calls.some(
        (c) => c[0] === 'machine.update.client' && (c[1] as { name: string }).name === 'webclient',
      ),
    ).toBe(true)
  })

  it('does not update while offline', async () => {
    const up = useUpdatesStore()
    state.liveValue = false
    state.call.mockClear()
    await up.update('klipper')
    expect(state.call).not.toHaveBeenCalled()
  })

  it('clears busy when a notify_update_response completes', async () => {
    state.call.mockResolvedValue(STATUS)
    const up = useUpdatesStore()
    up.init()
    await up.refresh()
    expect(state.updateCb).toBeTruthy()
    state.updateCb?.({ message: 'pulling…', complete: false })
    expect(up.log.length).toBe(1)
    state.updateCb?.({ complete: true })
    expect(up.busy).toBe(false)
  })
})
