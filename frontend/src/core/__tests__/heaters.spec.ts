import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubscriptionMap } from '@filamind-app/core'

// Fake the composition root: a session whose printer.objects we drive by hand, plus a recording
// connector - so the discovery logic is exercised end to end without a WebSocket.
const fake = vi.hoisted(() => {
  type Listener = (objects: Record<string, unknown>) => void
  const listeners: Listener[] = []
  return {
    listeners,
    setSubscriptions: vi.fn(),
    applyNotify: vi.fn(),
    call: vi.fn(async () => ({ status: { extruder: { temperature: 25 } } })),
    subscribe: vi.fn(async () => undefined),
    emit(objects: Record<string, unknown>) {
      for (const l of listeners) l(objects)
    },
  }
})

vi.mock('@/core/session', () => ({
  session: {
    printer: {
      objects: { subscribe: (l: (o: Record<string, unknown>) => void) => fake.listeners.push(l) },
      applyNotify: fake.applyNotify,
    },
    setSubscriptions: fake.setSubscriptions,
  },
  connector: { call: fake.call, subscribe: fake.subscribe },
}))

import { watchHeaterDiscovery, baseSubscriptions } from '../heaters'

beforeEach(() => {
  vi.clearAllMocks()
  fake.listeners.length = 0
})

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('heater discovery', () => {
  it('subscribes whatever heaters and sensors the printer reports', async () => {
    watchHeaterDiscovery()
    fake.emit({
      heaters: {
        available_heaters: ['extruder', 'extruder1', 'heater_bed', 'heater_generic chamber'],
        available_sensors: [
          'extruder',
          'extruder1',
          'heater_bed',
          'heater_generic chamber',
          'temperature_sensor mcu',
        ],
      },
    })
    await flush()

    expect(fake.setSubscriptions).toHaveBeenCalledTimes(1)
    const merged = fake.setSubscriptions.mock.calls[0]![0] as SubscriptionMap
    // Heaters carry target+power; the bare sensor only temperature; no duplicates.
    expect(merged['extruder']).toEqual(['temperature', 'target', 'power'])
    expect(merged['extruder1']).toEqual(['temperature', 'target', 'power'])
    expect(merged['heater_generic chamber']).toEqual(['temperature', 'target', 'power'])
    expect(merged['temperature_sensor mcu']).toEqual(['temperature'])
    // The baseline (webhooks/print_stats/...) is still there.
    for (const key of Object.keys(baseSubscriptions())) expect(merged).toHaveProperty(key)
    // Initial values seeded + the live subscription extended.
    expect(fake.applyNotify).toHaveBeenCalledWith([{ extruder: { temperature: 25 } }])
    expect(fake.subscribe).toHaveBeenCalledWith(merged)
  })

  it('re-applies only when the available lists actually change', async () => {
    watchHeaterDiscovery()
    const lists = {
      heaters: { available_heaters: ['extruder'], available_sensors: ['extruder'] },
    }
    fake.emit(lists)
    fake.emit(lists) // same content again (any object update re-notifies)
    await flush()
    expect(fake.setSubscriptions).toHaveBeenCalledTimes(1)

    fake.emit({
      heaters: {
        available_heaters: ['extruder', 'heater_bed'],
        available_sensors: ['extruder', 'heater_bed'],
      },
    })
    await flush()
    expect(fake.setSubscriptions).toHaveBeenCalledTimes(2)
  })

  it('ignores updates until the lists arrive', async () => {
    watchHeaterDiscovery()
    fake.emit({ print_stats: { state: 'standby' } })
    await flush()
    expect(fake.setSubscriptions).not.toHaveBeenCalled()
  })
})
