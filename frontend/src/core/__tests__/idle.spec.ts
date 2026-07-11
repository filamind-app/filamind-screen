import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  objects: {} as Record<string, unknown>,
  trust: 'live' as string,
}))

vi.mock('@/core/store/session', () => ({
  useSessionStore: () => ({
    object: (n: string) => state.objects[n],
    get live() {
      return state.trust === 'live'
    },
    get trust() {
      return state.trust
    },
  }),
}))

import { asleep, startIdleWatch, wake } from '@/core/idle'
import { localPrefs } from '@/core/localPrefs'

describe('screen sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    state.objects = { print_stats: { state: 'standby' } }
    state.trust = 'live'
    localPrefs.value.sleepMin = 1
    asleep.value = false
  })

  it('sleeps after the idle window, never during a job, and a job wakes it', () => {
    startIdleWatch()

    // Idle on standby: asleep once the configured minute has passed.
    vi.advanceTimersByTime(61_000)
    expect(asleep.value).toBe(true)

    // A job starting wakes the panel...
    state.objects = { print_stats: { state: 'printing' } }
    vi.advanceTimersByTime(5_000)
    expect(asleep.value).toBe(false)

    // ...and while it runs the screen never sleeps, however long it takes.
    vi.advanceTimersByTime(30 * 60_000)
    expect(asleep.value).toBe(false)

    // Back to standby: the countdown starts fresh from the job's end.
    state.objects = { print_stats: { state: 'standby' } }
    vi.advanceTimersByTime(30_000)
    expect(asleep.value).toBe(false)
    vi.advanceTimersByTime(40_000)
    expect(asleep.value).toBe(true)

    // wake() clears the shield and restarts the countdown.
    wake()
    expect(asleep.value).toBe(false)

    // Sleep disabled: it never blanks again.
    localPrefs.value.sleepMin = 0
    vi.advanceTimersByTime(60 * 60_000)
    expect(asleep.value).toBe(false)
  })

  it('never blanks over a hot heater (a nozzle at 200 behind a dark screen is a burn hazard)', () => {
    state.objects = {
      print_stats: { state: 'standby' },
      heaters: { available_heaters: ['extruder'] },
      extruder: { temperature: 200, target: 0 }, // hot but cooling, no target
    }
    startIdleWatch()
    vi.advanceTimersByTime(5 * 60_000)
    expect(asleep.value).toBe(false)
  })

  it('never blanks over a Klipper shutdown/error and wakes if a fault appears', () => {
    state.trust = 'shutdown'
    startIdleWatch()
    vi.advanceTimersByTime(5 * 60_000)
    expect(asleep.value).toBe(false)

    // If the panel was already asleep when the fault lands, it wakes to show the recovery strip.
    state.trust = 'live'
    vi.advanceTimersByTime(61_000)
    expect(asleep.value).toBe(true)
    state.trust = 'error'
    vi.advanceTimersByTime(5_000)
    expect(asleep.value).toBe(false)
  })
})
