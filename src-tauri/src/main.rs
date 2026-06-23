// Prevents an extra console window on Windows in release (no-op on Linux, where this app runs).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    filamind_screen_lib::run()
}
