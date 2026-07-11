import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/core/i18n'

const state = vi.hoisted(() => ({
  live: true,
  klippyReady: true,
  safeMode: false,
  busy: false,
  meta: null as Record<string, unknown> | null,
  thumb: null as string | null,
  objects: {} as Record<string, unknown>,
  startPrint: vi.fn(),
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
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
    startPrint: state.startPrint,
  }),
}))
vi.mock('@/core/jobMeta', async () => {
  const { computed } = await import('vue')
  return {
    useJobMeta: () => ({
      meta: computed(() => state.meta),
      thumb: computed(() => state.thumb),
    }),
  }
})

import StatusView from '../StatusView.vue'

const mountView = () => mount(StatusView, { global: { plugins: [i18n] } })

beforeEach(() => {
  vi.clearAllMocks()
  state.live = true
  state.klippyReady = true
  state.safeMode = false
  state.meta = { estimated_time: 7200 }
  state.thumb = 'http://printer.local/server/files/gcodes/.thumbs/part-300.png'
  state.objects = {
    print_stats: { state: 'printing', filename: 'part.gcode', print_duration: 3600 },
    virtual_sdcard: { progress: 0.5 },
    extruder: { temperature: 210, target: 215 },
    heater_bed: { temperature: 60, target: 60 },
    fan: { speed: 0.5 },
    gcode_move: { speed_factor: 1 },
  }
})

describe('StatusView job face', () => {
  it('shows the job thumbnail, elapsed time, and a wall-clock finish estimate', () => {
    const w = mountView()
    expect(w.find('img.job-thumb').attributes('src')).toBe(state.thumb)
    // 50% at 1h elapsed with a 2h slicer estimate -> both estimators say 1h remains.
    expect(w.text()).toContain(`${i18n.global.t('status.elapsed')} 1h 0m`)
    expect(w.text()).toContain('1h 0m') // the remaining-time readout
    const finishes = w.find('.times').text()
    expect(finishes).toMatch(/\d/) // carries a wall-clock time
  })

  it('falls back to the file-progress estimate when the slicer gave none', () => {
    state.meta = {}
    const w = mountView()
    expect(w.text()).toContain('1h 0m')
  })

  it('drops the slicer estimate once elapsed passes it (no drag toward zero)', () => {
    // Slicer said 5 min but the print is slow: 1h elapsed at 50% -> file says 1h remains. The
    // exhausted slicer estimate must be discarded, not blended as a 0 that would halve it.
    state.meta = { estimated_time: 300 }
    const w = mountView()
    expect(w.text()).toContain('1h 0m')
  })

  it('hides the finish time while paused (a fixed "ends at" would slide into the past)', () => {
    state.objects.print_stats = { state: 'paused', filename: 'part.gcode', print_duration: 3600 }
    const w = mountView()
    // Elapsed still shows, but no wall-clock finish while paused (the "ends ~" marker is absent).
    expect(w.find('.times').text()).toContain(i18n.global.t('status.elapsed'))
    expect(w.find('.times').text()).not.toContain('~')
  })

  it('explains WHY the print actions are blocked (safe mode) on the job face', () => {
    state.safeMode = true
    const w = mountView()
    expect(w.find('.blocked-hint').text()).toContain(i18n.global.t('control.blocked.safe'))
  })

  it('shows no hint when writes are allowed', () => {
    const w = mountView()
    expect(w.find('.blocked-hint').exists()).toBe(false)
  })

  it('offers Reprint when a job is complete and reruns the same file (no dead Pause button)', async () => {
    state.objects.print_stats = { state: 'complete', filename: 'part.gcode', print_duration: 3600 }
    const w = mountView()
    const btn = w.find('.reprint')
    expect(btn.exists()).toBe(true)
    // The old dead disabled Pause button must be gone once the job is done.
    expect(w.text()).not.toContain(i18n.global.t('control.pause'))
    await btn.trigger('click')
    expect(state.startPrint).toHaveBeenCalledWith('part.gcode')
  })
})
