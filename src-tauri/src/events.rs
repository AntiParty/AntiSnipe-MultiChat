use tauri::Emitter;

use crate::models::{AppSettings, ConnectionState, DeleteMessageEvent, NormalizedMessage};

pub const MESSAGE_BATCH: &str = "chat:messageBatch";
pub const DELETE_MESSAGE: &str = "chat:deleteMessage";
pub const CONNECTION_STATE: &str = "connection:state";
pub const AUTH_STATE_CHANGED: &str = "auth:stateChanged";
pub const EMOTE_BATCH_READY: &str = "emotes:batchReady";
pub const SETTINGS_UPDATED: &str = "settings:updated";
pub const UPDATE_AVAILABLE: &str = "updater:available";
pub const UPDATE_DOWNLOADED: &str = "updater:downloaded";
pub const UPDATE_NOT_AVAILABLE: &str = "updater:notAvailable";
pub const UPDATE_ERROR: &str = "updater:error";
pub const PLATFORM_ERROR: &str = "error:platform";
pub const SELF_MOD_STATUS: &str = "mod:selfStatus";
pub const PLUGINS_CHANGED: &str = "plugins:changed";
pub const RECENT_MESSAGES: &str = "chat:recentMessages";
pub const VIEWER_LIST_UPDATE: &str = "viewers:update";

pub fn emit_message_batch<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    messages: Vec<NormalizedMessage>,
) -> tauri::Result<()> {
    app.emit(MESSAGE_BATCH, messages)
}

pub fn emit_delete_message<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    event: DeleteMessageEvent,
) -> tauri::Result<()> {
    app.emit(DELETE_MESSAGE, event)
}

pub fn emit_connection_state<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    state: ConnectionState,
) -> tauri::Result<()> {
    app.emit(CONNECTION_STATE, state)
}

pub fn emit_settings_updated<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    settings: AppSettings,
) -> tauri::Result<()> {
    app.emit(SETTINGS_UPDATED, settings)
}
