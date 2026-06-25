// The single MoonrakerClient + FilaMindSession for the touch app, from @filamind-app/core.
// Identity is 'display' (an on-printer screen) so the host can tell surfaces apart (F10).

import { MoonrakerClient, FilaMindSession, FULL_CONTROL } from '@filamind-app/core'
import { onRemoteAgentEvent } from './remote'

function defaultWsUrl(): string {
  const env = import.meta.env.VITE_MOONRAKER_WS_URL
  if (env) return env
  const host = typeof window !== 'undefined' ? window.location?.host : ''
  // In the Tauri bundle the webview origin is tauri.localhost — NOT the printer. The screen
  // runs on the printer, so default to the local Moonraker. A browser served by Moonraker
  // (or VITE_MOONRAKER_WS_URL) overrides this.
  if (!host || host.includes('tauri') || host.includes('localhost')) {
    return 'ws://localhost:7125/websocket'
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${host}/websocket`
}

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

export const connector = new MoonrakerClient({ url: defaultWsUrl() })

// notify_gcode_response tee. FilaMindSession owns the connector's single callback sink (it parses
// gcode responses for M117 prompts), so the console can't call setCallbacks itself without clobbering
// it. We wrap setCallbacks once here, in the composition root: every callback the session installs is
// forwarded untouched, and gcode-response lines are additionally fanned out to console subscribers.
type GcodeLineListener = (line: string) => void
const gcodeLineListeners = new Set<GcodeLineListener>()
export function onGcodeResponse(fn: GcodeLineListener): () => void {
  gcodeLineListeners.add(fn)
  return () => {
    gcodeLineListeners.delete(fn)
  }
}
const _setCallbacks = connector.setCallbacks.bind(connector)
connector.setCallbacks = (cb) => {
  _setCallbacks({
    ...cb,
    onUpdate: (method, params) => {
      cb.onUpdate?.(method, params)
      if (method === 'notify_gcode_response' && Array.isArray(params)) {
        for (const line of params) {
          if (typeof line === 'string') gcodeLineListeners.forEach((l) => l(line))
        }
      }
    },
  })
}

export const session = new FilaMindSession(connector, {
  subscriptions: FULL_CONTROL,
  identify: { client_name: 'FilaMind screen', version: appVersion, type: 'display' },
  // Another surface (e.g. FilaMind 3d) can steer this screen via the agent-event bus.
  onAgentEvent: onRemoteAgentEvent,
})
