// Slicer metadata for the CURRENT job: fetched at the start of each print run (and on a filename
// change), exposed reactively to the job face (thumbnail + the slicer's time estimate for the
// blended remaining-time figure). Only loads while a job is active - the job face is the only
// consumer, and it shows nothing otherwise.

import { ref, watch } from 'vue'
import { useSessionStore } from '@/core/store/session'
import { fetchMetadata, thumbnailUrl, type GcodeMetadata } from '@/core/files'

export function useJobMeta() {
  const session = useSessionStore()
  const meta = ref<GcodeMetadata | null>(null)
  const thumb = ref<string | null>(null)

  const currentFilename = (): string =>
    session.object<{ filename?: string }>('print_stats')?.filename ?? ''

  function load(name: string): void {
    meta.value = null
    thumb.value = null
    if (!name) return
    void fetchMetadata(name)
      .then((m) => {
        // Ignore a stale response if the job changed while the call was in flight.
        if (currentFilename() !== name) return
        meta.value = m
        thumb.value = thumbnailUrl(name, m)
      })
      .catch(() => {
        // Same stale-guard on failure: a late rejection for a previous job must not clobber the
        // metadata the current job already loaded.
        if (currentFilename() === name) meta.value = {}
      })
  }

  // Identity of the loaded metadata: filename + a run token that ticks on each entry into an
  // ACTIVE state from a non-active one. A re-slice/re-upload keeps the filename, so the token is
  // what forces a refetch when the same file is reprinted; keying on "active from non-active"
  // (not "printing") means a pause->resume stays the same run and does NOT refetch.
  let prevActive = false
  let runToken = 0
  let loadedId = ''
  watch(
    () => {
      const s = session.object<{ filename?: string; state?: string }>('print_stats')
      return `${s?.filename ?? ''}|${s?.state ?? ''}`
    },
    () => {
      const s = session.object<{ filename?: string; state?: string }>('print_stats')
      const name = s?.filename ?? ''
      const active = s?.state === 'printing' || s?.state === 'paused'
      if (active && !prevActive) runToken++
      prevActive = active
      // Outside an active job the face shows nothing; clear so the next run always reloads.
      if (!active || !name) {
        loadedId = ''
        return
      }
      const id = `${name}#${runToken}`
      if (id === loadedId) return
      loadedId = id
      load(name)
    },
    { immediate: true },
  )

  return { meta, thumb }
}
