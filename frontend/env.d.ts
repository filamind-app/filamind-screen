/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ws(s)://host:port/websocket - the printer's Moonraker (required in the Tauri bundle). */
  readonly VITE_MOONRAKER_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __APP_VERSION__: string
