import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/core/i18n'

const state = vi.hoisted(() => ({
  live: true,
  klippyReady: true,
  safeMode: false,
  busy: false,
  runGcode: vi.fn(),
  objects: {} as Record<string, unknown>,
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
    runGcode: state.runGcode,
    lastError: null,
  }),
}))

import MacrosView from '../MacrosView.vue'

const mountView = () => mount(MacrosView, { global: { plugins: [i18n] } })

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.klippyReady = true
  state.safeMode = false
  state.busy = false
  state.objects = {
    configfile: {
      settings: {
        'gcode_macro park_toolhead': {},
        'gcode_macro _internal_helper': {},
        'gcode_macro load_filament': {},
        extruder: {},
      },
    },
  }
})

describe('MacrosView', () => {
  it('lists the user macros sorted, hiding underscore-prefixed internals', () => {
    const w = mountView()
    const labels = w.findAll('button.macro').map((b) => b.text())
    expect(labels).toEqual(['LOAD_FILAMENT', 'PARK_TOOLHEAD'])
  })

  it('runs a tapped macro through the gated store', async () => {
    const w = mountView()
    await w.findAll('button.macro')[1]!.trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('PARK_TOOLHEAD')
  })

  it('shows an empty state when the printer defines no user macros', () => {
    state.objects = { configfile: { settings: { extruder: {} } } }
    const w = mountView()
    expect(w.findAll('button.macro')).toHaveLength(0)
    expect(w.text()).toContain(i18n.global.t('macros.empty'))
  })

  it('disables macros when writes are blocked', () => {
    state.live = false
    const w = mountView()
    expect(w.findAll('button.macro')[0]!.attributes('disabled')).toBeDefined()
  })

  it('refuses to run a macro into a RUNNING print (paused stays allowed)', async () => {
    ;(state.objects as Record<string, unknown>)['print_stats'] = { state: 'printing' }
    const w = mountView()
    expect(w.findAll('button.macro')[0]!.attributes('disabled')).toBeDefined()
    ;(state.objects as Record<string, unknown>)['print_stats'] = { state: 'paused' }
    const w2 = mountView()
    expect(w2.findAll('button.macro')[0]!.attributes('disabled')).toBeUndefined()
    await w2.findAll('button.macro')[0]!.trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('LOAD_FILAMENT')
  })
})
