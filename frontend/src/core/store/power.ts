// Moonraker power devices (PSU, lights, ...). These are a Moonraker `[power ...]` component, NOT
// Klipper printer objects, so they don't ride the printer-object subscription: we query the list
// over the machine API and keep it live from the `notify_power_changed` event teed in session.ts.
// Toggling is a real machine write - gated on a live connection, and Moonraker itself refuses a
// device that is `locked_while_printing`, surfaced here as an error toast.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { connector, session, onPowerChanged } from '@/core/session'
import { toast } from '@/core/toast'
import { composer } from '@/core/i18n'

export type PowerStatus = 'on' | 'off' | 'error' | 'init'

export interface PowerDevice {
  device: string
  status: PowerStatus
  locked_while_printing?: boolean
  type?: string
}

export const usePowerStore = defineStore('power', () => {
  const devices = ref<PowerDevice[]>([])
  // Devices mid-toggle: disables just that row's control, so a slow relay can't be double-tapped.
  const pending = ref<Set<string>>(new Set())
  const hasPower = computed(() => devices.value.length > 0)

  async function refresh(): Promise<void> {
    try {
      const r = await connector.call<{ devices?: PowerDevice[] }>('machine.device_power.devices')
      // A SUCCESSFUL reply is authoritative - even an empty list (a printer with no [power]
      // sections) correctly hides the Power rail tab.
      if (Array.isArray(r?.devices)) devices.value = r.devices
    } catch {
      // Transient failure (a query issued mid-reconnect, a momentary drop): keep the last-known
      // list rather than blanking a Power tab that really does exist. The next `live` edge, or a
      // notify_power_changed, re-syncs. If we never got a list, it simply stays empty.
    }
  }

  function apply(device: string, status: string): void {
    const d = devices.value.find((x) => x.device === device)
    if (d && (status === 'on' || status === 'off' || status === 'error' || status === 'init')) {
      d.status = status
    }
  }

  function setPending(device: string, on: boolean): void {
    const next = new Set(pending.value)
    if (on) next.add(device)
    else next.delete(device)
    pending.value = next
  }

  async function toggle(device: string): Promise<void> {
    if (pending.value.has(device)) return
    if (!session.live.value) {
      toast('error', composer.t('power.offline'))
      return
    }
    setPending(device, true)
    try {
      // Response echoes the device's new status: { "<device>": "on" | "off" | "error" }.
      const r = await connector.call<Record<string, string>>('machine.device_power.post_device', {
        device,
        action: 'toggle',
      })
      const status = r?.[device]
      if (status) apply(device, status)
    } catch {
      // Refused (e.g. locked while printing) or a transient error: tell the user and re-sync the
      // real state rather than leaving the toggle showing a value the device never took.
      toast('error', composer.t('power.error'))
      void refresh()
    } finally {
      setPending(device, false)
    }
  }

  let initialized = false
  function init(): void {
    if (initialized) return
    initialized = true
    void refresh()
    // Live status from any surface (an app, a physical button wired through Moonraker).
    onPowerChanged((changes) => {
      for (const c of changes) apply(c.device, c.status)
    })
    // The list/status aren't part of the printer-object subscription, so re-query whenever the
    // connection comes back (first connect and every reconnect).
    session.live.subscribe((live) => {
      if (live) void refresh()
    })
  }

  return { devices, pending, hasPower, refresh, toggle, init }
})
