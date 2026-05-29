# Tauri Chatterino Migration Design

## Product Gist

Confluence is a desktop multistream chat client for streamers. It merges Twitch, YouTube, Kick, and TikTok live chat into one fast desktop window, with channel tabs, an all-chat feed, Twitch and YouTube OAuth, Twitch message sending and moderation actions, third-party emotes, viewer information, plugins, and persistent settings.

The current implementation is Electron plus React. Electron's main process owns every platform connection, auth flow, settings store, emote cache, plugin manager, updater, and IPC bridge. React renders the chat UI and maintains local state with Zustand.

## Goal

Convert Confluence to a Rust-backed Tauri application with a Chatterino-like chat experience. The first migration target is not a thin wrapper around the existing Node process. Rust should own app lifecycle, commands, events, settings, auth, chat connections, message normalization, and cacheable backend work.

## Scope

The first buildable slice is a Tauri app that launches the current React renderer through Vite, uses Rust commands/events instead of Electron IPC, persists settings in Rust, and supports a Twitch-first chat runtime. The UI should be reshaped toward Chatterino's compact, high-density, keyboard-friendly workflow.

The existing Electron code remains useful as a reference during the migration, but the new runtime path should live under `src-tauri/` and `src/renderer/services/tauriBridge.ts`. Existing renderer components should call a bridge API rather than direct Electron globals.

## Architecture

Rust modules:

- `src-tauri/src/main.rs`: app boot, plugin registration, window setup, shared state wiring.
- `src-tauri/src/lib.rs`: module exports and `run()` entrypoint for testability.
- `src-tauri/src/app_state.rs`: shared managers used by Tauri commands.
- `src-tauri/src/models/*`: serde data models matching the shared TypeScript contract.
- `src-tauri/src/settings.rs`: persisted settings and validation defaults.
- `src-tauri/src/events.rs`: typed frontend event emitter and batched message delivery.
- `src-tauri/src/commands/*`: Tauri command handlers for settings, channel control, auth, mod actions, window control, emotes, and plugins.
- `src-tauri/src/platforms/twitch/*`: Twitch IRC, parser, normalizer, recent messages, auth-backed send/mod operations.

Frontend modules:

- `src/renderer/services/tauriBridge.ts`: Electron-compatible bridge adapter implemented with `@tauri-apps/api/core` and `@tauri-apps/api/event`.
- `src/renderer/globals.d.ts`: expose a `chatBridge` type for both Electron legacy and Tauri runtime during migration.
- `src/renderer/store/middleware/ipcSync.ts`: use the bridge adapter and keep command/event names centralized.
- Chat layout components: preserve message rendering logic where possible, but update app layout toward split-capable compact panes.

## Command and Event Contract

The frontend should keep the existing conceptual command names:

- `settings:get`
- `settings:set`
- `channel:connect`
- `channel:disconnect`
- `chat:send`
- `connections:getAll`
- `auth:getState`
- `mod:action`
- `window:minimize`
- `window:maximize`
- `window:close`

Tauri commands should use Rust-safe names such as `settings_get`, `settings_set`, `channel_connect`, and the frontend bridge maps between the current string contract and those commands.

Events should preserve the existing renderer channels where practical:

- `chat:messageBatch`
- `connection:state`
- `settings:updated`
- `error:platform`

## Chatterino Feel

The app should open directly into chat. The primary experience should be dense and utilitarian:

- compact rows with minimal vertical padding
- a split-ready chat workspace
- top or sidebar channel navigation with unread/status markers
- keyboard-first search and channel focus
- visible but compact moderation actions
- low animation, low visual decoration, high information density
- message rendering that stays stable under high-volume chat

The current `chat.module.css` already moves in this direction and should be preserved as the base rather than replaced.

## Milestones

1. Scaffold Tauri and make the renderer run in the Tauri shell.
2. Add typed Rust settings commands and a frontend Tauri bridge.
3. Wire app/window commands and basic event emission.
4. Implement Twitch IRC connect/disconnect and message parsing in Rust.
5. Emit normalized Twitch messages into the existing store.
6. Reshape the renderer shell into a Chatterino-style split-ready workspace.
7. Add tests for Rust parsing/settings and frontend bridge mapping.

## Risks

Twitch can be ported first because it exercises the hardest real-time path: IRC WebSocket, badges, auth-backed send, mod actions, recent messages, and user cards. YouTube, Kick, TikTok, plugins, auto-update, and emote cache should follow after the command/event architecture is proven.

Some current Node dependencies have no direct Rust equivalent and will need careful replacement:

- `electron-store` becomes a Rust settings file under Tauri app config.
- `electron-updater` becomes Tauri updater or deferred release work.
- `tiktok-live-connector` likely needs a Rust-compatible protocol implementation or a later sidecar decision.
- JavaScript plugin execution needs a Rust JS runtime decision, likely `boa_engine` or a sandboxed plugin redesign.

## Acceptance Criteria

- `npm run dev` or an equivalent script starts Tauri with the React renderer.
- The Electron preload path is no longer required by the Tauri runtime.
- Settings can be loaded and updated through Rust commands.
- A Twitch channel can connect from the UI and stream normalized messages into the chat pane.
- The chat UI is visibly denser and more Chatterino-like than the current app shell.
- Tests cover settings defaults, Twitch IRC parsing, command mapping, and bridge behavior.
