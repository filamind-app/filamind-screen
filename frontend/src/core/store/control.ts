// Pinia store wrapping the gated control actions with reactive busy / error / safe-mode state.
// Multi-flight: concurrent writes are allowed (device panels drive several controls at once);
// `busy` is a refcount, and failures surface as toasts instead of silently dropping calls.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { WriteRefused } from '@filamind-app/core'
import { control, arbiter } from '@/core/control'
import { composer } from '@/core/i18n'
import { toast } from '@/core/toast'

export type ControlError = 'refusedSafe' | 'refusedOffline' | 'failed'

interface RunOpts {
  /** Failure toast stays until tapped - for destructive actions whose failure must not be missed. */
  sticky?: boolean
  /** No failure toast - for callers that render the returned error themselves (e.g. inline). */
  silent?: boolean
}

export const useControlStore = defineStore('control', () => {
  const inFlight = ref(0)
  const busy = computed(() => inFlight.value > 0)
  const lastError = ref<ControlError | null>(null)
  const safeMode = ref(arbiter.safeMode.value)
  arbiter.safeMode.subscribe((v) => (safeMode.value = v))

  // Returns THIS call's outcome. With concurrent flights the shared `lastError` can describe a
  // different call by the time an awaiter reads it - callers that branch on failure must use the
  // return value; `lastError` is only a diagnostic breadcrumb of the most recent failure.
  async function run(fn: () => Promise<unknown>, opts?: RunOpts): Promise<ControlError | null> {
    inFlight.value++
    try {
      await fn()
      return null
    } catch (e) {
      // A refusal names its cause: a safe-mode refusal reported as "not live" sends the user
      // debugging the network instead of flipping the safe-mode toggle.
      const kind: ControlError =
        e instanceof WriteRefused
          ? String(e.message).includes('safe')
            ? 'refusedSafe'
            : 'refusedOffline'
          : 'failed'
      lastError.value = kind
      if (!opts?.silent)
        toast('error', composer.t(`control.error.${kind}`), { sticky: opts?.sticky })
      return kind
    } finally {
      inFlight.value--
    }
  }

  return {
    busy,
    lastError,
    safeMode,
    runGcode: (script: string, opts?: RunOpts) => run(() => control.runGcode(script), opts),
    home: () => run(control.home),
    pause: () => run(control.pause, { sticky: true }),
    resume: () => run(control.resume, { sticky: true }),
    cancel: () => run(control.cancel, { sticky: true }),
    startPrint: (filename: string) => run(() => control.startPrint(filename)),
    // Ungated on purpose - but a FAILED estop (e.g. connection already down) must never be
    // silent: the user believes the machine halted. Sticky toast until acknowledged.
    emergencyStop: () =>
      void control.emergencyStop().catch(() => {
        toast('error', composer.t('control.error.estopFailed'), { sticky: true })
      }),
    // Recovery from shutdown/error (ungated in core/control.ts; run() still tracks busy/error).
    restartKlipper: () => run(control.restartKlipper),
    firmwareRestart: () => run(control.firmwareRestart),
    toggleSafeMode: () => control.setSafeMode(!safeMode.value),
  }
})
