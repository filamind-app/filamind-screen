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
    object: (name: string) => state.objects[name],
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

import ExtrudeView from '../ExtrudeView.vue'

const mountView = () => mount(ExtrudeView, { global: { plugins: [i18n] } })
const actBtn = (w: ReturnType<typeof mountView>, text: string) =>
  w.findAll('button.act').find((b) => b.text().includes(text))!

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.klippyReady = true
  state.safeMode = false
  state.busy = false
  state.objects = {
    extruder: { temperature: 215, target: 215 },
    configfile: { settings: { extruder: { min_extrude_temp: 170 } } },
  }
})

describe('ExtrudeView', () => {
  it('extrudes the selected length inside a saved/restored g-code state', async () => {
    const w = mountView()
    await actBtn(w, 'Extrude').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith(
      'SAVE_GCODE_STATE NAME=_fm_extrude\nM83\nG1 E10.0 F300\nRESTORE_GCODE_STATE NAME=_fm_extrude',
    )
  })

  it('retracts with a negative relative move', async () => {
    const w = mountView()
    await actBtn(w, 'Retract').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith(
      'SAVE_GCODE_STATE NAME=_fm_extrude\nM83\nG1 E-10.0 F300\nRESTORE_GCODE_STATE NAME=_fm_extrude',
    )
  })

  it('honors the selected distance and speed', async () => {
    const w = mountView()
    await w
      .findAll('button.opt')
      .find((b) => b.text() === '50')!
      .trigger('click')
    await w
      .findAll('button.opt')
      .find((b) => b.text() === '2')!
      .trigger('click')
    await actBtn(w, 'Extrude').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith(
      'SAVE_GCODE_STATE NAME=_fm_extrude\nM83\nG1 E50.0 F120\nRESTORE_GCODE_STATE NAME=_fm_extrude',
    )
  })

  it("refuses to move filament below the printer's cold-extrusion floor", () => {
    state.objects = {
      extruder: { temperature: 25, target: 0 },
      configfile: { settings: { extruder: { min_extrude_temp: 170 } } },
    }
    const w = mountView()
    expect(w.find('.guard').exists()).toBe(true)
    expect(actBtn(w, 'Extrude').attributes('disabled')).toBeDefined()
  })

  it('one-tap heat targets comfortably above the floor', async () => {
    state.objects = {
      extruder: { temperature: 25, target: 0 },
      configfile: { settings: { extruder: { min_extrude_temp: 170 } } },
    }
    const w = mountView()
    await w.find('button.heat').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=210')
  })

  it('shows load/unload only when the printer defines the macros, and runs them', async () => {
    state.objects = {
      extruder: { temperature: 215, target: 215 },
      configfile: {
        settings: {
          extruder: { min_extrude_temp: 170 },
          'gcode_macro load_filament': {},
          'gcode_macro unload_filament': {},
        },
      },
    }
    const w = mountView()
    await actBtn(w, 'Load').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('LOAD_FILAMENT')
    expect(actBtn(w, 'Unload')).toBeDefined()
  })

  it('hides load/unload when the printer has no such macros', () => {
    const w = mountView()
    expect(w.findAll('button.act')).toHaveLength(2) // extrude + retract only
  })

  it('refuses to feed filament into a RUNNING print (paused stays allowed)', async () => {
    state.objects = {
      extruder: { temperature: 215, target: 215 },
      configfile: { settings: { extruder: { min_extrude_temp: 170 } } },
      print_stats: { state: 'printing' },
    }
    const w = mountView()
    expect(actBtn(w, 'Extrude').attributes('disabled')).toBeDefined()
    ;(state.objects['print_stats'] as { state: string }).state = 'paused'
    const w2 = mountView()
    expect(w2.findAll('button.act')[0]!.attributes('disabled')).toBeUndefined()
  })
})
