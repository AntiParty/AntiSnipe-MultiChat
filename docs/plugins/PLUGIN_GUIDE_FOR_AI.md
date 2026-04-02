# AntiSnipe MultiChat — Plugin Authoring Guide

> Upload this file to any AI (Claude, ChatGPT, Gemini, etc.) and then describe the plugin you want.
> The AI will generate a ready-to-use `.js` file you can drop straight into your plugins folder.

---

## What is a plugin?

A plugin is a single `.js` file placed in your plugins folder
(`Settings → Plugins → Open Plugins Folder`).

Each plugin exports one function. The app calls that function for every incoming
chat message. The function returns an **action** (or `null` to do nothing).
The first plugin that returns a non-null action wins — subsequent plugins are
skipped for that message.

Plugins **hot-reload** — save the file and the change takes effect immediately
without restarting the app.

---

## File format

```js
// @name Human-readable name shown in Settings → Plugins
// Optional description lines here

export default function myPlugin(msg) {
  // ... your logic ...
  return null   // or an action object
}
```

- The `// @name` comment sets the display name in the Settings panel.
- The function must be exported as `export default`.
- The function name after `function` is optional but helps readability.
- You may declare `const`, `let`, variables and helper functions above the
  export — they are private to the plugin file.

---

## The `msg` object — every field

```js
{
  id:            string,   // Unique message ID
  platform:      string,   // 'twitch' | 'youtube' | 'kick' | 'tiktok'
  channelId:     string,   // Internal channel ID (e.g. 'twitch:xqc')
  author:        string,   // Login name, always lowercase  (e.g. 'alice')
  authorDisplay: string,   // Display name (may have capitals/unicode)
  text:          string,   // Full raw text of the message
  messageType:   string,   // 'chat' | 'action' | 'sub' | 'resub' |
                           // 'giftsub' | 'raid' | 'announcement' |
                           // 'redeem' | 'system'
  badges:        string[], // Badge IDs present on the message
                           // e.g. ['moderator', 'subscriber', 'founder',
                           //       'broadcaster', 'vip', 'premium']
  isMod:         boolean,  // true if author has moderator or broadcaster badge
  isSubscriber:  boolean,  // true if author has subscriber or founder badge
}
```

### Useful badge IDs for `msg.badges`

| Badge ID       | Meaning                            |
|----------------|------------------------------------|
| `broadcaster`  | Channel owner                      |
| `moderator`    | Moderator                          |
| `vip`          | VIP (Twitch)                       |
| `subscriber`   | Subscriber (any tier)              |
| `founder`      | Founding subscriber                |
| `premium`      | Twitch Prime / Prime Gaming        |
| `bits`         | Bits donor                         |
| `partner`      | Verified/partnered streamer        |

Check with: `msg.badges.includes('vip')`

---

## Return values — actions

Return **exactly one** of these objects, or `null`.

### `null` — do nothing
```js
return null
```

### `{ type: 'hide' }` — remove the message from the chat list
```js
return { type: 'hide' }
```

### `{ type: 'highlight', color }` — tint the message row background
```js
return { type: 'highlight', color: 'rgba(255, 200, 0, 0.15)' }
```
`color` is any valid CSS color string. Use low-opacity rgba values so the
text stays readable. Examples:
- Gold:  `'rgba(255, 200, 0, 0.15)'`
- Blue:  `'rgba(100, 160, 255, 0.15)'`
- Red:   `'rgba(255, 80, 80, 0.15)'`
- Teal:  `'rgba(56, 189, 170, 0.10)'`
- Green: `'rgba(80, 200, 120, 0.12)'`

### `{ type: 'tag', label, color? }` — prepend a small pill badge before the username
```js
return { type: 'tag', label: 'VIP', color: '#a78bfa' }
```
- `label`: short text shown inside the badge (keep it under ~8 characters)
- `color`: optional CSS color for the badge text (defaults to muted gray)

---

## Constraints and limitations

- **No `import`/`require`**: Plugins run in a sandboxed `Function()` context.
  You cannot import npm packages or other files.
- **No async**: The function must return synchronously. No `await`,
  no `Promise`, no `setTimeout`.
- **No DOM/Node APIs**: No `document`, no `fs`, no `fetch`.
  The function receives only `msg` and must return a plain object.
- **No side effects that persist across restarts**: Any state you declare
  (like a `Set` or `Map` at the top of the file) resets when the app restarts
  or when the plugin is reloaded.
- **Errors are swallowed**: If your function throws, it is caught silently and
  treated as `null`. Test your logic carefully.
- **First match wins**: If you have multiple plugins, the first one to return a
  non-null action stops the chain for that message.

---

## Patterns and recipes

### Check if text contains a word (case-insensitive)
```js
const lower = msg.text.toLowerCase()
if (lower.includes('giveaway')) return { type: 'highlight', color: 'rgba(255,200,0,0.15)' }
```

### Match exact username (always compare lowercase)
```js
if (msg.author === 'alice') return { type: 'tag', label: 'Friend', color: '#4ade80' }
```

### Match a list of users
```js
const KNOWN = new Set(['alice', 'bob', 'charlie'])
if (KNOWN.has(msg.author)) return { type: 'tag', label: 'Known', color: '#a78bfa' }
```

### Filter to a specific platform
```js
if (msg.platform !== 'twitch') return { type: 'hide' }
```

### Show only subscriber messages
```js
if (!msg.isSubscriber && !msg.isMod) return { type: 'hide' }
```

### Regex match
```js
if (/https?:\/\//.test(msg.text)) return { type: 'highlight', color: 'rgba(255,100,80,0.12)' }
```

### Detect repeated characters (spam)
```js
if (/(.)\1{5,}/.test(msg.text)) return { type: 'hide' }
```

### Multiple conditions, different colors
```js
export default function multiCheck(msg) {
  if (msg.badges.includes('broadcaster')) {
    return { type: 'highlight', color: 'rgba(145, 71, 255, 0.15)' }
  }
  if (msg.isMod) {
    return { type: 'tag', label: 'MOD', color: '#9147ff' }
  }
  if (msg.text.toLowerCase().includes('clip')) {
    return { type: 'highlight', color: 'rgba(100, 200, 255, 0.12)' }
  }
  return null
}
```

### Only run on certain message types
```js
// Only process normal chat messages, skip subs/raids/etc.
if (msg.messageType !== 'chat' && msg.messageType !== 'action') return null
```

---

## Complete example plugins

### Spam filter
```js
// @name Spam Filter
export default function spamFilter(msg) {
  const text = msg.text.trim()
  if (!text) return null

  // All-caps (ignore short messages)
  if (text.length > 10) {
    const letters = text.replace(/[^a-zA-Z]/g, '')
    if (letters.length > 5) {
      const upperRatio = letters.replace(/[^A-Z]/g, '').length / letters.length
      if (upperRatio >= 0.7) return { type: 'hide' }
    }
  }

  // Repeated character spam
  if (/(.)\1{5,}/.test(text)) return { type: 'hide' }

  // Wall-of-text
  if (text.length > 400) return { type: 'hide' }

  return null
}
```

### VIP tagger
```js
// @name VIP Tagger
const VIPS = new Set(['alice', 'bob'])

export default function vipTagger(msg) {
  if (VIPS.has(msg.author.toLowerCase())) {
    return { type: 'tag', label: 'VIP', color: '#a78bfa' }
  }
  return null
}
```

### Bot hider
```js
// @name Bot Filter
const BOTS = new Set(['nightbot', 'streamelements', 'streamlabs', 'moobot'])

export default function botFilter(msg) {
  if (BOTS.has(msg.author.toLowerCase())) {
    return { type: 'hide' }
  }
  return null
}
```

---

## How to install a plugin

1. Open **Settings → Plugins → Open Plugins Folder**
2. Save your `.js` file into that folder
3. The plugin loads immediately — no restart needed
4. Check **Settings → Plugins** to confirm it shows a green checkmark

If it shows a red error icon, the plugin has a syntax error. Fix the file and
save again to hot-reload it.

---

## Prompting tips for the AI

When asking the AI to create a plugin, be specific:

- **Good:** "Create a plugin that hides all messages shorter than 3 words, but keeps messages from moderators."
- **Good:** "Create a plugin that adds a red 'WATCH' tag to any message containing a YouTube or Twitch URL."
- **Good:** "Create a plugin that highlights messages from users on this list in green: alice, bob, charlie."
- **Vague:** "Make a filter plugin." ← the AI will guess what you want

You can also ask the AI to combine multiple behaviors in one file.
