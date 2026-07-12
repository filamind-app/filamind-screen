// FilaMind screen - Tauri 2 entry. The UI (and all Moonraker I/O) lives in the webview;
// the Rust side just hosts the window. Keep it minimal until a native need appears.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_backlight, set_backlight_power])
        .setup(|app| {
            fit_window_to_display(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the FilaMind screen application");
}

/// Set every panel backlight to `percent` (0..=100) of its own max. The kiosk install ships a
/// udev rule that makes the brightness file writable, so this runs unprivileged; if it isn't
/// writable yet (before the post-install reboot) the write just fails and is ignored - the UI
/// preference still persists.
#[tauri::command]
fn set_backlight(percent: u8) {
    let pct = percent.min(100) as u32;
    let Ok(entries) = std::fs::read_dir("/sys/class/backlight") else {
        return;
    };
    for entry in entries.flatten() {
        let dir = entry.path();
        let max = std::fs::read_to_string(dir.join("max_brightness"))
            .ok()
            .and_then(|s| s.trim().parse::<u32>().ok())
            .unwrap_or(255);
        // Never fully off - a floor keeps the panel visible (and recoverable) at the low end.
        let floor = (max / 20).max(1);
        let value = ((max * pct) / 100).max(floor);
        let _ = std::fs::write(dir.join("brightness"), value.to_string());
    }
}

/// Panel power for screen sleep. Unlike `set_backlight`, this is allowed to reach a fully dark
/// panel: `on = false` drives brightness to 0 - BYPASSING the visibility floor - and writes
/// `bl_power` powerdown, so an idle screen truly goes off (measured: `actual_brightness` -> 0).
/// `on = true` un-blanks; the caller restores the user's brightness with `set_backlight`
/// afterwards. Same udev-writable-file caveat as `set_backlight`; failures are ignored.
#[tauri::command]
fn set_backlight_power(on: bool) {
    let Ok(entries) = std::fs::read_dir("/sys/class/backlight") else {
        return;
    };
    for entry in entries.flatten() {
        let dir = entry.path();
        if on {
            let _ = std::fs::write(dir.join("bl_power"), "0"); // FB_BLANK_UNBLANK
        } else {
            let _ = std::fs::write(dir.join("bl_power"), "4"); // FB_BLANK_POWERDOWN
            let _ = std::fs::write(dir.join("brightness"), "0");
        }
    }
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
