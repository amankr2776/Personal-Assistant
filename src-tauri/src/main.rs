#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn toggle_voice_overlay(window: tauri::Window) {
    // Emit event to frontend to toggle voice overlay
    let _ = window.emit("toggle-voice-overlay", ());
}

#[tauri::command]
fn get_network_status() -> String {
    // Simple connectivity check
    if reqwest::blocking::Client::new()
        .get("https://www.google.com")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .is_ok()
    {
        "online".to_string()
    } else {
        "offline".to_string()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            toggle_voice_overlay,
            get_network_status,
        ])
        .setup(|app| {
            // Listen for global shortcut events
            let handle = app.handle().clone();
            app.listen("toggle-voice-overlay", move |_| {
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.emit("toggle-voice-overlay", ());
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}
