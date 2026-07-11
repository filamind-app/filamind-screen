// Panel backlight control. The webview can't touch /sys, so a tiny Tauri command does the write
// (see src-tauri). Outside Tauri (the browser-preview build) there is no command - the call is a
// no-op, so the brightness slider still moves and persists, it just doesn't drive hardware.

/** Apply a backlight level (0.1..1) to the panel. Best-effort: never throws. */
export async function applyBacklight(level: number): Promise<void> {
  const pct = Math.round(Math.max(0.1, Math.min(1, level)) * 100)
  try {
    // Lazy import so the browser build (no @tauri-apps runtime) doesn't hard-fail at load.
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_backlight', { percent: pct })
  } catch {
    // Not running under Tauri, or the backlight isn't writable yet (needs the udev rule from a
    // reboot after install). The stored preference stays; the hardware just isn't driven.
  }
}
