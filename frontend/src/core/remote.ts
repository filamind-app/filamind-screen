// Receiver for cross-surface remote-control commands. Another FilaMind surface (e.g. FilaMind 3d)
// broadcasts UI-only commands over Moonraker's agent-event bus; @filamind-app/core validates them, and
// this reactive module turns a valid command into touch-UI state (switch tab / show banner / flash).
//
// Commands are discrete, so navigate carries a monotonic nonce: re-issuing the SAME view still
// produces a new object, so the watcher in TouchShell re-fires even when the view is unchanged.

import { ref } from 'vue'
import {
  handleAgentCommand,
  type AgentEvent,
  type RemoteCommand,
  type RemoteView,
  type RemoteMessageLevel,
} from '@filamind-app/core'

interface NavRequest {
  view: RemoteView
  n: number
}
interface Banner {
  level: RemoteMessageLevel
  text: string
}

const BANNER_MS = 8000
const LOCATE_MS = 4000

// single-writer (dispatch); components only read.
const nav = ref<NavRequest | null>(null)
const banner = ref<Banner | null>(null)
const locating = ref(false)

export const remoteNav = nav
export const remoteBanner = banner
export const remoteLocating = locating

let nonce = 0
let bannerTimer: ReturnType<typeof setTimeout> | undefined
let locateTimer: ReturnType<typeof setTimeout> | undefined

export function dismissBanner(): void {
  banner.value = null
  if (bannerTimer) clearTimeout(bannerTimer)
}

function dispatch(cmd: RemoteCommand): void {
  switch (cmd.kind) {
    case 'navigate':
      nav.value = { view: cmd.view, n: ++nonce }
      break
    case 'message':
      banner.value = { level: cmd.level, text: cmd.text }
      if (bannerTimer) clearTimeout(bannerTimer)
      bannerTimer = setTimeout(() => (banner.value = null), BANNER_MS)
      break
    case 'locate':
      locating.value = true
      if (locateTimer) clearTimeout(locateTimer)
      locateTimer = setTimeout(() => (locating.value = false), LOCATE_MS)
      break
  }
}

/** Pass to FilaMindSession's onAgentEvent - validates the bus event then dispatches a typed command.
 *  Only accept commands from FilaMind surfaces (best-effort: client_name is self-asserted, which is why
 *  the commands stay strictly UI-only). */
export function onRemoteAgentEvent(ev: AgentEvent): void {
  handleAgentCommand(ev, dispatch, { allowFrom: (a) => a.startsWith('FilaMind ') })
}
