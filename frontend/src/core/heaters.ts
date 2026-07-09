// Dynamic heater/sensor discovery. The printer's `heaters` object lists every configured
// heater and temperature sensor, so the app subscribes to what THIS printer actually has -
// multi-extruder, chamber heaters, and bare sensors included - instead of a hardcoded pair.
//
// Flow: the base subscription set carries `heaters`; when its lists (first) arrive we build the
// per-object subscription map, remember it on the session (so every later bootstrap re-subscribes
// the full set), seed the initial values with one query, and extend the live subscription. The
// printer's config can only change across a Klipper restart - which re-runs bootstrap - so one
// discovery per available-list content is enough.

import { computed, type ComputedRef } from 'vue'
import { FULL_CONTROL, mergeSubscriptions, type SubscriptionMap } from '@filamind-app/core'
import { session, connector } from './session'
import { useSessionStore } from './store/session'

interface HeatersObject {
  available_heaters?: string[]
  available_sensors?: string[]
}

/** The fixed baseline: full control plus the discovery object itself. */
export function baseSubscriptions(): SubscriptionMap {
  return mergeSubscriptions(FULL_CONTROL, {
    heaters: ['available_heaters', 'available_sensors'],
  })
}

let appliedKey = ''

/** Start reacting to the discovery object (call once at bootstrap). */
export function watchHeaterDiscovery(): void {
  session.printer.objects.subscribe((objects) => {
    const h = objects['heaters'] as HeatersObject | undefined
    const heaters = h?.available_heaters ?? []
    const sensors = h?.available_sensors ?? []
    if (!heaters.length && !sensors.length) return
    const key = [...heaters, ...sensors].sort().join('|')
    if (key === appliedKey) return
    appliedKey = key

    const extra: SubscriptionMap = {}
    for (const name of heaters) extra[name] = ['temperature', 'target', 'power']
    // available_sensors includes the heaters' own sensors - only add the bare ones.
    for (const name of sensors) if (!extra[name]) extra[name] = ['temperature']

    const merged = mergeSubscriptions(baseSubscriptions(), extra)
    session.setSubscriptions(merged) // future bootstraps (reconnect / klippy restart) keep the set
    void (async () => {
      try {
        // Seed current values, then extend the live subscription; updates flow through the
        // session's existing notify pipeline.
        const q = await connector.call<{ status?: Record<string, Record<string, unknown>> }>(
          'printer.objects.query',
          { objects: extra },
        )
        if (q?.status) session.printer.applyNotify([q.status])
        await connector.subscribe(merged)
      } catch {
        // Seed/subscribe failed (e.g. a transient RPC error): clear the guard so the next
        // objects emission retries - the body is idempotent. A genuine disconnect is also
        // healed by the reconnect bootstrap re-subscribing the remembered set.
        appliedKey = ''
      }
    })()
  })
}

export interface HeaterRow {
  /** Klipper object name, e.g. "extruder", "heater_bed", "heater_generic chamber". */
  name: string
  /** Short display name (the part after the type prefix). */
  label: string
  temperature: number
  target: number
  /** Heaters accept a target; bare sensors are read-only. */
  isHeater: boolean
}

interface TempObject {
  temperature?: number
  target?: number
}

function shortLabel(name: string): string {
  const space = name.indexOf(' ')
  return space >= 0 ? name.slice(space + 1) : name
}

/** Live heater + sensor rows derived from the discovered objects (heaters first). */
export function useHeaters(): {
  heaters: ComputedRef<HeaterRow[]>
  sensors: ComputedRef<HeaterRow[]>
} {
  const store = useSessionStore()
  const lists = computed(() => (store.object<HeatersObject>('heaters') ?? {}) as HeatersObject)

  const row = (name: string, isHeater: boolean): HeaterRow => {
    const obj = store.object<TempObject>(name) ?? {}
    return {
      name,
      label: shortLabel(name),
      temperature: obj.temperature ?? 0,
      target: obj.target ?? 0,
      isHeater,
    }
  }

  const heaters = computed(() => (lists.value.available_heaters ?? []).map((n) => row(n, true)))
  const sensors = computed(() => {
    const heaterSet = new Set(lists.value.available_heaters ?? [])
    return (lists.value.available_sensors ?? [])
      .filter((n) => !heaterSet.has(n))
      .map((n) => row(n, false))
  })
  return { heaters, sensors }
}

/** A heater's configured safe target range, from the printer's own config. */
export function heaterRange(name: string): { min: number; max: number } {
  const store = useSessionStore()
  const cfg = store.object<{ settings?: Record<string, Record<string, unknown>> }>('configfile')
  const section = cfg?.settings?.[name.toLowerCase()]
  const max = typeof section?.max_temp === 'number' ? section.max_temp : 300
  return { min: 0, max }
}
