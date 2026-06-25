import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/core/i18n'

const state = vi.hoisted(() => ({
  live: true,
  klippyReady: true,
  safeMode: false,
  busy: false,
  runGcode: vi.fn(),
  gcodeListener: null as ((line: string) => void) | null,
}))

vi.mock('@/core/session', () => ({
  onGcodeResponse: (fn: (line: string) => void) => {
    state.gcodeListener = fn
    return () => {
      state.gcodeListener = null
    }
  },
}))
vi.mock('@/core/store/session', () => ({
  useSessionStore: () => ({
    get live() {
      return state.live
    },
    get klippyReady() {
      return state.klippyReady
    },
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

import ConsoleView from '../ConsoleView.vue'

const mountView = () => mount(ConsoleView, { global: { plugins: [i18n] } })

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.klippyReady = true
  state.safeMode = false
  state.busy = false
  state.gcodeListener = null
})

describe('ConsoleView', () => {
  it('sends typed g-code through the gated store and echoes it', async () => {
    const w = mountView()
    await w.find('input').setValue('G28')
    await w.find('form').trigger('submit')
    expect(state.runGcode).toHaveBeenCalledWith('G28')
    expect(w.text()).toContain('G28')
  })

  it('shows Klipper responses streamed via onGcodeResponse', async () => {
    const w = mountView()
    state.gcodeListener?.('// echo: hello')
    await flushPromises()
    expect(w.text()).toContain('// echo: hello')
  })

  it('disables Send when writes are blocked', async () => {
    state.live = false
    const w = mountView()
    await w.find('input').setValue('G28')
    expect(w.find('button.send').attributes('disabled')).toBeDefined()
  })

  it('Clear empties the log', async () => {
    const w = mountView()
    state.gcodeListener?.('// line')
    await flushPromises()
    expect(w.findAll('.line').length).toBe(1)
    await w.find('button.clear').trigger('click')
    expect(w.findAll('.line').length).toBe(0)
  })

  it('unsubscribes from the response stream on unmount', () => {
    const w = mountView()
    expect(state.gcodeListener).toBeTypeOf('function')
    w.unmount()
    expect(state.gcodeListener).toBeNull()
  })
})
