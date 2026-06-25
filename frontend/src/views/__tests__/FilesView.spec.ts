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

vi.mock('@/core/session', () => ({ connector: { call: state.call }, session: {} }))
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

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.klippyReady = true
  state.safeMode = false
  state.busy = false
  state.lastError = null
  state.objects = { print_stats: { state: 'standby' } }
  state.call.mockResolvedValue([
    { path: 'older.gcode', modified: 100, size: 1000 },
    { path: 'newer.gcode', modified: 200, size: 5_000_000 },
  ])
})

describe('FilesView', () => {
  it('loads the gcodes root and lists newest first', async () => {
    const w = mountView()
    await flushPromises()
    expect(state.call).toHaveBeenCalledWith('server.files.list', { root: 'gcodes' })
    const names = w.findAll('.file-name').map((n) => n.text())
    expect(names).toEqual(['newer.gcode', 'older.gcode'])
  })

  it('selecting a file and pressing Print starts it through the gated store', async () => {
    const w = mountView()
    await flushPromises()
    await w.findAll('button.file')[0]!.trigger('click') // newer.gcode
    await w.find('button.print').trigger('click')
    await flushPromises()
    expect(state.startPrint).toHaveBeenCalledWith('newer.gcode')
  })

  it('hides Print and shows a busy hint while a print is running', async () => {
    state.objects = { print_stats: { state: 'printing' } }
    const w = mountView()
    await flushPromises()
    await w.findAll('button.file')[0]!.trigger('click')
    expect(w.find('button.print').exists()).toBe(false)
    expect(w.text()).toContain(i18n.global.t('files.busy'))
  })

  it('disables Print when writes are blocked', async () => {
    state.live = false
    const w = mountView()
    await flushPromises()
    await w.findAll('button.file')[0]!.trigger('click')
    expect(w.find('button.print').attributes('disabled')).toBeDefined()
  })

  it('surfaces a load error', async () => {
    state.call.mockRejectedValue(new Error('boom'))
    const w = mountView()
    await flushPromises()
    expect(w.text()).toContain('boom')
  })
})
