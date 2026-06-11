# Twitch User Card Design

## Goal

Make clicking a Twitch chatter open a compact, Chatterino-style user card that reliably displays profile information without leaving the chat view.

## Interaction

- Clicking a Twitch username opens one anchored card beside the clicked name.
- Clicking another username replaces the existing card.
- Clicking outside the card or pressing Escape closes it.
- The card remains draggable within the application window.
- Non-Twitch usernames remain non-clickable until their platforms have profile support.

## Visual Design

- Reuse the existing compact `UserCard` panel rather than creating a separate operating-system window.
- Keep the restrained dark utility styling, narrow width, dense spacing, small typography, and clear separators associated with Chatterino.
- Show avatar, display name, login, and a Twitch profile link at the top.
- Show follower and subscription details only when Twitch returns them.
- Show recent messages from the current in-memory channel buffer.
- Show timeout, ban, and unban actions only when the current user has moderation access.

## Renderer Architecture

`MessageRow` owns the selected card state for its username:

1. Capture the clicked username element's bounding rectangle.
2. Render the existing `UserCard` portal with the message's user ID, login, and channel ID.
3. Route moderation actions through the existing `mod:action` IPC command.
4. Close the card on outside click, Escape, or after a moderation action.

The existing `usercard:openWindow` flow and `UserCardApp` are not used for chat-row clicks.

## Rust Data Flow

`twitch_get_user_card` becomes an async command:

1. Read the Twitch Client ID and authenticated user access token from `AppState`.
2. Query Helix `/users`, preferring `user_id` and falling back to `login`.
3. Return basic identity data: user ID, login, display name, and profile image URL.
4. Determine the channel broadcaster ID from the saved channel configuration when possible.
5. Attempt follower and subscription lookups independently.
6. Treat permission failures for optional fields as absent data rather than failing the whole card.

If Twitch authentication is unavailable, return an explicit error so the renderer can show a useful unavailable state.

## Error Handling

- Basic user lookup failure produces the existing compact "Could not load user info" state.
- Optional follower or subscription failures do not hide basic profile data.
- Empty user IDs fall back to login-based lookup.
- External profile links use the existing shell-open command.

## Testing

- Rust parsing test for Helix user data.
- Rust test proving optional relationship data can be absent while identity remains valid.
- Renderer test for user-card selection state and anchored payload.
- Existing typecheck, Vitest, lint, Rust tests, and Tauri build must pass.
