# Tauri Chatterino Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Confluence from Electron to a Rust-backed Tauri app and reshape the first experience toward Chatterino-style dense chat.

**Architecture:** Keep the React renderer, replace Electron main/preload with Rust Tauri commands and events, and hide runtime differences behind a small frontend bridge. Implement the first backend runtime slice around settings, window commands, and Twitch chat.

**Tech Stack:** Tauri 2, Rust, Tokio, Serde, Vite, React 18, Zustand, Vitest.

---

## File Structure

- Create `src-tauri/`: Tauri Rust application.
- Create `src-tauri/Cargo.toml`: Rust dependencies and Tauri build metadata.
- Create `src-tauri/tauri.conf.json`: app identity, dev URL, frontend dist path, windows, permissions.
- Create `src-tauri/build.rs`: Tauri build hook.
- Create `src-tauri/src/lib.rs`: testable application entrypoint and module declarations.
- Create `src-tauri/src/main.rs`: binary entrypoint.
- Create `src-tauri/src/app_state.rs`: shared state container.
- Create `src-tauri/src/models.rs`: serde models for settings, channels, messages, auth, and events.
- Create `src-tauri/src/settings.rs`: settings defaults, load, save, merge.
- Create `src-tauri/src/events.rs`: event names and emit helpers.
- Create `src-tauri/src/commands.rs`: Tauri commands for settings, channels, chat, auth, window, updater placeholders.
- Create `src-tauri/src/platforms/mod.rs`: platform module root.
- Create `src-tauri/src/platforms/twitch.rs`: Twitch IRC parser and connection manager.
- Modify `package.json`: replace Electron scripts with Vite/Tauri scripts and add Tauri dependencies.
- Modify `src/renderer/main.tsx`: initialize the bridge before rendering.
- Modify `src/renderer/globals.d.ts`: keep `window.chatBridge` typing.
- Create `src/renderer/services/tauriBridge.ts`: bridge adapter from existing IPC strings to Tauri commands/events.
- Modify `src/renderer/store/middleware/ipcSync.ts`: import and use the bridge initializer.
- Modify `src/renderer/App.tsx`: Chatterino-style split-ready shell.
- Modify `src/renderer/components/chat/ChatPane.tsx`: make it usable as a split pane.
- Modify `src/renderer/styles/globals.css` and `src/renderer/styles/theme.css`: Tauri window and compact Chatterino base tokens.
- Create tests under `src-tauri/src/*` and `src/renderer/services/tauriBridge.test.ts`.

## Task 1: Tauri Scaffold and Build Scripts

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Modify: `package.json`

- [ ] **Step 1: Add a minimal Tauri Rust app**

Create a Tauri 2 Rust app that launches the existing Vite renderer. Use `com.antisnipe.multichat` as the identifier and `Confluence` as the product name.

- [ ] **Step 2: Update npm scripts**

Add:

```json
"dev": "vite --host 127.0.0.1",
"tauri:dev": "tauri dev",
"build": "vite build",
"tauri:build": "tauri build"
```

Keep `typecheck`, `lint`, and `test` scripts.

- [ ] **Step 3: Verify scaffold**

Run:

```powershell
npm run typecheck
```

Expected: TypeScript compiles or reports only pre-existing renderer errors unrelated to Tauri scaffold.

## Task 2: Rust Models and Settings Store

**Files:**
- Create: `src-tauri/src/models.rs`
- Create: `src-tauri/src/settings.rs`
- Create: `src-tauri/src/app_state.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write Rust settings tests**

Add unit tests for default settings, partial update merge, and channel persistence.

- [ ] **Step 2: Run tests to verify they fail before implementation**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml settings
```

Expected: tests fail because settings implementation is incomplete.

- [ ] **Step 3: Implement settings store**

Use `serde`, `serde_json`, and Tauri app config directories. The store must return defaults when no file exists and save merged updates.

- [ ] **Step 4: Verify settings tests**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml settings
```

Expected: tests pass.

## Task 3: Tauri Command Surface and Frontend Bridge

**Files:**
- Create: `src-tauri/src/commands.rs`
- Create: `src-tauri/src/events.rs`
- Create: `src/renderer/services/tauriBridge.ts`
- Create: `src/renderer/services/tauriBridge.test.ts`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/renderer/main.tsx`
- Modify: `src/renderer/globals.d.ts`
- Modify: `src/renderer/store/middleware/ipcSync.ts`

- [ ] **Step 1: Write bridge mapping tests**

Test that `settings:get` maps to `settings_get`, `settings:set` maps to `settings_set`, and `chat:messageBatch` subscribes to the same event name.

- [ ] **Step 2: Run bridge tests to verify failure**

Run:

```powershell
npm run test -- src/renderer/services/tauriBridge.test.ts
```

Expected: test fails because the bridge does not exist yet.

- [ ] **Step 3: Implement Rust command placeholders**

Implement settings commands fully. Implement channel/chat/auth/updater/plugin commands as explicit placeholders that return typed errors or neutral defaults until their modules land.

- [ ] **Step 4: Implement frontend bridge**

Expose `window.chatBridge` in Tauri by mapping existing string channels to `invoke()` command names and `listen()` events.

- [ ] **Step 5: Verify bridge tests**

Run:

```powershell
npm run test -- src/renderer/services/tauriBridge.test.ts
```

Expected: bridge mapping tests pass.

## Task 4: Twitch Parser and Connection Manager

**Files:**
- Create: `src-tauri/src/platforms/mod.rs`
- Create: `src-tauri/src/platforms/twitch.rs`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/app_state.rs`

- [ ] **Step 1: Write parser tests**

Cover Twitch IRC `PRIVMSG`, action messages, badges, colors, display name, message id, user id, reply tags, and deleted message events.

- [ ] **Step 2: Run parser tests to verify failure**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml twitch
```

Expected: tests fail because parser is incomplete.

- [ ] **Step 3: Implement Twitch parser**

Convert IRC tags and message bodies into the normalized message shape expected by the renderer.

- [ ] **Step 4: Implement connection manager**

Use Tokio tasks and WebSocket support to connect to Twitch IRC, join channels, emit connection state, and batch messages.

- [ ] **Step 5: Verify Twitch tests**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml twitch
```

Expected: parser tests pass. Network connection behavior can be smoke-tested through Tauri dev.

## Task 5: Chatterino-Style Renderer Shell

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/chat/ChatPane.tsx`
- Modify: `src/renderer/components/chat/ChatTabs.tsx`
- Modify: `src/renderer/components/layout/TitleBar.tsx`
- Modify: `src/renderer/styles/globals.css`
- Modify: `src/renderer/styles/theme.css`
- Modify: `src/renderer/styles/chat.module.css`

- [ ] **Step 1: Add renderer tests for pane structure**

Test that the app renders a chat workspace, channel tabs, and a chat input region without Electron globals when the Tauri bridge is initialized.

- [ ] **Step 2: Run renderer tests to verify failure**

Run:

```powershell
npm run test -- src/renderer
```

Expected: tests expose missing Tauri bridge or layout assumptions.

- [ ] **Step 3: Implement split-ready chat workspace**

Keep one active pane for the first milestone, but structure DOM and CSS so a split grid can be added without replacing the chat pane.

- [ ] **Step 4: Tighten Chatterino density**

Reduce vertical chrome, keep compact tabs/header/status, preserve inline message flow, and avoid decorative cards or landing-page composition.

- [ ] **Step 5: Verify renderer tests**

Run:

```powershell
npm run test -- src/renderer
```

Expected: renderer tests pass or only unrelated pre-existing tests fail with documented output.

## Task 6: Integration Verification

**Files:**
- Modify only if required by failures found during verification.

- [ ] **Step 1: Run Rust tests**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 2: Run TypeScript typecheck**

Run:

```powershell
npm run typecheck
```

- [ ] **Step 3: Run unit tests**

Run:

```powershell
npm run test
```

- [ ] **Step 4: Run Tauri build**

Run:

```powershell
npm run tauri:build
```

- [ ] **Step 5: Review remaining Electron references**

Run:

```powershell
rg "electron|ipcRenderer|ipcMain|BrowserWindow|chatBridge" src package.json src-tauri
```

Expected: Electron references should be limited to legacy source files or documentation until the legacy path is removed in a later cleanup.
