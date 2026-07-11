// Idle detection + screen sleep. After the configured idle time the screen blanks - but never
// when the machine is doing something the operator must be able to see: a live job, a Klipper
// shutdown/error (the recovery strip and E-STOP would be hidden behind a black panel that reads
// as powered-off), or a hot heater (a nozzle at 200C behind a dark screen is a burn hazard). A
// job starting wakes the panel. The shield component owns the tap-to-wake (with a ghost-touch
// guard); this module owns the timing.

import { ref } from 'vue'
import { localPrefs } from './localPrefs'
import { useSessionStore } from './store/session'

export const asleep = ref(false)

// A heater warmer than this reads as "the machine is hot" - the screen must stay lit.
const HOT_C = 50

let lastActivity = Date.now()
let listenersBound = false
let timer: ReturnType<typeof setInterval> | undefined

export function startIdleWatch(): void {
  const store = useSessionStore()

  if (!listenersBound) {
    listenersBound = true
    const activity = (): void => {
      lastActivity = Date.now()
    }
    // Capture phase: a tap anywhere counts, even when a handler stops propagation.
    for (const ev of ['pointerdown', 'pointermove', 'keydown'] as const) {
      window.addEventListener(ev, activity, { passive: true, capture: true })
    }
  }
  // Restartable interval: a remount never leaves two idle timers running.
  if (timer) clearInterval(timer)

  const anyHeaterHot = (): boolean => {
    const heaters = store.object<{ available_heaters?: string[] }>('heaters')?.available_heaters
    if (!heaters?.length) return false
    return heaters.some((name) => {
      const h = store.object<{ temperature?: number; target?: number }>(name)
      return (h?.target ?? 0) > 0 || (h?.temperature ?? 0) >= HOT_C
    })
  }

  timer = setInterval(() => {
    const state = store.object<{ state?: string }>('print_stats')?.state
    const jobActive = state === 'printing' || state === 'paused'
    const down = store.trust === 'shutdown' || store.trust === 'error'
    // "Must stay visible" states: keep the panel awake and treat them as activity so the idle
    // countdown starts fresh once they clear.
    if (jobActive || down || anyHeaterHot()) {
      lastActivity = Date.now()
      if (asleep.value && (jobActive || down)) asleep.value = false // a job / a fault wakes it
      return
    }
    const min = localPrefs.value.sleepMin
    if (!min || asleep.value) return
    if (Date.now() - lastActivity >= min * 60_000) asleep.value = true
  }, 5_000)
}

export function wake(): void {
  lastActivity = Date.now()
  asleep.value = false
}
