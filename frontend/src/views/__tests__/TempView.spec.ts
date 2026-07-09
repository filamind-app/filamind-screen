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

import TempView from '../TempView.vue'

const mountView = () => mount(TempView, { global: { plugins: [i18n] } })

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.klippyReady = true
  state.safeMode = false
  state.busy = false
  state.objects = {
    heaters: {
      available_heaters: ['extruder', 'heater_bed'],
      available_sensors: ['extruder', 'heater_bed', 'temperature_sensor mcu'],
    },
    extruder: { temperature: 24.6, target: 0 },
    heater_bed: { temperature: 23.1, target: 0 },
    'temperature_sensor mcu': { temperature: 41.2 },
    configfile: {
      settings: { extruder: { max_temp: 300 }, heater_bed: { max_temp: 90 } },
    },
  }
})

describe('TempView', () => {
  it('renders every discovered heater plus the bare sensors read-only', () => {
    const w = mountView()
    const heaterRows = w.findAll('button.heater')
    expect(heaterRows).toHaveLength(2)
    expect(heaterRows[0]!.text()).toContain('Hotend')
    expect(heaterRows[1]!.text()).toContain('Bed')
    // The bare sensor is a non-interactive row showing its short name.
    const sensorRows = w.findAll('.sensor')
    expect(sensorRows).toHaveLength(1)
    expect(sensorRows[0]!.text()).toContain('mcu')
    expect(sensorRows[0]!.text()).toContain('41°')
  })

  it('applies a material preset to hotend + bed as ONE script (a second call would be dropped by the busy gate)', async () => {
    const w = mountView()
    const pla = w.findAll('button.preset').find((b) => b.text().includes('PLA'))!
    await pla.trigger('click')
    expect(state.runGcode).toHaveBeenCalledTimes(1)
    expect(state.runGcode).toHaveBeenCalledWith(
      'SET_HEATER_TEMPERATURE HEATER="extruder" TARGET=200\n' +
        'SET_HEATER_TEMPERATURE HEATER="heater_bed" TARGET=60',
    )
  })

  it("backs a preset off BELOW the heater's configured ceiling (max_temp is the shutdown threshold)", async () => {
    const w = mountView()
    const abs = w.findAll('button.preset').find((b) => b.text().includes('ABS'))!
    await abs.trigger('click')
    // ABS wants bed 100 but this printer's bed max_temp is 90 -> 85 keeps overshoot headroom.
    const script = state.runGcode.mock.calls[0]![0] as string
    expect(script).toContain('SET_HEATER_TEMPERATURE HEATER="heater_bed" TARGET=85')
  })

  it('turns everything off with TURN_OFF_HEATERS', async () => {
    const w = mountView()
    await w.find('button.preset.off').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('TURN_OFF_HEATERS')
  })

  it('sets a tapped heater target through the numpad, range-checked (name quoted)', async () => {
    const w = mountView()
    await w.findAll('button.heater')[0]!.trigger('click')
    const pad = w.find('.numpad')
    expect(pad.exists()).toBe(true)
    // The list yields the height budget to the pad while editing.
    expect(w.find('.list').exists()).toBe(false)
    const key = (label: string) => pad.findAll('button.key').find((b) => b.text() === label)!
    await key('2').trigger('click')
    await key('1').trigger('click')
    await key('5').trigger('click')
    await key('✓').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith(
      'SET_HEATER_TEMPERATURE HEATER="extruder" TARGET=215',
    )
  })

  it('quotes a discovered heater name containing a space', async () => {
    ;(state.objects['heaters'] as { available_heaters: string[] }).available_heaters = [
      'heater_generic chamber',
    ]
    state.objects['heater_generic chamber'] = { temperature: 30, target: 0 }
    ;(state.objects['configfile'] as { settings: Record<string, unknown> }).settings[
      'heater_generic chamber'
    ] = { max_temp: 80 }
    const w = mountView()
    await w.findAll('button.heater')[0]!.trigger('click')
    const pad = w.find('.numpad')
    const key = (label: string) => pad.findAll('button.key').find((b) => b.text() === label)!
    await key('6').trigger('click')
    await key('0').trigger('click')
    await key('✓').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith(
      'SET_HEATER_TEMPERATURE HEATER="heater_generic chamber" TARGET=60',
    )
  })

  it('accepts 0 on the numpad (turn one heater off)', async () => {
    const w = mountView()
    await w.findAll('button.heater')[0]!.trigger('click')
    const pad = w.find('.numpad')
    const key = (label: string) => pad.findAll('button.key').find((b) => b.text() === label)!
    await key('0').trigger('click')
    await key('✓').trigger('click')
    expect(state.runGcode).toHaveBeenCalledWith('SET_HEATER_TEMPERATURE HEATER="extruder" TARGET=0')
  })

  it('refuses an out-of-range numpad value (OK stays disabled)', async () => {
    const w = mountView()
    await w.findAll('button.heater')[0]!.trigger('click')
    const pad = w.find('.numpad')
    const key = (label: string) => pad.findAll('button.key').find((b) => b.text() === label)!
    await key('9').trigger('click')
    await key('9').trigger('click')
    await key('9').trigger('click') // 999 > extruder max_temp 300
    expect(key('✓').attributes('disabled')).toBeDefined()
  })

  it('disables the controls when writes are blocked', () => {
    state.live = false
    const w = mountView()
    expect(w.findAll('button.heater')[0]!.attributes('disabled')).toBeDefined()
    expect(w.findAll('button.preset')[0]!.attributes('disabled')).toBeDefined()
  })
})
