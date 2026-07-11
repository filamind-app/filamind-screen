import { effectScope, nextTick, reactive, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  printStats: null as { filename: string; state: string } | null,
  fetch: vi.fn(),
}))

vi.mock('@/core/store/session', () => ({
  useSessionStore: () => ({
    object: (n: string) => (n === 'print_stats' ? state.printStats : undefined),
  }),
}))
vi.mock('@/core/files', () => ({
  fetchMetadata: state.fetch,
  thumbnailUrl: (name: string, m: { thumbnails?: unknown }) =>
    m?.thumbnails ? `url:${name}` : null,
}))

import { useJobMeta } from '@/core/jobMeta'

// Reactive here (not in vi.hoisted, which runs before the vue import is initialized) so the
// composable's watch fires on mutation.
state.printStats = reactive({ filename: '', state: 'standby' })

/** Run the composable inside a scope so its watch is active, and hand back its refs. The scope
 *  is stopped after each test so a previous test's watcher can't fire on the shared reactive. */
let scopes: EffectScope[] = []
function run() {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useJobMeta())!
}
afterEach(() => {
  scopes.forEach((s) => s.stop())
  scopes = []
})

describe('useJobMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.printStats!.filename = ''
    state.printStats!.state = 'standby'
    state.fetch.mockResolvedValue({ estimated_time: 1200, thumbnails: [{}] })
  })

  it('fetches when a job starts and exposes the estimate + thumbnail', async () => {
    const { meta, thumb } = run()
    state.printStats!.filename = 'a.gcode'
    state.printStats!.state = 'printing'
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
    expect(state.fetch).toHaveBeenCalledWith('a.gcode')
    expect(meta.value?.estimated_time).toBe(1200)
    expect(thumb.value).toBe('url:a.gcode')
  })

  it('refetches when the SAME file is reprinted (re-slice keeps the name)', async () => {
    run()
    state.printStats!.filename = 'a.gcode'
    state.printStats!.state = 'printing'
    await nextTick()
    await Promise.resolve()
    const afterFirst = state.fetch.mock.calls.length
    expect(afterFirst).toBeGreaterThanOrEqual(1)
    expect(state.fetch).toHaveBeenLastCalledWith('a.gcode')

    // Job ends, then the same file is started again with a fresh slice.
    state.printStats!.state = 'complete'
    await nextTick()
    state.printStats!.state = 'printing'
    await nextTick()
    await Promise.resolve()
    expect(state.fetch.mock.calls.length).toBeGreaterThan(afterFirst) // a fresh fetch happened
  })

  it('does NOT refetch on a pause/resume within the same run', async () => {
    run()
    state.printStats!.filename = 'a.gcode'
    state.printStats!.state = 'printing'
    await nextTick()
    await Promise.resolve()
    const afterStart = state.fetch.mock.calls.length

    state.printStats!.state = 'paused'
    await nextTick()
    state.printStats!.state = 'printing' // resume - same run, same slice
    await nextTick()
    await Promise.resolve()
    expect(state.fetch.mock.calls.length).toBe(afterStart) // no extra fetch
  })

  it('a late rejection for a previous job does not clobber the current job metadata', async () => {
    // Job A's fetch hangs; job B's resolves; then A rejects late.
    let rejectA!: (e: Error) => void
    state.fetch.mockImplementationOnce(() => new Promise((_res, rej) => (rejectA = rej)))
    const { meta } = run()

    state.printStats!.filename = 'A.gcode'
    state.printStats!.state = 'printing'
    await nextTick()

    // Switch to B (resolves with real metadata).
    state.fetch.mockResolvedValueOnce({ estimated_time: 999, thumbnails: [{}] })
    state.printStats!.filename = 'B.gcode'
    await nextTick()
    await Promise.resolve()
    expect(meta.value?.estimated_time).toBe(999)

    // A finally rejects - the stale-guard in the catch must keep B's metadata.
    rejectA(new Error('timeout'))
    await Promise.resolve()
    expect(meta.value?.estimated_time).toBe(999)
  })
})
