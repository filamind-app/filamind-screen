// Rolling temperature history feeding the live graph: one sample per heater/sensor every
// SAMPLE_MS, capped to WINDOW samples (~5 minutes). Started once by the shell so the buffer
// is already warm when the Temperature screen opens; it keeps sampling across view changes.

import { shallowRef, triggerRef } from 'vue'
import { useSessionStore } from '@/core/store/session'

export const SAMPLE_MS = 2000
export const WINDOW = 150

interface HeatersObject {
  available_heaters?: string[]
  available_sensors?: string[]
}

/** name -> newest-last ring of temperatures (mutated in place; triggerRef publishes). */
export const tempHistory = shallowRef<Map<string, number[]>>(new Map())

let timer: ReturnType<typeof setInterval> | undefined

export function startTempHistory(): void {
  const store = useSessionStore()
  // Restartable: clear any prior sampler first, so a remount never leaves two running.
  if (timer) clearInterval(timer)

  timer = setInterval(() => {
    // While the connection is stale/offline the store objects freeze at their last values, so
    // sampling would fabricate a confident flat line at a temperature that may be climbing or
    // cooling unseen. Skip - a gap in the trace is honest; a fake steady reading is dangerous.
    if (!store.live) return
    const lists = store.object<HeatersObject>('heaters')
    const names = [
      ...new Set([...(lists?.available_heaters ?? []), ...(lists?.available_sensors ?? [])]),
    ]
    if (!names.length) return
    const map = tempHistory.value
    for (const name of names) {
      const t = store.object<{ temperature?: number }>(name)?.temperature
      if (typeof t !== 'number') continue
      const ring = map.get(name) ?? []
      ring.push(t)
      if (ring.length > WINDOW) ring.splice(0, ring.length - WINDOW)
      map.set(name, ring)
    }
    // Drop series for objects that vanished (config change across a Klipper restart).
    for (const key of map.keys()) if (!names.includes(key)) map.delete(key)
    triggerRef(tempHistory)
  }, SAMPLE_MS)
}
