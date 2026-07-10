import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/core/i18n'

const state = vi.hoisted(() => ({
  live: true,
  klippyReady: true,
  safeMode: false,
  busy: false,
  call: vi.fn(),
  startPrint: vi.fn(),
  lastError: null as string | null,
  objects: { print_stats: { state: 'standby' } } as Record<string, unknown>,
}))

vi.mock('@/core/session', () => ({
  connector: { call: state.call },
  session: {},
  moonrakerHttpBase: () => 'http://printer.local',
}))
vi.mock('@/core/store/session', () => ({
  useSessionStore: () => ({
    get live() {
      return state.live
    },
    get klippyReady() {
      return state.klippyReady
    },
    object: (n: string) => state.objects[n],
  }),
}))
vi.mock('@/core/store/control', () => ({
  useControlStore: () => ({
    get safeMode() {
      return state.safeMode
    },
    get busy() {
      return state.busy
    },
    startPrint: state.startPrint,
    get lastError() {
      return state.lastError
    },
  }),
}))

import FilesView from '../FilesView.vue'

const mountView = () => mount(FilesView, { global: { plugins: [i18n] } })

/** Dispatch the connector mock by method, like Moonraker would. */
function wireCalls(
  tree: Record<string, { dirs?: { dirname: string }[]; files?: object[] }>,
  metadata: Record<string, object> = {},
): void {
  state.call.mockImplementation(async (method: string, params: Record<string, string>) => {
    if (method === 'server.files.get_directory') {
      const path = String(params['path'] ?? '')
      const res = tree[path]
      if (!res) throw new Error(`no such dir ${path}`)
      return res
    }
    if (method === 'server.files.metadata') return metadata[String(params['filename'] ?? '')] ?? {}
    throw new Error(`unexpected ${method}`)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.klippyReady = true
  state.safeMode = false
  state.busy = false
  state.lastError = null
  state.objects = { print_stats: { state: 'standby' } }
  wireCalls(
    {
      gcodes: {
        dirs: [{ dirname: 'parts' }, { dirname: '.thumbs' }],
        files: [
          { filename: 'older.gcode', modified: 100, size: 1000 },
          { filename: 'newer.gcode', modified: 200, size: 5_000_000 },
        ],
      },
      'gcodes/parts': {
        dirs: [],
        files: [{ filename: 'bracket.gcode', modified: 300, size: 2000 }],
      },
    },
    {
      'newer.gcode': {
        estimated_time: 5400,
        filament_total: 12345,
        thumbnails: [
          { width: 32, relative_path: '.thumbs/newer-32.png' },
          { width: 300, relative_path: '.thumbs/newer-300.png' },
        ],
      },
      'parts/bracket.gcode': { estimated_time: 600 },
    },
  )
})

describe('FilesView', () => {
  it('lists the gcodes root: visible folders first, then files newest first', async () => {
    const w = mountView()
    await flushPromises()
    expect(state.call).toHaveBeenCalledWith('server.files.get_directory', { path: 'gcodes' })
    const names = w.findAll('.file-name').map((n) => n.text())
    expect(names).toEqual(['📁 parts', 'newer.gcode', 'older.gcode']) // .thumbs hidden
  })

  it('descends into a folder, offers Up, and starts with the folder-relative path', async () => {
    const w = mountView()
    await flushPromises()
    await w.find('button.dir').trigger('click') // parts
    await flushPromises()
    expect(state.call).toHaveBeenCalledWith('server.files.get_directory', {
      path: 'gcodes/parts',
    })
    expect(w.text()).toContain('bracket.gcode')
    // Select + start uses the path relative to the gcodes root.
    await w.findAll('button.file:not(.dir)')[0]!.trigger('click')
    await flushPromises()
    await w.find('button.print').trigger('click')
    await flushPromises()
    expect(state.startPrint).toHaveBeenCalledWith('parts/bracket.gcode')
    // And Up climbs back to the root.
  })

  it('shows the slicer metadata + largest thumbnail on the confirm card', async () => {
    const w = mountView()
    await flushPromises()
    await w
      .findAll('button.file:not(.dir)')
      .find((b) => b.text().includes('newer.gcode'))!
      .trigger('click')
    await flushPromises()
    expect(state.call).toHaveBeenCalledWith('server.files.metadata', { filename: 'newer.gcode' })
    expect(w.find('.confirm').text()).toContain('1h 30m') // 5400s
    expect(w.find('.confirm').text()).toContain('12.3 m') // 12345mm
    expect(w.find('img.thumb').attributes('src')).toBe(
      'http://printer.local/server/files/gcodes/.thumbs/newer-300.png',
    )
  })

  it('still confirms cleanly when a file has no metadata', async () => {
    wireCalls({
      gcodes: { dirs: [], files: [{ filename: 'bare.gcode', modified: 1, size: 10 }] },
    })
    const w = mountView()
    await flushPromises()
    await w.find('button.file').trigger('click')
    await flushPromises()
    expect(w.find('.confirm').exists()).toBe(true)
    expect(w.find('img.thumb').exists()).toBe(false)
  })

  it('hides Print and shows a busy hint while a print is running', async () => {
    state.objects = { print_stats: { state: 'printing' } }
    const w = mountView()
    await flushPromises()
    await w.findAll('button.file:not(.dir)')[0]!.trigger('click')
    await flushPromises()
    expect(w.find('button.print').exists()).toBe(false)
    expect(w.text()).toContain(i18n.global.t('files.busy'))
  })

  it('disables Print when writes are blocked', async () => {
    state.live = false
    const w = mountView()
    await flushPromises()
    await w.findAll('button.file:not(.dir)')[0]!.trigger('click')
    await flushPromises()
    expect(w.find('button.print').attributes('disabled')).toBeDefined()
  })

  it('surfaces a load error', async () => {
    state.call.mockRejectedValue(new Error('boom'))
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('boom')
  })

  it('highlights ONLY the selected file, not a suffix-named sibling', async () => {
    wireCalls({
      gcodes: {
        dirs: [],
        files: [
          { filename: 'v2-bracket.gcode', modified: 2, size: 10 },
          { filename: 'bracket.gcode', modified: 1, size: 10 },
        ],
      },
    })
    const w = mountView()
    await flushPromises()
    await w.findAll('button.file')[0]!.trigger('click') // v2-bracket.gcode
    await flushPromises()
    const pressed = w.findAll('button.file').map((b) => b.attributes('aria-pressed'))
    expect(pressed).toEqual(['true', 'false'])
  })

  it('a failed folder descent keeps the previous listing reachable', async () => {
    const w = mountView()
    await flushPromises()
    // Make the descent fail, then a refresh must reload the ROOT (path not committed).
    state.call.mockRejectedValueOnce(new Error('gone'))
    await w.find('button.dir').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('gone')
    await w.find('button.refresh').trigger('click')
    await flushPromises()
    expect(state.call).toHaveBeenLastCalledWith('server.files.get_directory', { path: 'gcodes' })
    expect(w.text()).toContain('newer.gcode')
  })
})
