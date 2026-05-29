use std::fmt;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::models::{
    AppSettings, AppSettingsPatch, EmoteProviderSettingsPatch, ModButtonSettingsPatch,
    WindowBoundsPatch,
};
use tauri::Manager;

const SETTINGS_FILE_NAME: &str = "settings.json";

#[derive(Debug)]
pub enum SettingsError {
    Io(io::Error),
    Json(serde_json::Error),
    TauriPath(String),
}

impl fmt::Display for SettingsError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "settings I/O error: {error}"),
            Self::Json(error) => write!(formatter, "settings JSON error: {error}"),
            Self::TauriPath(error) => write!(formatter, "settings config directory error: {error}"),
        }
    }
}

impl std::error::Error for SettingsError {}

impl From<io::Error> for SettingsError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<serde_json::Error> for SettingsError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error)
    }
}

#[derive(Debug, Clone)]
pub struct SettingsStore {
    config_dir: PathBuf,
}

impl SettingsStore {
    pub fn new(config_dir: impl Into<PathBuf>) -> Self {
        Self {
            config_dir: config_dir.into(),
        }
    }

    pub fn from_app_handle<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
    ) -> Result<Self, SettingsError> {
        let config_dir = app
            .path()
            .app_config_dir()
            .map_err(|error| SettingsError::TauriPath(error.to_string()))?;

        Ok(Self::new(config_dir))
    }

    pub fn config_dir(&self) -> &Path {
        &self.config_dir
    }

    pub fn settings_path(&self) -> PathBuf {
        self.config_dir.join(SETTINGS_FILE_NAME)
    }

    pub fn load(&self) -> Result<AppSettings, SettingsError> {
        let path = self.settings_path();

        if !path.exists() {
            return Ok(AppSettings::default());
        }

        let raw = fs::read_to_string(path)?;
        if raw.trim().is_empty() {
            return Ok(AppSettings::default());
        }

        let patch = serde_json::from_str::<AppSettingsPatch>(&raw)?;
        Ok(merge_settings(AppSettings::default(), patch))
    }

    pub fn save(&self, settings: &AppSettings) -> Result<(), SettingsError> {
        fs::create_dir_all(&self.config_dir)?;
        let raw = serde_json::to_string_pretty(settings)?;
        fs::write(self.settings_path(), raw)?;
        Ok(())
    }

    pub fn save_patch(&self, patch: AppSettingsPatch) -> Result<AppSettings, SettingsError> {
        let merged = merge_settings(self.load()?, patch);
        self.save(&merged)?;
        Ok(merged)
    }
}

pub fn merge_settings(mut settings: AppSettings, patch: AppSettingsPatch) -> AppSettings {
    if let Some(value) = patch.channels {
        settings.channels = value;
    }
    if let Some(value) = patch.twitch_client_id {
        settings.twitch_client_id = value;
    }
    if let Some(value) = patch.twitch_client_secret {
        settings.twitch_client_secret = value;
    }
    if let Some(value) = patch.google_client_id {
        settings.google_client_id = value;
    }
    if let Some(value) = patch.google_client_secret {
        settings.google_client_secret = value;
    }
    if let Some(value) = patch.youtube_api_key {
        settings.youtube_api_key = value;
    }
    if let Some(value) = patch.theme {
        settings.theme = value;
    }
    if let Some(value) = patch.font_size {
        settings.font_size = value;
    }
    if let Some(value) = patch.show_timestamps {
        settings.show_timestamps = value;
    }
    if let Some(value) = patch.timestamp_format {
        settings.timestamp_format = value;
    }
    if let Some(value) = patch.show_badges {
        settings.show_badges = value;
    }
    if let Some(value) = patch.show_platform_badge {
        settings.show_platform_badge = value;
    }
    if let Some(value) = patch.emote_scale {
        settings.emote_scale = value;
    }
    if let Some(value) = patch.message_spacing {
        settings.message_spacing = value;
    }
    if let Some(value) = patch.alternating_rows {
        settings.alternating_rows = value;
    }
    if let Some(value) = patch.username_display {
        settings.username_display = value;
    }
    if let Some(value) = patch.enabled_providers {
        merge_emote_providers(&mut settings, value);
    }
    if let Some(value) = patch.animate_emotes {
        settings.animate_emotes = value;
    }
    if let Some(value) = patch.show_7tv_badges {
        settings.show_7tv_badges = value;
    }
    if let Some(value) = patch.show_7tv_paints {
        settings.show_7tv_paints = value;
    }
    if let Some(value) = patch.show_deleted_messages {
        settings.show_deleted_messages = value;
    }
    if let Some(value) = patch.show_reply_context {
        settings.show_reply_context = value;
    }
    if let Some(value) = patch.pause_scroll_on_hover {
        settings.pause_scroll_on_hover = value;
    }
    if let Some(value) = patch.smooth_scroll {
        settings.smooth_scroll = value;
    }
    if let Some(value) = patch.show_connection_alerts {
        settings.show_connection_alerts = value;
    }
    if let Some(value) = patch.hide_commands {
        settings.hide_commands = value;
    }
    if let Some(value) = patch.flash_on_mention {
        settings.flash_on_mention = value;
    }
    if let Some(value) = patch.keyword_alerts {
        settings.keyword_alerts = value;
    }
    if let Some(value) = patch.mention_keywords {
        settings.mention_keywords = value;
    }
    if let Some(value) = patch.max_messages_per_channel {
        settings.max_messages_per_channel = value;
    }
    if let Some(value) = patch.mod_buttons {
        merge_mod_buttons(&mut settings, value);
    }
    if let Some(value) = patch.plugin_mention_users {
        settings.plugin_mention_users = value;
    }
    if let Some(value) = patch.clickable_usernames {
        settings.clickable_usernames = value;
    }
    if let Some(value) = patch.show_viewer_count {
        settings.show_viewer_count = value;
    }
    if let Some(value) = patch.load_recent_messages {
        settings.load_recent_messages = value;
    }
    if let Some(value) = patch.show_viewer_list {
        settings.show_viewer_list = value;
    }
    if let Some(value) = patch.viewer_list_width {
        settings.viewer_list_width = value;
    }
    if let Some(value) = patch.window_bounds {
        merge_window_bounds(&mut settings, value);
    }

    settings
}

fn merge_emote_providers(settings: &mut AppSettings, patch: EmoteProviderSettingsPatch) {
    if let Some(value) = patch.seven_tv {
        settings.enabled_providers.seven_tv = value;
    }
    if let Some(value) = patch.bttv {
        settings.enabled_providers.bttv = value;
    }
    if let Some(value) = patch.ffz {
        settings.enabled_providers.ffz = value;
    }
}

fn merge_mod_buttons(settings: &mut AppSettings, patch: ModButtonSettingsPatch) {
    if let Some(value) = patch.show_delete {
        settings.mod_buttons.show_delete = value;
    }
    if let Some(value) = patch.show_timeout {
        settings.mod_buttons.show_timeout = value;
    }
    if let Some(value) = patch.show_ban {
        settings.mod_buttons.show_ban = value;
    }
    if let Some(value) = patch.timeout_presets {
        settings.mod_buttons.timeout_presets = value;
    }
}

fn merge_window_bounds(settings: &mut AppSettings, patch: WindowBoundsPatch) {
    if let Some(value) = patch.x {
        settings.window_bounds.x = value;
    }
    if let Some(value) = patch.y {
        settings.window_bounds.y = value;
    }
    if let Some(value) = patch.width {
        settings.window_bounds.width = value;
    }
    if let Some(value) = patch.height {
        settings.window_bounds.height = value;
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::models::{
        AppSettings, AppSettingsPatch, ChannelConfig, EmoteProviderSettingsPatch, Platform,
    };
    use crate::settings::SettingsStore;

    fn temp_config_dir(test_name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("antisnipe-{test_name}-{unique}"))
    }

    #[test]
    fn settings_returns_defaults_when_file_is_missing() {
        let dir = temp_config_dir("defaults");
        let store = SettingsStore::new(dir.clone());

        let settings = store
            .load()
            .expect("missing settings file should load defaults");

        assert_eq!(settings, AppSettings::default());
        assert!(!dir.join("settings.json").exists());
    }

    #[test]
    fn settings_merges_partial_updates_and_preserves_existing_values() {
        let dir = temp_config_dir("merge");
        let store = SettingsStore::new(dir);
        let initial = store
            .save_patch(AppSettingsPatch {
                font_size: Some(18),
                keyword_alerts: Some(vec!["raid".to_string()]),
                enabled_providers: Some(EmoteProviderSettingsPatch {
                    bttv: Some(false),
                    ..Default::default()
                }),
                ..Default::default()
            })
            .expect("initial patch should save");

        let updated = store
            .save_patch(AppSettingsPatch {
                theme: Some(crate::models::Theme::Light),
                enabled_providers: Some(EmoteProviderSettingsPatch {
                    ffz: Some(false),
                    ..Default::default()
                }),
                ..Default::default()
            })
            .expect("second patch should save");

        assert_eq!(initial.font_size, 18);
        assert_eq!(updated.font_size, 18);
        assert_eq!(updated.keyword_alerts, vec!["raid".to_string()]);
        assert_eq!(updated.theme, crate::models::Theme::Light);
        assert!(updated.enabled_providers.seven_tv);
        assert!(!updated.enabled_providers.bttv);
        assert!(!updated.enabled_providers.ffz);
    }

    #[test]
    fn settings_persists_channels_to_disk() {
        let dir = temp_config_dir("channels");
        let store = SettingsStore::new(dir.clone());
        let channel = ChannelConfig {
            id: "twitch:chatterino".to_string(),
            platform: Platform::Twitch,
            slug: "chatterino".to_string(),
            display_name: "Chatterino".to_string(),
            enabled: true,
        };

        store
            .save_patch(AppSettingsPatch {
                channels: Some(vec![channel.clone()]),
                ..Default::default()
            })
            .expect("channel patch should save");

        let raw =
            fs::read_to_string(dir.join("settings.json")).expect("settings file should exist");
        assert!(raw.contains("\"displayName\": \"Chatterino\""));

        let reloaded = SettingsStore::new(dir)
            .load()
            .expect("persisted settings should load");
        assert_eq!(reloaded.channels, vec![channel]);
    }
}
