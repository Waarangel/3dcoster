// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Get the monitor the window is on
            if let Some(monitor) = window.current_monitor().unwrap() {
                let screen_size = monitor.size();
                let screen_height = screen_size.height as f64;
                let screen_width = screen_size.width as f64;

                // Set window to 90% of screen height, maintain aspect ratio
                let target_height = (screen_height * 0.9) as u32;
                let target_width = (screen_width * 0.6).min(1400.0) as u32; // 60% width, max 1400

                let _ = window.set_size(tauri::PhysicalSize::new(target_width, target_height));

                // Center the window
                let x = ((screen_width - target_width as f64) / 2.0) as i32;
                let y = ((screen_height - target_height as f64) / 2.0) as i32;
                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
