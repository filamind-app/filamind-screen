import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  objects: {} as Record<string, unknown>,
  live: true,
}))

vi.mock('@/core/store/session', () => ({
  useSessionStore: () => ({
    object: (n: string) => state.objects[n],
    get live() {
      return state.live
    },
  }),
}))

import { startTempHistory, tempHistory, SAMPLE_MS, WINDOW } from '@/core/tempHistory'

describe('temperature history', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    tempHistory.value.clear()
    state.live = true
    state.objects = {
      heaters: {
        available_heaters: ['extruder'],
        available_sensors: ['extruder', 'temperature_sensor mcu'],
      },
      extruder: { temperature: 25 },
      'temperature_sensor mcu': { temperature: 40 },
    }
  })

  it('samples every discovered object, caps the window, and drops vanished series', () => {
    startTempHistory()

    vi.advanceTimersByTime(SAMPLE_MS)
    expect(tempHistory.value.get('extruder')).toEqual([25])
    expect(tempHistory.value.get('temperature_sensor mcu')).toEqual([40])

    // New readings append in order.
    ;(state.objects['extruder'] as { temperature: number }).temperature = 30
    vi.advanceTimersByTime(SAMPLE_MS)
    expect(tempHistory.value.get('extruder')).toEqual([25, 30])

    // The ring caps at WINDOW samples (oldest dropped).
    vi.advanceTimersByTime(SAMPLE_MS * (WINDOW + 20))
    expect(tempHistory.value.get('extruder')!.length).toBe(WINDOW)

    // A sensor that disappears from the printer's lists loses its series.
    state.objects['heaters'] = { available_heaters: ['extruder'], available_sensors: ['extruder'] }
    vi.advanceTimersByTime(SAMPLE_MS)
    expect(tempHistory.value.has('temperature_sensor mcu')).toBe(false)
  })

  it('does not sample while disconnected (no fabricated flat line)', () => {
    startTempHistory()
    vi.advanceTimersByTime(SAMPLE_MS)
    const before = tempHistory.value.get('extruder')!.length
    // Connection drops: the frozen store values must NOT be appended as if live.
    state.live = false
    vi.advanceTimersByTime(SAMPLE_MS * 5)
    expect(tempHistory.value.get('extruder')!.length).toBe(before)
  })
})
