// FilaMind screen — Tauri 2 entry. The UI (and all Moonraker I/O) lives in the webview;
// the Rust side just hosts the window. Keep it minimal until a native need appears.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the FilaMind screen application");
}
