<p align="center">
  <img src="docs/assets/logo.png" alt="AntiSnipe MultiChat" width="80" />
</p>

<h1 align="center">AntiSnipe MultiChat</h1>

<p align="center">
  <strong>All your chats. One window.</strong><br />
  A free, open-source multi-platform chat aggregator built for streamers.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platforms" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/built%20with-Electron%20%2B%20React-61dafb" alt="Stack" />
  <img src="https://img.shields.io/badge/emotes-7TV%20%7C%20BTTV%20%7C%20FFZ-orange" alt="Emote Providers" />
</p>

---

## What is AntiSnipe MultiChat?

AntiSnipe MultiChat is a **desktop chat client** that pulls together your Twitch, YouTube, and Kick live chat into a single, highly customizable window — so you never have to tab between browser dashboards again.

Built for streamers who multistream, have large communities, or simply want a cleaner, faster chat experience than what browser-based dashboards offer.

**It's completely free and open source.**

> Already managing multiple chat windows? There's a better way to manage your **stream** itself too — see [AntiSnipe](#-take-control-of-your-stream-with-antisnipe) at the bottom.

---

## Features

### Multi-Platform Chat — One Window

| Platform | Chat | OAuth Login | Send Messages |
|----------|------|-------------|---------------|
| Twitch   | Yes  | Yes         | Yes           |
| YouTube  | Yes  | Yes         | Coming soon   |
| Kick     | Yes  | —           | Coming soon   |

Add unlimited channels across any platform. Switch between them with tabs, or view all chats merged into a single "All" feed.

### Third-Party Emotes

Full support for the emote providers your community uses:

- **7TV** — global and per-channel emotes, animated WebP
- **BetterTTV (BTTV)** — global and channel emotes, GIF support
- **FrankerFaceZ (FFZ)** — global and channel emotes

Emotes are fetched and cached on first connect. New messages show emotes instantly; messages already on screen are **retroactively updated** when the emote pack finishes loading.

### Chatterino-Style UI

Built to feel familiar if you're a Chatterino user:

- Compact, normal, or cozy message spacing
- Alternating row colors for dense chats
- 12h/24h timestamps
- Username display: display name, login, or both
- Deleted messages: strike-through or hidden
- Per-channel unread message badges on tabs
- Platform indicator toggle (colored dot per message)

### Reply Context

When a chatter replies to someone, the original message is shown as a quoted bar directly above the reply — the same way Twitch's native client renders it.

### Mentions and Alerts

- Highlight messages containing custom keywords
- Flash the taskbar on mention (configurable)
- Separate mention detection from general keyword alerts

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + =` / `Ctrl + +` | Zoom in (increase font size) |
| `Ctrl + -` | Zoom out (decrease font size) |
| `Ctrl + 0` | Reset zoom |
| `Ctrl + ,` | Open Settings |
| `Escape` | Close Settings / panels |

### Emote Animation Control

Control when animated emotes (GIFs / animated WebP) play:

- **Always** — always animate
- **Focused only** — pause animations when the window is in the background
- **Never** — always show static images

### Performance

- Virtualized message list — handles 10,000+ messages/hr without slowdown
- Configurable message limit per channel (500–10,000)
- Disk-cached emotes — subsequent connects load from disk in under a second
- Auto-reconnect on disconnect

---

## Installation

### Download a Release

Head to the [Releases](https://github.com/your-org/AntiSnipe-MultiChat/releases) page and download the installer for your platform:

| Platform | File |
|----------|------|
| Windows  | `AntiSnipe-MultiChat-Setup-x.x.x.exe` |
| macOS    | `AntiSnipe-MultiChat-x.x.x.dmg` |
| Linux    | `AntiSnipe-MultiChat-x.x.x.AppImage` |

### Build from Source

**Prerequisites:** Node.js 20+ · npm 9+ · Git

```bash
git clone https://github.com/your-org/AntiSnipe-MultiChat.git
cd AntiSnipe-MultiChat
npm install

# Development (hot reload)
npm run dev

# Production builds
npm run build:win    # Windows NSIS installer
npm run build:mac    # macOS DMG
npm run build:linux  # AppImage + .deb
```

---

## Setup Guide

### Adding a Channel — No Login Required

Read-only access needs no authentication:

1. Click the **+** button in the tab bar
2. Select your platform (Twitch / YouTube / Kick)
3. Type the channel name (e.g. `xqc`)
4. Click **Add Channel**

You'll be connected and reading chat within seconds.

### Twitch OAuth — Send Messages + Read Sub-Only Chat

1. Go to [dev.twitch.tv/console](https://dev.twitch.tv/console)
2. Click **Register Your Application**
3. Fill in:
   - **Name**: anything (e.g. `MyMultiChat`)
   - **OAuth Redirect URL**: `http://localhost:27182/callback`
   - **Category**: Chat Bot
4. Click **Create** and copy your **Client ID**
5. In AntiSnipe MultiChat, open **Settings → Accounts**
6. Paste your Client ID and click **Connect Twitch**
7. Authorize in the browser window that opens

Once connected, your username and badges appear on messages you send from the app.

### YouTube API Key

YouTube live chat requires a **YouTube Data API v3** key:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the **YouTube Data API v3**
3. Create credentials: **API Key**
4. In AntiSnipe MultiChat, open **Settings → Accounts**
5. Paste your API key and click **Connect YouTube**

> **Quota note:** The free daily quota covers ~5.5 hours of polling at a 10-second interval. Request a quota increase in Google Cloud Console for full-day use.

### Kick

No API key or login required. Kick chat uses a public WebSocket. Add a Kick channel by slug (e.g. `xqc`) and it connects automatically.

---

## Settings Reference

Open Settings with `Ctrl + ,` or the gear icon.

### Appearance & Chat Display

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Theme | Dark / Light / System | Dark | App color scheme |
| Font Size | 10–22px | 14px | Base text size (also: `Ctrl +/-`) |
| Message Spacing | Compact / Normal / Cozy | Normal | Vertical padding between messages |
| Alternating Rows | On / Off | Off | Subtle zebra-striping |
| Timestamps | On / Off | Off | Show time next to each message |
| Timestamp Format | 24h / 12h | 24h | Clock format |
| Badges | On / Off | On | Subscriber, mod, and other badges |
| Platform Indicator | On / Off | On | Colored dot showing the source platform |
| Username Display | Display / Login / Both | Display | Which name variant to render |
| Deleted Messages | Strike / Hide | Strike | How timed-out messages appear |

### Behavior

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Pause Scroll on Hover | On / Off | On | Freeze auto-scroll when hovering |
| Show Reply Context | On / Off | On | Quoted bar above reply messages |
| Connection Alerts | On / Off | On | Connect/disconnect system messages |
| Flash on Mention | On / Off | Off | Taskbar flash when your name is mentioned |
| Hide Command Messages | On / Off | Off | Filter messages starting with `/` or `!` |
| Max Messages Per Channel | 500–10,000 | 1,000 | Message retention cap |

### Emotes

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| 7TV | On / Off | On | 7TV global and channel emotes |
| BTTV | On / Off | On | BetterTTV emotes |
| FFZ | On / Off | On | FrankerFaceZ emotes |
| Emote Scale | 0.75× – 3× | 1× | Emote size relative to font |
| Animation | Always / Focused / Never | Focused | When animated emotes play |

---

## Architecture

```
src/
├── main/           Electron main process (Node.js)
│   ├── services/   Twitch IRC WS, YouTube polling, Kick Pusher
│   ├── emotes/     7TV / BTTV / FFZ fetch, disk cache, resolver
│   ├── auth/       OAuth PKCE (Twitch), API key (YouTube)
│   ├── ipc/        Typed IPC bridge + rate-limited broadcaster
│   └── store/      electron-store settings persistence
├── renderer/       React 18 frontend
│   ├── store/      Zustand 5 + immer + IPC sync middleware
│   ├── components/ Chat (virtualized), settings, UI primitives
│   └── hooks/      useSettings, useChat
└── shared/         Types shared between main and renderer
    ├── types/      message, channel, emote, settings, ipc
    └── constants.ts
```

The main process owns all platform connections. Emote packs are fetched and cached on disk, then pushed to the renderer via a typed IPC event (`EMOTE_BATCH_READY`). The renderer retokenizes existing messages when emotes arrive, so nothing is missed.

---

## Contributing

Contributions are welcome.

1. Fork the repo and create a branch: `git checkout -b feature/my-feature`
2. Make your changes and verify types: `npx tsc --noEmit`
3. Open a pull request with a clear description

Open an issue first for large features to discuss the approach before writing code.

---

## Roadmap

- [ ] YouTube send messages
- [ ] Kick OAuth + send messages
- [ ] Merged "All" tab across platforms
- [ ] Per-channel custom keyword alert rules
- [ ] Custom username color overrides
- [ ] Regex-based chat filters
- [ ] Log export (JSON / CSV)
- [ ] Pronouns support
- [ ] Resizable multi-column layout

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Take Control of Your Stream with AntiSnipe

You're already managing your chat like a pro. Now take the same level of control over your **stream itself**.

---

### The Problem Every Competitive Streamer Knows

Stream snipers join your game using your own broadcast against you. Your only real defense is stream delay — but every platform makes this painful:

- Twitch's delay options are fixed presets
- YouTube has no mid-stream delay adjustment
- **Any delay change on any platform requires ending your stream, losing your VOD continuity, and restarting your encoder**

You're forced to choose between protecting yourself and maintaining stream quality.

### AntiSnipe: Dynamic Delay Without Ending Your Stream

**AntiSnipe** is a local RTMP proxy that runs on your machine, between your encoder (OBS, Streamlabs, etc.) and your streaming destinations. It buffers your stream locally and gives you **real-time delay control without any restarts**.

```
OBS / Encoder
      │
      ▼
 AntiSnipe (local)  ──▶  Twitch   (with delay)
      │              ──▶  YouTube  (with delay)
      │              ──▶  Kick     (with delay)
      └──────────────────────────────────────────
              One encoder output. All platforms.
              Delay adjustable live. No restarts.
```

### What You Can Do

| Scenario | Without AntiSnipe | With AntiSnipe |
|----------|-------------------|----------------|
| Add delay mid-stream | End stream → change settings → restart | Drag the delay slider |
| Reduce delay post-game | End stream → change settings → restart | Drag the delay slider |
| Multistream (RTMP) | Pay for a relay service or use multiple encoder outputs | One output, all platforms |
| Emergency sniper response | Nothing | +5 minutes of delay, instantly |

### Why Local?

AntiSnipe runs entirely on your own hardware:

- **No middleman servers** — your stream goes machine → platform, not through someone else's infrastructure
- **No latency penalty** — buffering is local RAM/disk, not a transatlantic hop
- **Your stream, your control**

### Get AntiSnipe

> **[antisnipe.com](https://antisnipe.com)**

AntiSnipe MultiChat is free and open source. AntiSnipe is a paid product — built for streamers who need a professional-grade solution and want it to just work. Use MultiChat to stay on top of your community. Use AntiSnipe to stay one step ahead of everyone else.

---

<p align="center">
  Made for the streaming community.<br />
  <a href="https://antisnipe.com">AntiSnipe</a> &nbsp;·&nbsp;
  <a href="https://github.com/your-org/AntiSnipe-MultiChat/issues">Report an Issue</a> &nbsp;·&nbsp;
  <a href="https://github.com/your-org/AntiSnipe-MultiChat/releases">Download</a>
</p>
