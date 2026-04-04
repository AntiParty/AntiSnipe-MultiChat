# Contributing to AntiSnipe MultiChat

Thanks for your interest in contributing! This document covers everything you need to know to get the project running locally, understand how it's structured, and submit a quality pull request.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Code Conventions](#code-conventions)
- [IPC — Adding New Features](#ipc--adding-new-features)
- [Adding a New Platform](#adding-a-new-platform)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Good First Issues](#good-first-issues)

---

## Getting Started

**Requirements:** Node.js 20+ · npm 9+ · Git

```bash
git clone https://github.com/Antiparty/AntiSnipe-MultiChat.git
cd AntiSnipe-MultiChat
npm install
npm run dev
```

`npm run dev` starts Electron with hot-reload for both the main process and the renderer (Vite HMR). Changes to renderer code update instantly in the window; changes to main process code trigger an Electron restart.

### Other useful commands

| Command | What it does |
|---------|--------------|
| `npm run typecheck` | Run `tsc --noEmit` for both main and renderer |
| `npm run lint` | ESLint across all `.ts` / `.tsx` files |
| `npm test` | Vitest unit tests |
| `npm run build` | Compile everything (no installer) |
| `npm run package:win` | Build + create Windows NSIS installer |
| `npm run package:mac` | Build + create macOS DMG |
| `npm run package:linux` | Build + create AppImage + .deb |

---

## Project Structure

```
AntiSnipe-MultiChat/
├── src/
│   ├── main/                   Electron main process (Node.js)
│   │   ├── auth/               OAuth flows + token storage
│   │   │   ├── TwitchAuth.ts   PKCE auth server + token refresh
│   │   │   ├── YouTubeAuth.ts  Google OAuth + token refresh
│   │   │   ├── TokenStore.ts   Encrypted credential persistence (electron-store + safeStorage)
│   │   │   └── LocalAuthServer.ts  Local HTTP server for OAuth callbacks
│   │   ├── emotes/             Emote fetching, caching, and resolution
│   │   ├── ipc/
│   │   │   ├── handlers.ts     All ipcMain.handle() registrations
│   │   │   └── broadcaster.ts  Rate-limited event broadcaster (30fps batching)
│   │   ├── services/
│   │   │   ├── PlatformManager.ts  Orchestrates all platform connections
│   │   │   ├── twitch/         IRC WebSocket, message normalizer, badge resolver
│   │   │   ├── youtube/        Data API v3 polling, chat normalizer
│   │   │   ├── kick/           Pusher WebSocket
│   │   │   └── tiktok/         tiktok-live-connector adapter
│   │   └── store/              Settings persistence (electron-store + Zod validation)
│   │
│   ├── renderer/               React 18 frontend (Vite)
│   │   ├── components/
│   │   │   ├── chat/           ChatPane, MessageRow, ChatInput, ChatTabs, UserCard
│   │   │   ├── layout/         TitleBar, UpdateBanner, root shell
│   │   │   ├── settings/       Settings modal and all tab panels
│   │   │   └── ui/             Primitive components (Button, Input, Tooltip, etc.)
│   │   ├── hooks/              useSettings, useActiveMessages, etc.
│   │   └── store/
│   │       ├── index.ts        Zustand root store with Immer
│   │       ├── slices/         authSlice, chatSlice, channelsSlice, settingsSlice
│   │       └── middleware/
│   │           └── ipcSync.ts  Subscribes to IPC events and writes them into the store
│   │
│   └── shared/                 Types shared between main and renderer
│       ├── types/
│       │   ├── message.ts      NormalizedMessage — the canonical chat message type
│       │   ├── channel.ts      Channel identity + connection state
│       │   ├── settings.ts     AppSettings schema
│       │   ├── ipc.ts          All typed IPC channel names + payload maps
│       │   └── emote.ts        EmoteData, EmoteMap
│       └── constants.ts
│
├── docs/                       GitHub Pages (static, no build step)
└── resources/                  App icons (icon.ico / .icns / .png)
```

---

## Architecture Overview

### Main ↔ Renderer communication

All communication between the Node.js main process and the React renderer goes through a **typed IPC bridge** defined in `src/shared/types/ipc.ts`.

- **Renderer → Main**: `ipcRenderer.invoke(MAIN_CHANNELS.X, payload)` — returns a Promise
- **Main → Renderer**: `broadcaster.send(RENDERER_CHANNELS.X, payload)` — fire-and-forget, batched at 30fps
- **Renderer receives**: `ipcSync.ts` middleware listens for all renderer-bound channels and writes the data into Zustand

Never add raw `ipcMain.on` / `ipcRenderer.on` calls — always go through the typed maps.

### Message flow

```
Platform WebSocket/API
        │
        ▼
 Service (e.g. TwitchService)
        │  normalizes to NormalizedMessage
        ▼
 PlatformManager
        │  calls broadcaster.addMessages(channelId, messages)
        ▼
 Broadcaster (batches at 30fps)
        │  emits RENDERER_CHANNELS.MESSAGES_BATCH
        ▼
 ipcSync.ts middleware
        │  calls store.addMessages(channelId, messages)
        ▼
 chatSlice (Zustand + Immer)
        │  state.messagesByChannel[channelId]
        ▼
 ChatPane component
        │  renders last 200 messages as plain block-flow divs
        ▼
 MessageRow (memoized)
```

### State management

The renderer uses **Zustand 5 with Immer**. State is split into slices:

- `chatSlice` — `messagesByChannel`, `addMessages`, `deleteMessage`
- `channelsSlice` — `channels`, `activeChannelId`, `connectionStates`
- `authSlice` — `twitchAuthState`, `youtubeAuthState`
- `settingsSlice` — mirrors `AppSettings` from the main store

**Critical:** Zustand re-renders a component whenever the selector's return value changes by reference. Selectors that return arrays or objects must be **stable** — use `EMPTY_ARRAY` constants and `useMemo` for any derived values. Never do `useStore(s => s.messages.filter(...))` directly.

```typescript
// Bad — creates new array every render → infinite loop
const msgs = useStore(s => s.messagesByChannel[id]?.filter(m => !m.isDeleted))

// Good
const EMPTY: NormalizedMessage[] = []
const allMsgs = useStore(s => s.messagesByChannel[id] ?? EMPTY)
const msgs = useMemo(() => allMsgs.filter(m => !m.isDeleted), [allMsgs])
```

---

## Development Workflow

1. **Fork** the repo and create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Before starting**, check if there's an open issue for what you want to build. If not, open one to discuss it — especially for larger changes.

3. **Type-check early and often:**
   ```bash
   npm run typecheck
   ```

4. **Test your change** — if the feature touches message parsing or store logic, add a Vitest test in the appropriate `*.test.ts` file.

5. **Lint before committing:**
   ```bash
   npm run lint
   ```

6. Open a PR against `main` — see [Submitting a Pull Request](#submitting-a-pull-request).

---

## Code Conventions

### TypeScript

- Strict mode is on (`"strict": true`). No `any` unless absolutely unavoidable — use a comment explaining why.
- All IPC payloads must be typed through `src/shared/types/ipc.ts`. Never hardcode channel name strings.
- Shared types live in `src/shared/` — don't duplicate them in `main/` or `renderer/`.

### React

- Components are `.tsx`. Utility/logic is `.ts`.
- Prefer `useCallback` and `React.memo` for anything in the message list — it re-renders constantly.
- Avoid effects for things that can be derived. If you find yourself doing `useEffect(() => setX(derive(y)), [y])`, it should probably just be a `useMemo`.

### Styling

- Tailwind utility classes are the default. Use them in JSX.
- For dynamic styles (e.g. per-message color from a hex string), inline `style={{}}` is fine.
- The color palette is dark-first. If you add UI, test it in dark mode.

### Naming

| Thing | Convention |
|-------|-----------|
| React components | `PascalCase.tsx` |
| Hooks | `useCamelCase.ts` |
| Zustand slices | `camelCaseSlice.ts` |
| IPC channel keys | `SCREAMING_SNAKE_CASE` (the key in the map) |
| IPC channel values | `'namespace:verb'` strings |
| Services | `PascalCase.ts` in `src/main/services/` |

---

## IPC — Adding New Features

Most new features require a main-process handler and a renderer call. Here's the full checklist:

### 1. Add the channel(s) to `src/shared/types/ipc.ts`

```typescript
// Renderer → Main (invoke)
export const MAIN_CHANNELS = {
  // ...existing...
  MY_FEATURE: 'feature:doThing',
}

// Add the payload and return types
export interface ChatBridgeInvokeMap {
  // ...existing...
  [MAIN_CHANNELS.MY_FEATURE]: [{ input: string }, { result: number }]
}
```

For events **pushed from main to renderer**, add to `RENDERER_CHANNELS` and `ChatBridgeEventMap` instead.

### 2. Add the handler in `src/main/ipc/handlers.ts`

```typescript
ipcMain.handle(MAIN_CHANNELS.MY_FEATURE, async (_event, { input }) => {
  return myService.doThing(input)
})
```

### 3. Call it from the renderer

```typescript
const result = await window.electron.ipcRenderer.invoke(MAIN_CHANNELS.MY_FEATURE, { input: 'hello' })
```

### 4. For renderer-bound events, update `ipcSync.ts`

```typescript
ipc.on(RENDERER_CHANNELS.MY_EVENT, (_e, payload) => {
  useStore.getState().setMyThing(payload)
})
```

---

## Adding a New Platform

New platforms follow the same pattern as the existing four. Here's the checklist:

1. **Create `src/main/services/<platform>/`** with at minimum:
   - A connection class that extends or matches the shape of other services
   - A `normalize(raw)` function that maps the platform's native message format to `NormalizedMessage`

2. **Register it in `PlatformManager.ts`** — add a `connect` / `disconnect` case in the platform switch

3. **Add the platform literal** to the `Platform` union in `src/shared/types/message.ts`

4. **Add the platform logo** to `src/renderer/components/ui/PlatformLogos.tsx`

5. **Update the "Add Channel" modal** to include the new platform as an option

6. Open a PR — platform additions are welcome but please open an issue first to discuss API access, authentication requirements, and rate limits.

---

## Submitting a Pull Request

- **One PR, one concern.** Don't bundle unrelated fixes.
- Fill in the PR template — describe what changed and why.
- If your PR fixes an open issue, reference it: `Closes #123`.
- Make sure `npm run typecheck` and `npm run lint` pass with no errors.
- Screenshots/GIFs are appreciated for UI changes.
- Keep commits clean. Squash fixup commits before opening the PR if you prefer, but it's not required — we'll squash on merge.

### PR checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (or new tests added for new logic)
- [ ] UI changes tested in dark mode
- [ ] No hardcoded IPC channel strings — all go through `MAIN_CHANNELS` / `RENDERER_CHANNELS`
- [ ] No new `any` without a comment

---

## Good First Issues

Not sure where to start? Look for issues tagged [`good first issue`](https://github.com/Antiparty/AntiSnipe-MultiChat/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) on GitHub. These are self-contained improvements that don't require deep knowledge of the full architecture.

Examples of good contributions:
- Fixing a UI layout or styling inconsistency
- Adding a missing keyboard shortcut
- Improving an error message or loading state
- Adding a Vitest test for existing parsing logic
- Fixing a typo in comments or docs

---

If you have any questions about the codebase, open a [GitHub Discussion](https://github.com/Antiparty/AntiSnipe-MultiChat/discussions) or drop a comment on the relevant issue.
