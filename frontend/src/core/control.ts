// The machine-control write path. Every mutation funnels through the core WriteArbiter
// (§12 spine): refused unless the connection is live AND Klippy is ready, or while safe-mode
// is on. Emergency stop INTENTIONALLY bypasses the gate (but is logged).

import { WriteArbiter, Logger } from '@filamind-app/core'
import { session, connector } from './session'

export const logger = new Logger()

export const arbiter = new WriteArbiter(() => {
  const ok = session.live.value && session.klippy.value === 'ready'
  return ok ? { ok: true } : { ok: false, reason: 'printer-not-live' }
}, logger)

const gcode = (script: string): Promise<unknown> =>
  connector.call('printer.gcode.script', { script })

export const control = {
  runGcode: (script: string) => arbiter.run('gcode', () => gcode(script)),
  home: () => arbiter.run('home', () => gcode('G28')),
  pause: () => arbiter.run('pause', () => connector.call('printer.print.pause')),
  resume: () => arbiter.run('resume', () => connector.call('printer.print.resume')),
  cancel: () => arbiter.run('cancel', () => connector.call('printer.print.cancel')),
  startPrint: (filename: string) =>
    arbiter.run('start', () => connector.call('printer.print.start', { filename })),
  emergencyStop: (): Promise<unknown> => {
    logger.warn('emergency-stop')
    return connector.call('printer.emergency_stop')
  },
  setSafeMode: (on: boolean) => arbiter.setSafeMode(on),
}
