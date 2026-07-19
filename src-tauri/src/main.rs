// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // 44-04 (SYNC-01 D-01 / RESEARCH.md Pitfall 3): persists the fs+asset
        // scope grant that the directory dialog auto-extends when the user
        // picks their sync folder, so "pick once, then automatic" survives an
        // app restart. Must be registered after tauri_plugin_fs::init().
        .plugin(tauri_plugin_persisted_scope::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
