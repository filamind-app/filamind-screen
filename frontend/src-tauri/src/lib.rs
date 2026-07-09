// FilaMind screen - Tauri 2 entry. The UI (and all Moonraker I/O) lives in the webview;
// the Rust side just hosts the window. Keep it minimal until a native need appears.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            fit_window_to_display(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the FilaMind screen application");
}

/// Size + position the window to the physical display at startup.
///
/// On the printer kiosk the app runs on a bare display server with no window manager, so the
/// `fullscreen` window hint may never be honored (it needs a WM) and a fixed-size window would
/// overhang a smaller panel - e.g. a 1024x600 window on an 800x480 touchscreen leaves the whole
/// bottom tab bar off-screen. Setting the position and size explicitly works with or without a
/// window manager, on every panel size. Release-Linux only: dev builds on a desktop keep normal
/// window behavior.
#[cfg(all(target_os = "linux", not(debug_assertions)))]
fn fit_window_to_display(app: &tauri::App) {
    use tauri::{Manager, PhysicalPosition};
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if let Ok(Some(monitor)) = window.current_monitor() {
        let _ = window.set_position(PhysicalPosition::new(0, 0));
        let _ = window.set_size(*monitor.size());
    }
    // Best-effort: harmless without a WM, correct with one.
    let _ = window.set_fullscreen(true);
}

#[cfg(not(all(target_os = "linux", not(debug_assertions))))]
fn fit_window_to_display(_app: &tauri::App) {}
