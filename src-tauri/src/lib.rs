pub mod app_state;
pub mod commands;
pub mod events;
pub mod models;
pub mod platforms;
pub mod settings;

use app_state::AppState;
use settings::SettingsStore;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(commands::command_handlers())
        .setup(|app| {
            let settings_store = SettingsStore::from_app_handle(app.handle())?;
            app.manage(AppState::new(settings_store));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
