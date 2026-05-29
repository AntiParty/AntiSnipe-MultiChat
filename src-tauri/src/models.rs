use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Twitch,
    Youtube,
    Kick,
    Tiktok,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelConfig {
    pub id: String,
    pub platform: Platform,
    pub slug: String,
    pub display_name: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error,
    Ended,
    Offline,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionState {
    pub channel_id: String,
    pub status: ConnectionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connected_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reconnect_attempt: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MessageSpacing {
    Compact,
    Normal,
    Comfortable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimestampFormat {
    #[serde(rename = "12h")]
    TwelveHour,
    #[serde(rename = "24h")]
    TwentyFourHour,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UsernameDisplay {
    DisplayName,
    Login,
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeletedMessageStyle {
    CrossOut,
    Hide,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnimateEmotes {
    Always,
    Focused,
    Never,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmoteProviderSettings {
    #[serde(rename = "sevenTv")]
    pub seven_tv: bool,
    pub bttv: bool,
    pub ffz: bool,
}

impl Default for EmoteProviderSettings {
    fn default() -> Self {
        Self {
            seven_tv: true,
            bttv: true,
            ffz: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBounds {
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub width: u32,
    pub height: u32,
}

impl Default for WindowBounds {
    fn default() -> Self {
        Self {
            x: None,
            y: None,
            width: 420,
            height: 900,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModButtonSettings {
    pub show_delete: bool,
    pub show_timeout: bool,
    pub show_ban: bool,
    pub timeout_presets: Vec<u32>,
}

impl Default for ModButtonSettings {
    fn default() -> Self {
        Self {
            show_delete: true,
            show_timeout: true,
            show_ban: true,
            timeout_presets: vec![60, 600, 3600, 86400],
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub channels: Vec<ChannelConfig>,
    pub twitch_client_id: String,
    pub twitch_client_secret: String,
    pub google_client_id: String,
    pub google_client_secret: String,
    pub youtube_api_key: String,
    pub theme: Theme,
    pub font_size: u8,
    pub show_timestamps: bool,
    pub timestamp_format: TimestampFormat,
    pub show_badges: bool,
    pub show_platform_badge: bool,
    pub emote_scale: f32,
    pub message_spacing: MessageSpacing,
    pub alternating_rows: bool,
    pub username_display: UsernameDisplay,
    pub enabled_providers: EmoteProviderSettings,
    pub animate_emotes: AnimateEmotes,
    #[serde(rename = "show7tvBadges")]
    pub show_7tv_badges: bool,
    #[serde(rename = "show7tvPaints")]
    pub show_7tv_paints: bool,
    pub show_deleted_messages: DeletedMessageStyle,
    pub show_reply_context: bool,
    pub pause_scroll_on_hover: bool,
    pub smooth_scroll: bool,
    pub show_connection_alerts: bool,
    pub hide_commands: bool,
    pub flash_on_mention: bool,
    pub keyword_alerts: Vec<String>,
    pub mention_keywords: Vec<String>,
    pub max_messages_per_channel: u32,
    pub mod_buttons: ModButtonSettings,
    pub plugin_mention_users: bool,
    pub clickable_usernames: bool,
    pub show_viewer_count: bool,
    pub load_recent_messages: bool,
    pub show_viewer_list: bool,
    pub viewer_list_width: u32,
    pub window_bounds: WindowBounds,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            channels: Vec::new(),
            twitch_client_id: String::new(),
            twitch_client_secret: String::new(),
            google_client_id: String::new(),
            google_client_secret: String::new(),
            youtube_api_key: String::new(),
            theme: Theme::Dark,
            font_size: 14,
            show_timestamps: true,
            timestamp_format: TimestampFormat::TwentyFourHour,
            show_badges: true,
            show_platform_badge: true,
            emote_scale: 1.5,
            message_spacing: MessageSpacing::Normal,
            alternating_rows: false,
            username_display: UsernameDisplay::DisplayName,
            enabled_providers: EmoteProviderSettings::default(),
            animate_emotes: AnimateEmotes::Always,
            show_7tv_badges: true,
            show_7tv_paints: true,
            show_deleted_messages: DeletedMessageStyle::CrossOut,
            show_reply_context: true,
            pause_scroll_on_hover: false,
            smooth_scroll: false,
            show_connection_alerts: true,
            hide_commands: false,
            flash_on_mention: true,
            keyword_alerts: Vec::new(),
            mention_keywords: Vec::new(),
            max_messages_per_channel: 5000,
            mod_buttons: ModButtonSettings::default(),
            plugin_mention_users: false,
            clickable_usernames: true,
            show_viewer_count: false,
            load_recent_messages: true,
            show_viewer_list: false,
            viewer_list_width: 180,
            window_bounds: WindowBounds::default(),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct EmoteProviderSettingsPatch {
    #[serde(rename = "sevenTv", skip_serializing_if = "Option::is_none")]
    pub seven_tv: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bttv: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ffz: Option<bool>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct WindowBoundsPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<Option<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<Option<i32>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ModButtonSettingsPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_delete: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_timeout: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_ban: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout_presets: Option<Vec<u32>>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettingsPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<Vec<ChannelConfig>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub twitch_client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub twitch_client_secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub google_client_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub google_client_secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub youtube_api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<Theme>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_timestamps: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp_format: Option<TimestampFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_badges: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_platform_badge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emote_scale: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_spacing: Option<MessageSpacing>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alternating_rows: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username_display: Option<UsernameDisplay>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enabled_providers: Option<EmoteProviderSettingsPatch>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub animate_emotes: Option<AnimateEmotes>,
    #[serde(rename = "show7tvBadges", skip_serializing_if = "Option::is_none")]
    pub show_7tv_badges: Option<bool>,
    #[serde(rename = "show7tvPaints", skip_serializing_if = "Option::is_none")]
    pub show_7tv_paints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_deleted_messages: Option<DeletedMessageStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_reply_context: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pause_scroll_on_hover: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub smooth_scroll: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_connection_alerts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hide_commands: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flash_on_mention: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keyword_alerts: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mention_keywords: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_messages_per_channel: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mod_buttons: Option<ModButtonSettingsPatch>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plugin_mention_users: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub clickable_usernames: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_viewer_count: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub load_recent_messages: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_viewer_list: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub viewer_list_width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_bounds: Option<WindowBoundsPatch>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthState {
    pub platform: Platform,
    pub is_authenticated: bool,
    pub user_id: Option<String>,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectChannelPayload {
    pub channel_id: String,
    pub platform: Platform,
    pub slug: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisconnectChannelPayload {
    pub channel_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessagePayload {
    pub channel_id: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthLogoutPayload {
    pub platform: Platform,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchEmotesPayload {
    pub channel_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub twitch_user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kick_user_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellOpenPayload {
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModActionPayload {
    pub channel_id: String,
    pub action: String,
    pub target_user_id: String,
    pub target_user_login: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePluginPayload {
    pub id: String,
    pub code: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePluginPayload {
    pub filename: String,
    pub code: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TogglePluginPayload {
    pub id: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetViewerListPayload {
    pub channel_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserCardPayload {
    pub user_id: String,
    pub channel_id: String,
    pub login: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SevenTvCosmeticsPayload {
    pub twitch_user_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageBatchEvent {
    pub channel_id: String,
    pub messages: Vec<NormalizedMessage>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedMessage {
    pub id: String,
    pub platform: Platform,
    pub channel_id: String,
    pub channel_display_name: String,
    pub author_id: String,
    pub author_name: String,
    pub author_display_name: String,
    pub author_color: Option<String>,
    pub parts: Vec<MessagePart>,
    pub badges: Vec<BadgeInfo>,
    pub message_type: MessageType,
    pub is_highlighted: bool,
    pub is_mention: bool,
    pub is_action: bool,
    pub is_deleted: bool,
    pub timestamp: u64,
    pub raw: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<ReplyContext>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_reward_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reward_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_historical: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    Chat,
    Action,
    Sub,
    Resub,
    Giftsub,
    Raid,
    Announcement,
    System,
    Redeem,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum MessagePart {
    #[serde(rename = "text")]
    Text { content: String },
    #[serde(rename = "emote")]
    Emote { emote: EmoteData },
    #[serde(rename = "mention")]
    Mention { content: String },
    #[serde(rename = "link")]
    Link { url: String, display: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmoteData {
    pub id: String,
    pub name: String,
    pub url: String,
    pub provider: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BadgeInfo {
    pub id: String,
    pub version: String,
    pub title: String,
    pub image_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyContext {
    pub msg_id: String,
    pub user_login: String,
    pub user_display_name: String,
    pub msg_body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteMessageEvent {
    pub channel_id: String,
    pub message_id: Option<String>,
    pub author_id: Option<String>,
}
