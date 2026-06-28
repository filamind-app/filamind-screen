import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/core/i18n'

// Mutable plain state behind the mocked stores (set BEFORE mount per test) - no vue refs, so the
// real useWriteGuard reads live/klippy through getters and computes canWrite for real.
const state = vi.hoisted(() => ({
  live: true,
  klippyReady: true,
  safeMode: false,
  busy: false,
  runGcode: vi.fn(),
  objects: {
    gcode_move: { speed_factor: 1, extrude_factor: 1, homing_origin: [0, 0, 0, 0] },
    fan: { speed: 0 },
  } as Record<string, unknown>,
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

import TuneView from '../TuneView.vue'

const mountView = () => mount(TuneView, { global: { plugins: [i18n] } })
// rows render in order: speed, flow, zoff, fan.
const stepBtn = (w: ReturnType<typeof mountView>, row: number, label: string) =>
  w
    .findAll('.row')
    [row]!.findAll('button.step')
    .find((b) => b.text() === label)!

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.klippyReady = true
  state.safeMode = false
  state.busy = false
  state.objects = {
    gcode_move: { speed_factor: 1, extrude_factor: 1, homing_origin: [0, 0, 0, 0] },
    fan: { speed: 0 },
  }
})

describe('TuneView', () => {
  it('nudges speed with M220 relative to the live factor', async () => {
    const w = mountView()
    await stepBtn(w, 0, '+5').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('M220 S105')
  })

  it('nudges flow with M221', async () => {
    const w = mountView()
    await stepBtn(w, 1, '-5').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('M221 S95')
  })

  it('babysteps Z with SET_GCODE_OFFSET Z_ADJUST', async () => {
    const w = mountView()
    await stepBtn(w, 2, '+0.01').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('SET_GCODE_OFFSET Z_ADJUST=0.010 MOVE=1')
  })

  it('sets the fan as a 0-255 value', async () => {
    const w = mountView()
    await stepBtn(w, 3, '+25').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('M106 S64') // 25% of 255
  })

  it('reset restores the default (speed 100%)', async () => {
    const w = mountView()
    await w.findAll('.row')[0]!.find('button.reset').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('M220 S100')
  })

  it('disables the adjusters when writes are blocked', () => {
    state.live = false
    const w = mountView()
    expect(stepBtn(w, 0, '+5').attributes('disabled')).toBeDefined()
  })
})
