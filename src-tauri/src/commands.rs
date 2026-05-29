use std::collections::HashMap;

use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::events;
use crate::models::{
    AnimateEmotes, AppSettings, AppSettingsPatch, ChannelConfig, ConnectionState,
    CreatePluginPayload, DeletedMessageStyle, DisconnectChannelPayload, EmoteProviderSettingsPatch,
    FetchEmotesPayload, GetViewerListPayload, MessageSpacing, ModActionPayload,
    ModButtonSettingsPatch, NormalizedMessage, SavePluginPayload, SendMessagePayload,
    SevenTvCosmeticsPayload, ShellOpenPayload, Theme, TimestampFormat, TogglePluginPayload,
    UserCardPayload, UsernameDisplay, WindowBoundsPatch,
};
use crate::platforms::twitch;
use crate::settings::SettingsError;

pub fn settings_get_for_state(state: &AppState) -> Result<AppSettings, SettingsError> {
    state.load_settings()
}

pub fn settings_set_for_state(
    state: &AppState,
    patch: AppSettingsPatch,
) -> Result<AppSettings, SettingsError> {
    state.update_settings(patch)
}

#[tauri::command]
pub fn settings_get(state: State<'_, AppState>) -> Result<AppSettings, String> {
    settings_get_for_state(&state).map_err(|error| error.to_string())
}

#[allow(clippy::too_many_arguments)]
#[tauri::command(rename_all = "camelCase")]
pub fn settings_set(
    state: State<'_, AppState>,
    channels: Option<Vec<ChannelConfig>>,
    twitch_client_id: Option<String>,
    twitch_client_secret: Option<String>,
    google_client_id: Option<String>,
    google_client_secret: Option<String>,
    youtube_api_key: Option<String>,
    theme: Option<Theme>,
    font_size: Option<u8>,
    show_timestamps: Option<bool>,
    timestamp_format: Option<TimestampFormat>,
    show_badges: Option<bool>,
    show_platform_badge: Option<bool>,
    emote_scale: Option<f32>,
    message_spacing: Option<MessageSpacing>,
    alternating_rows: Option<bool>,
    username_display: Option<UsernameDisplay>,
    enabled_providers: Option<EmoteProviderSettingsPatch>,
    animate_emotes: Option<AnimateEmotes>,
    show_7tv_badges: Option<bool>,
    show_7tv_paints: Option<bool>,
    show_deleted_messages: Option<DeletedMessageStyle>,
    show_reply_context: Option<bool>,
    pause_scroll_on_hover: Option<bool>,
    smooth_scroll: Option<bool>,
    show_connection_alerts: Option<bool>,
    hide_commands: Option<bool>,
    flash_on_mention: Option<bool>,
    keyword_alerts: Option<Vec<String>>,
    mention_keywords: Option<Vec<String>>,
    max_messages_per_channel: Option<u32>,
    mod_buttons: Option<ModButtonSettingsPatch>,
    plugin_mention_users: Option<bool>,
    clickable_usernames: Option<bool>,
    show_viewer_count: Option<bool>,
    load_recent_messages: Option<bool>,
    show_viewer_list: Option<bool>,
    viewer_list_width: Option<u32>,
    window_bounds: Option<WindowBoundsPatch>,
) -> Result<AppSettings, String> {
    settings_set_for_state(
        &state,
        AppSettingsPatch {
            channels,
            twitch_client_id,
            twitch_client_secret,
            google_client_id,
            google_client_secret,
            youtube_api_key,
            theme,
            font_size,
            show_timestamps,
            timestamp_format,
            show_badges,
            show_platform_badge,
            emote_scale,
            message_spacing,
            alternating_rows,
            username_display,
            enabled_providers,
            animate_emotes,
            show_7tv_badges,
            show_7tv_paints,
            show_deleted_messages,
            show_reply_context,
            pause_scroll_on_hover,
            smooth_scroll,
            show_connection_alerts,
            hide_commands,
            flash_on_mention,
            keyword_alerts,
            mention_keywords,
            max_messages_per_channel,
            mod_buttons,
            plugin_mention_users,
            clickable_usernames,
            show_viewer_count,
            load_recent_messages,
            show_viewer_list,
            viewer_list_width,
            window_bounds,
        },
    )
    .map_err(|error| error.to_string())
}

#[tauri::command(rename_all = "camelCase")]
pub fn channel_connect<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    channel_id: String,
    platform: crate::models::Platform,
    slug: String,
) -> Result<(), String> {
    match platform {
        crate::models::Platform::Twitch => {
            twitch::connect_anonymous(app, state.inner().clone(), channel_id, slug)
        }
        _ => Err(format!(
            "{platform:?} connections are not implemented in the Rust runtime yet"
        )),
    }
}

#[tauri::command]
pub fn channel_disconnect<R: tauri::Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    payload: DisconnectChannelPayload,
) -> Result<(), String> {
    state.disconnect_channel(&payload.channel_id);
    events::emit_connection_state(
        &app,
        crate::models::ConnectionState {
            channel_id: payload.channel_id,
            status: crate::models::ConnectionStatus::Disconnected,
            error: None,
            connected_at: None,
            reconnect_attempt: None,
        },
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn chat_send(payload: SendMessagePayload) -> Result<(), String> {
    let _ = payload;
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn chat_get_recent_messages(channel_id: String) -> Result<Vec<NormalizedMessage>, String> {
    let _ = channel_id;
    Ok(Vec::new())
}

#[tauri::command]
pub fn auth_twitch_start() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn auth_youtube_start() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn auth_logout(payload: crate::models::AuthLogoutPayload) -> Result<(), String> {
    let _ = payload;
    Ok(())
}

#[tauri::command]
pub fn auth_get_state() -> Result<Value, String> {
    Ok(json!({
        "twitch": { "status": "unauthenticated" },
        "youtube": { "status": "unauthenticated" }
    }))
}

#[tauri::command]
pub fn connections_get_all(state: State<'_, AppState>) -> Result<Vec<ConnectionState>, String> {
    Ok(state.all_connection_states())
}

#[tauri::command]
pub fn emotes_fetch(payload: FetchEmotesPayload) -> Result<(), String> {
    let _ = payload;
    Ok(())
}

#[tauri::command]
pub fn mod_action(payload: ModActionPayload) -> Result<(), String> {
    let _ = payload;
    Ok(())
}

#[tauri::command]
pub fn mod_get_self_statuses() -> Result<HashMap<String, bool>, String> {
    Ok(HashMap::new())
}

#[tauri::command]
pub fn media_get_current() -> Result<String, String> {
    Ok(String::new())
}

#[tauri::command]
pub fn plugins_apply(payload: Value) -> Result<Option<Value>, String> {
    let _ = payload;
    Ok(None)
}

#[tauri::command]
pub fn plugins_get_all() -> Result<Vec<Value>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn plugins_save(payload: SavePluginPayload) -> Result<Vec<Value>, String> {
    let _ = payload;
    Ok(Vec::new())
}

#[tauri::command]
pub fn plugins_create(payload: CreatePluginPayload) -> Result<Vec<Value>, String> {
    let _ = payload;
    Ok(Vec::new())
}

#[tauri::command]
pub fn plugins_open_folder() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn plugins_reload() -> Result<Vec<Value>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn plugins_toggle(payload: TogglePluginPayload) -> Result<Vec<Value>, String> {
    let _ = payload;
    Ok(Vec::new())
}

#[tauri::command]
pub fn streams_viewer_counts() -> Result<HashMap<String, u64>, String> {
    Ok(HashMap::new())
}

#[tauri::command]
pub fn viewers_get_list(payload: GetViewerListPayload) -> Result<Option<Value>, String> {
    let _ = payload;
    Ok(None)
}

#[tauri::command]
pub fn twitch_get_user_card(payload: UserCardPayload) -> Result<Option<Value>, String> {
    let _ = payload;
    Ok(None)
}

#[tauri::command]
pub fn usercard_open_window(payload: UserCardPayload) -> Result<(), String> {
    let _ = payload;
    Ok(())
}

#[tauri::command]
pub fn seven_tv_fetch_cosmetics(payload: SevenTvCosmeticsPayload) -> Result<Value, String> {
    let _ = payload;
    Ok(json!({
        "badge": null,
        "paint": null
    }))
}

#[tauri::command]
pub fn shell_open_external(payload: ShellOpenPayload) -> Result<(), String> {
    let _ = payload;
    Ok(())
}

#[tauri::command]
pub fn updater_check() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn updater_install() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn window_minimize() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn window_maximize() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn window_close() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn window_is_maximized() -> Result<bool, String> {
    Ok(false)
}

pub fn command_handlers<R: tauri::Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool {
    tauri::generate_handler![
        settings_get,
        settings_set,
        channel_connect,
        channel_disconnect,
        chat_send,
        chat_get_recent_messages,
        auth_twitch_start,
        auth_youtube_start,
        auth_logout,
        auth_get_state,
        connections_get_all,
        emotes_fetch,
        mod_action,
        mod_get_self_statuses,
        media_get_current,
        plugins_apply,
        plugins_get_all,
        plugins_save,
        plugins_create,
        plugins_open_folder,
        plugins_reload,
        plugins_toggle,
        streams_viewer_counts,
        viewers_get_list,
        twitch_get_user_card,
        usercard_open_window,
        seven_tv_fetch_cosmetics,
        shell_open_external,
        updater_check,
        updater_install,
        window_minimize,
        window_maximize,
        window_close,
        window_is_maximized
    ]
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::app_state::AppState;
    use crate::commands::{settings_get_for_state, settings_set_for_state};
    use crate::models::{AppSettings, AppSettingsPatch, Theme};

    fn temp_config_dir(test_name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("antisnipe-commands-{test_name}-{unique}"))
    }

    #[test]
    fn settings_get_returns_default_settings_from_state() {
        let state = AppState::from_config_dir(temp_config_dir("get-defaults"));

        let settings = settings_get_for_state(&state).expect("settings should load");

        assert_eq!(settings, AppSettings::default());
    }

    #[test]
    fn settings_set_persists_patch_and_returns_merged_settings() {
        let state = AppState::from_config_dir(temp_config_dir("set-merged"));

        let updated = settings_set_for_state(
            &state,
            AppSettingsPatch {
                theme: Some(Theme::Light),
                font_size: Some(18),
                ..Default::default()
            },
        )
        .expect("settings patch should save");

        assert_eq!(updated.theme, Theme::Light);
        assert_eq!(updated.font_size, 18);

        let reloaded = settings_get_for_state(&state).expect("settings should reload");
        assert_eq!(reloaded.theme, Theme::Light);
        assert_eq!(reloaded.font_size, 18);
    }
}
