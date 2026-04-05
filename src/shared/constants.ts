// Chat buffer limits
export const MAX_MESSAGES_PER_CHANNEL = 2000
export const TRIM_AMOUNT = 500            // remove this many when limit exceeded

// Broadcaster rate limiting
export const BROADCAST_INTERVAL_MS = 33  // ~30fps
export const BROADCAST_BATCH_SIZE = 50   // max messages per batch

// Reconnect backoff (ms)
export const RECONNECT_BASE_MS = 1000
export const RECONNECT_MAX_MS = 30_000
export const RECONNECT_JITTER = 0.3

// Emote cache
export const EMOTE_CACHE_TTL_MS = 60 * 60 * 1000   // 1 hour
export const EMOTE_CACHE_MAX_SIZE = 5000
export const EMOTE_CACHE_FLUSH_INTERVAL_MS = 5 * 60 * 1000 // 5 min
export const EMOTE_CACHE_VERSION = 1

// YouTube polling
export const YOUTUBE_DEFAULT_POLL_MS = 10_000
export const YOUTUBE_DEDUP_WINDOW = 500   // remember last N message IDs

// Twitch IRC
export const TWITCH_IRC_URL = 'wss://irc-ws.chat.twitch.tv:443'
export const TWITCH_PING_INTERVAL_MS = 4 * 60 * 1000  // send PING every 4 min
export const TWITCH_PONG_TIMEOUT_MS = 5_000

// Kick
export const KICK_PUSHER_APP_KEY = '32cbd69e4b950bf97679'
export const KICK_PUSHER_CLUSTER = 'us2'
export const KICK_API_BASE = 'https://kick.com/api/v2'
export const KICK_FILES_BASE = 'https://files.kick.com'

// Auto-updater
export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000  // 4 hours

// Twitch API
export const TWITCH_IRC_CAPS = 'twitch.tv/tags twitch.tv/commands twitch.tv/membership'
export const TWITCH_EMOTE_BASE = 'https://static-cdn.jtvnw.net/emoticons/v2'
export const TWITCH_HELIX_BASE = 'https://api.twitch.tv/helix'
export const TWITCH_AUTH_BASE = 'https://id.twitch.tv/oauth2'

// YouTube API
export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
export const YOUTUBE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
export const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Google OAuth scopes
export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl'
].join(' ')

// Custom protocol
export const CUSTOM_PROTOCOL = 'antisnipemultichat'
