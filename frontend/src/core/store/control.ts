// Pinia store wrapping the gated control actions with reactive busy / error / safe-mode state.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { WriteRefused } from '@filamind-app/core'
import { control, arbiter } from '@/core/control'

export type ControlError = 'refused' | 'failed'

export const useControlStore = defineStore('control', () => {
  const busy = ref(false)
  const lastError = ref<ControlError | null>(null)
  const safeMode = ref(arbiter.safeMode.value)
  arbiter.safeMode.subscribe((v) => (safeMode.value = v))

  async function run(fn: () => Promise<unknown>): Promise<void> {
    if (busy.value) return
    busy.value = true
    lastError.value = null
    try {
      await fn()
    } catch (e) {
      lastError.value = e instanceof WriteRefused ? 'refused' : 'failed'
    } finally {
      busy.value = false
    }
  }

  return {
    busy,
    lastError,
    safeMode,
    runGcode: (script: string) => run(() => control.runGcode(script)),
    home: () => run(control.home),
    pause: () => run(control.pause),
    resume: () => run(control.resume),
    cancel: () => run(control.cancel),
    startPrint: (filename: string) => run(() => control.startPrint(filename)),
    emergencyStop: () => void control.emergencyStop().catch(() => undefined),
    toggleSafeMode: () => control.setSafeMode(!safeMode.value),
  }
})
