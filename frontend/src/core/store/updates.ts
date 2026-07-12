// Moonraker update manager: the versions of the printer's managed components (Klipper, Moonraker,
// the host OS packages, and any configured web UIs / klipper extras) and the actions to update or
// recover them. Component NAMES come straight from Moonraker's runtime status - this is the user's
// own configured system, not anything named in our source. Reads over the machine API; a running
// update streams its log through the notify_update_response event teed in session.ts.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { connector, session, onUpdateResponse } from '@/core/session'
import { toast } from '@/core/toast'
import { composer } from '@/core/i18n'

export interface UpdateComponent {
  name: string
  version: string
  remoteVersion: string
  updateAvailable: boolean
  dirty: boolean
  valid: boolean
  type: string
}

interface RawInfo {
  version?: string
  remote_version?: string
  is_dirty?: boolean
  is_valid?: boolean
  configured_type?: string
  package_count?: number
}

export const useUpdatesStore = defineStore('updates', () => {
  const components = ref<UpdateComponent[]>([])
  const busy = ref(false) // an update is running (here or triggered elsewhere)
  const checking = ref(false) // a remote version check is in flight
  const running = ref('') // the component currently updating
  const log = ref<string[]>([]) // streaming update output

  const hasComponents = computed(() => components.value.length > 0)
  const outdated = computed(() => components.value.filter((c) => c.updateAvailable).length)

  function parse(vi: Record<string, RawInfo>): UpdateComponent[] {
    const out: UpdateComponent[] = []
    for (const [name, c] of Object.entries(vi ?? {})) {
      const type = c.configured_type ?? 'unknown'
      if (type === 'system') {
        // The host OS entry reports a pending-package count, not a version string.
        const n = c.package_count ?? 0
        out.push({
          name,
          version: '',
          remoteVersion: '',
          updateAvailable: n > 0,
          dirty: false,
          valid: true,
          type,
        })
        continue
      }
      const version = c.version ?? ''
      const remote = c.remote_version ?? ''
      out.push({
        name,
        version,
        remoteVersion: remote,
        updateAvailable: !!remote && !!version && remote !== version,
        dirty: !!c.is_dirty,
        valid: c.is_valid !== false,
        type,
      })
    }
    return out
  }

  async function load(refresh: boolean): Promise<void> {
    if (refresh) checking.value = true
    try {
      // refresh:false uses Moonraker's cache (no GitHub hit); refresh:true re-checks remotes and is
      // rate-limited, so it's only ever fired by an explicit "Check for updates" tap.
      const r = await connector.call<{ version_info?: Record<string, RawInfo>; busy?: boolean }>(
        'machine.update.status',
        { refresh },
      )
      if (r?.version_info) components.value = parse(r.version_info)
      busy.value = !!r?.busy
    } catch {
      // Keep the last-known list on a transient failure (see the power store for the rationale).
    } finally {
      checking.value = false
    }
  }

  const refresh = (): Promise<void> => load(false)
  const check = (): Promise<void> => load(true)

  // Moonraker exposes dedicated endpoints for the core pieces and a generic one for everything else.
  function methodFor(name: string): [string, Record<string, unknown>] {
    if (name === 'klipper') return ['machine.update.klipper', {}]
    if (name === 'moonraker') return ['machine.update.moonraker', {}]
    if (name === 'system') return ['machine.update.system', {}]
    return ['machine.update.client', { name }]
  }

  async function run(name: string, call: () => Promise<unknown>): Promise<void> {
    if (busy.value || !session.live.value) return
    busy.value = true
    running.value = name
    log.value = []
    try {
      await call()
    } catch {
      // Refused (mid-print, or a genuine failure): the log usually carries the reason; surface a
      // toast too. Moonraker refuses updates while printing, which is exactly what we want.
      toast('error', composer.t('updates.error'))
    } finally {
      // notify_update_response's `complete` also clears these; belt-and-suspenders for a call that
      // resolves/rejects without a final event.
      busy.value = false
      running.value = ''
      void load(false)
    }
  }

  function update(name: string): Promise<void> {
    const [method, params] = methodFor(name)
    return run(name, () => connector.call(method, params))
  }
  function recover(name: string): Promise<void> {
    return run(name, () => connector.call('machine.update.recover', { name, hard: false }))
  }

  let initialized = false
  function init(): void {
    if (initialized) return
    initialized = true
    void load(false)
    onUpdateResponse((r) => {
      if (r.message) log.value = [...log.value.slice(-200), r.message]
      if (r.complete) {
        busy.value = false
        running.value = ''
        void load(false)
      }
    })
    session.live.subscribe((live) => {
      if (live) void load(false)
    })
  }

  return {
    components,
    busy,
    checking,
    running,
    log,
    hasComponents,
    outdated,
    refresh,
    check,
    update,
    recover,
    init,
  }
})
