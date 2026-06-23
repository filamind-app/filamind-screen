//! FilaMind screen native shell.
//!
//! A deliberately thin Tauri app: it opens one fullscreen WebKitGTK window onto the bundled touch
//! UI. All printer logic lives in the frontend (it talks to Moonraker directly over a WebSocket);
//! the shell only owns the window. Kept minimal so it builds small and starts fast on a low-power
//! single-board host.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running FilaMind screen");
}
