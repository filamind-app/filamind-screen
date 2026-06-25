import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/core/i18n'

// Mutable, non-reactive backing state for the mocked stores (set BEFORE mount per test). Plain
// values — no vue refs — so vi.hoisted has no TDZ and useWriteGuard reads them through real getters.
const state = vi.hoisted(() => ({
  live: true,
  klippyReady: true,
  safeMode: false,
  busy: false,
  runGcode: vi.fn(),
  home: vi.fn(),
  toolhead: { position: [10, 20, 5, 0], homed_axes: 'xyz' } as Record<string, unknown>,
}))

vi.mock('@/core/store/session', () => ({
  useSessionStore: () => ({
    get live() {
      return state.live
    },
    get klippyReady() {
      return state.klippyReady
    },
    object: () => state.toolhead,
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
    home: state.home,
    lastError: null,
  }),
}))

import MoveView from '../MoveView.vue'

const mountView = () => mount(MoveView, { global: { plugins: [i18n] } })
const jog = (w: ReturnType<typeof mountView>, label: string) =>
  w.findAll('button.jog').find((b) => b.text() === label)!

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.klippyReady = true
  state.safeMode = false
  state.busy = false
  state.toolhead = { position: [10, 20, 5, 0], homed_axes: 'xyz' }
})

describe('MoveView jog tool', () => {
  it('jogs a relative move at the selected step through the gated store', async () => {
    const w = mountView()
    await jog(w, 'X+').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('G91\nG1 X10.00 F6000\nG90')
  })

  it('changing the step changes the jog distance', async () => {
    const w = mountView()
    await w
      .findAll('button.step')
      .find((b) => b.text() === '100')!
      .trigger('click')
    await jog(w, 'X+').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('G91\nG1 X100.00 F6000\nG90')
  })

  it('feeds Z slower than XY', async () => {
    const w = mountView()
    await jog(w, 'Z+').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('G91\nG1 Z10.00 F600\nG90')
  })

  it('Home all uses the store home action (G28)', async () => {
    const w = mountView()
    await w.find('button.home').trigger('click')
    expect(state.home).toHaveBeenCalledOnce()
  })

  it('back emits close', async () => {
    const w = mountView()
    await w.find('button.back').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })

  it('disables jog when writes are blocked (printer not live)', () => {
    state.live = false
    const w = mountView()
    expect(jog(w, 'X+').attributes('disabled')).toBeDefined()
  })
})
