import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/core/i18n'

const state = vi.hoisted(() => ({
  prompt: null as unknown,
  live: true,
  runGcode: vi.fn(),
}))

vi.mock('@/core/store/session', () => ({
  useSessionStore: () => ({
    get prompt() {
      return state.prompt
    },
    get live() {
      return state.live
    },
  }),
}))
vi.mock('@/core/store/control', () => ({
  useControlStore: () => ({ runGcode: state.runGcode }),
}))

import PromptDialog from '../PromptDialog.vue'

const DIALOG = {
  title: 'Change filament',
  text: ['Ready?'],
  buttons: [{ label: 'Resume', gcode: 'RESUME' }],
  footer: [],
}

const mountDlg = () =>
  mount(PromptDialog, { global: { plugins: [i18n], stubs: { teleport: true } } })

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.prompt = { type: 'show', dialog: DIALOG }
  state.runGcode.mockResolvedValue(null)
})

describe('PromptDialog', () => {
  it('backdrop tap tucks the prompt away (macro still waiting) and the chip re-opens it', async () => {
    const w = mountDlg()
    await flushPromises()
    expect(w.find('.prompt').exists()).toBe(true)
    // Stray palm on the dimmed backdrop: hide, do NOT discard - nothing on this device could
    // re-summon the dialog, and the macro is still blocked on an answer.
    await w.find('.backdrop').trigger('click')
    expect(w.find('.prompt').exists()).toBe(false)
    const chip = w.find('.reopen-chip')
    expect(chip.exists()).toBe(true)
    await chip.trigger('click')
    await flushPromises()
    expect(w.find('.prompt').exists()).toBe(true)
  })

  it('runs a button gcode ONCE under a double-tap', async () => {
    let resolveFlight!: (v: null) => void
    state.runGcode.mockImplementation(() => new Promise((r) => (resolveFlight = r)))
    const w = mountDlg()
    await flushPromises()
    const btn = w.findAll('.prompt-actions button')[0]!
    await btn.trigger('click')
    await btn.trigger('click') // second tap while the first flight is pending
    expect(state.runGcode).toHaveBeenCalledTimes(1)
    resolveFlight(null)
    await flushPromises()
    expect(w.find('.prompt').exists()).toBe(false) // closes after its own success
  })

  it('stays open with its own inline error on failure (silent: no duplicate toast)', async () => {
    state.runGcode.mockResolvedValue('failed')
    const w = mountDlg()
    await flushPromises()
    await w.findAll('.prompt-actions button')[0]!.trigger('click')
    await flushPromises()
    expect(state.runGcode).toHaveBeenCalledWith('RESUME', { silent: true })
    expect(w.find('.prompt').exists()).toBe(true)
    expect(w.find('.prompt-error').exists()).toBe(true)
  })
})
