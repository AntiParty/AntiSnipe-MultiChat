# AntiSnipe MultiChat

A production-ready cross-platform desktop chat aggregator for **YouTube Live**, **Twitch**, and **Kick** with inline emote rendering (7TV, BTTV, FFZ).

## Features

- Unified or per-channel chat view with virtualized rendering (handles 10,000+ msg/hr)
- Inline emote support: 7TV, BetterTTV, FrankerFaceZ, Twitch native, Kick native
- Platform indicators per message (🟣 Twitch / 🔴 YouTube / 🟢 Kick)
- OAuth for Twitch and YouTube (read sub-only chats, send messages)
- Persistent settings, automatic reconnect, keyword highlights
- Auto-updater via GitHub Releases
- Installers for Windows (NSIS), macOS (DMG), Linux (AppImage/deb)

---

## Prerequisites

- **Node.js** 20+ and **npm** 9+
- Git

---

## Development Setup

```bash
git clone https://github.com/PLACEHOLDER/AntiSnipe-MultiChat
cd AntiSnipe-MultiChat
npm install
npm run dev
```

The app opens automatically. Hot-module reload is active for the renderer.

---

## First-time Configuration

### Twitch (OAuth for send + sub-only chat)

1. Go to [dev.twitch.tv/console](https://dev.twitch.tv/console) and create a new application.
2. Set the **OAuth Redirect URL** to: `antisinemultichat://auth/twitch`
3. Copy the **Client ID** and paste it into **Settings → Auth → Twitch Client ID**.
4. Click **Connect with Twitch** and authorize in your browser.

### YouTube (OAuth for read + send)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. Enable the **YouTube Data API v3**.
3. Create an **OAuth 2.0 Client ID** (Desktop app type).
4. Set the authorized redirect URI to: `antisinemultichat://auth/youtube`
5. Copy the **Client ID** and paste it into **Settings → Auth → Google Client ID**.
6. Click **Connect with YouTube** and authorize.

> **API Quota Note:** YouTube Data API v3 costs 5 units per chat poll. The free daily quota is 10,000 units (~2,000 polls). At a 10-second interval this covers ~5.5 hours of polling per day. Request a quota increase in Google Cloud Console for continuous use.

### Kick

No authentication needed. Kick chat is read via a public WebSocket. Enter the channel slug in the sidebar (e.g. `xqc`).

---

## Adding Channels

In the sidebar:
1. Select the platform tab (T / Y / K)
2. Type the channel name/slug
3. Press `+` or Enter

Channels connect immediately and re-connect automatically on the next app start.

---

## Building for Production

```bash
# Build all targets on current platform:
npm run build

# Package for specific platforms:
npm run package:win    # Windows NSIS installer (requires Windows or Wine)
npm run package:mac    # macOS DMG (requires macOS + code signing for notarization)
npm run package:linux  # AppImage + deb
```

### Code Signing (optional, recommended for distribution)

**Windows:** Set `CSC_LINK` (path to .pfx) and `CSC_KEY_PASSWORD` env vars.

**macOS:** Set `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_ID_PASS`, and `APPLE_TEAM_ID` for notarization.

### Auto-Updater

1. Replace `"owner": "PLACEHOLDER"` in `package.json` → `build.publish` with your GitHub username.
2. Create a GitHub repository named `AntiSnipe-MultiChat`.
3. Set `GH_TOKEN` environment variable (GitHub Personal Access Token with `repo` scope).
4. Tag releases as `v1.0.0` etc. — electron-updater checks GitHub Releases automatically.

---

## Architecture

```
src/
├── main/           Electron main process (Node.js)
│   ├── services/   Twitch IRC, YouTube polling, Kick Pusher
│   ├── emotes/     7TV, BTTV, FFZ cache + resolver
│   ├── auth/       OAuth PKCE flows (Twitch, YouTube)
│   ├── ipc/        IPC handlers + rate-limited broadcaster
│   └── store/      electron-store settings persistence
├── renderer/       React frontend
│   ├── store/      Zustand slices + IPC sync middleware
│   ├── components/ Chat, settings, layout, UI primitives
│   └── hooks/      useChat, useSettings, useIpc
└── shared/         Types shared by main + renderer
    ├── types/      message, channel, emote, settings, ipc
    └── constants.ts
```

See the [plan file](.claude/plans/) for the full data flow diagram.

---

## License

MIT
