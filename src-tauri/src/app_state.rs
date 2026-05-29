use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::models::{AppSettings, AppSettingsPatch, ConnectionState, ConnectionStatus};
use crate::settings::{SettingsError, SettingsStore};

#[derive(Debug, Clone)]
pub struct AppState {
    settings_store: Arc<Mutex<SettingsStore>>,
    connection_tasks: Arc<Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>>,
    connection_states: Arc<Mutex<HashMap<String, ConnectionState>>>,
}

impl AppState {
    pub fn new(settings_store: SettingsStore) -> Self {
        Self {
            settings_store: Arc::new(Mutex::new(settings_store)),
            connection_tasks: Arc::new(Mutex::new(HashMap::new())),
            connection_states: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn from_config_dir(config_dir: impl Into<std::path::PathBuf>) -> Self {
        Self::new(SettingsStore::new(config_dir))
    }

    pub fn settings_store(&self) -> Arc<Mutex<SettingsStore>> {
        Arc::clone(&self.settings_store)
    }

    pub fn load_settings(&self) -> Result<AppSettings, SettingsError> {
        let store = self
            .settings_store
            .lock()
            .expect("settings store mutex should not be poisoned");
        store.load()
    }

    pub fn update_settings(&self, patch: AppSettingsPatch) -> Result<AppSettings, SettingsError> {
        let store = self
            .settings_store
            .lock()
            .expect("settings store mutex should not be poisoned");
        store.save_patch(patch)
    }

    pub fn replace_connection_task(
        &self,
        channel_id: String,
        task: tauri::async_runtime::JoinHandle<()>,
    ) {
        let mut tasks = self
            .connection_tasks
            .lock()
            .expect("connection task mutex should not be poisoned");
        if let Some(existing) = tasks.insert(channel_id, task) {
            existing.abort();
        }
    }

    pub fn disconnect_channel(&self, channel_id: &str) {
        let mut tasks = self
            .connection_tasks
            .lock()
            .expect("connection task mutex should not be poisoned");
        if let Some(task) = tasks.remove(channel_id) {
            task.abort();
        }
        drop(tasks);
        self.set_connection_state(ConnectionState {
            channel_id: channel_id.to_string(),
            status: ConnectionStatus::Disconnected,
            error: None,
            connected_at: None,
            reconnect_attempt: None,
        });
    }

    pub fn set_connection_state(&self, state: ConnectionState) {
        self.connection_states
            .lock()
            .expect("connection state mutex should not be poisoned")
            .insert(state.channel_id.clone(), state);
    }

    pub fn all_connection_states(&self) -> Vec<ConnectionState> {
        self.connection_states
            .lock()
            .expect("connection state mutex should not be poisoned")
            .values()
            .cloned()
            .collect()
    }
}
