# AntiSnipe MultiChat - Plugin System

The AntiSnipe MultiChat plugin system allows you to create custom JavaScript plugins to modify chat behavior, automate responses, and enhance your streaming experience.

## Getting Started

Plugins are JavaScript files placed in your plugins folder. You can access this folder from **Settings → Plugins → Open Plugins Folder**.

Each plugin is a `.js` file that exports a default function. The function receives a message object and can return an action to modify how the message is handled.

## Plugin Structure

```javascript
// @name My Custom Plugin
// Optional description of what the plugin does

export default function myPlugin(msg) {
  // Your plugin logic here
  return null  // or an action object
}
```

## The Message Object

Every plugin receives a `msg` object with information about the chat message:

```javascript
{
  id: string,                    // Unique message ID
  platform: string,              // 'twitch' | 'youtube' | 'kick' | 'tiktok'
  channelId: string,             // Internal channel identifier
  author: string,                // Username (lowercase)
  authorDisplay: string,         // Display name (with capitals/special chars)
  text: string,                  // The raw message text
  messageType: string,           // 'chat' | 'action' | 'sub' | etc.
  badges: string[],              // Array of badge IDs
  isMod: boolean,                // True if user has moderator privileges
  isSubscriber: boolean,         // True if user is a subscriber
}
```

## Available Actions

### Hide Messages
Remove messages from the chat display:

```javascript
return { type: 'hide' }
```

### Highlight Messages
Add a colored background to messages:

```javascript
return { type: 'highlight', color: 'rgba(255, 200, 0, 0.15)' }
```

### Tag Users
Add a colored badge next to usernames:

```javascript
return { type: 'tag', label: 'VIP', color: '#a78bfa' }
```

### Replace Message Text
Change what the message displays:

```javascript
return { type: 'replace', text: 'This message was modified' }
```

### Send Response
Reply to commands (works for incoming messages):

```javascript
return { type: 'command', respond: 'Hello! Thanks for the command!' }
```

Special responses:
- `{ type: 'command', respond: '__song__' }` - Shows current Spotify track

## Settings

### Mention Users in Responses
In **Settings → Plugins**, you can enable "Mention users in responses" to automatically prefix all plugin responses with `@username`.

## Example Plugins

### Spam Filter
```javascript
// @name Spam Filter
export default function spamFilter(msg) {
  // Hide messages with excessive caps
  const letters = msg.text.replace(/[^a-zA-Z]/g, '')
  if (letters.length > 10) {
    const upperRatio = letters.replace(/[^A-Z]/g, '').length / letters.length
    if (upperRatio > 0.7) return { type: 'hide' }
  }

  // Hide repeated characters
  if (/(.)\1{5,}/.test(msg.text)) return { type: 'hide' }

  return null
}
```

### Custom Commands
```javascript
// @name Custom Commands
const COMMANDS = {
  '!commands': 'Available commands: !commands !discord !socials',
  '!discord': 'Join our Discord: discord.gg/example',
  '!socials': 'Follow us on Twitter @example',
}

export default function customCommands(msg) {
  const cmd = msg.text.trim().toLowerCase().split(' ')[0]
  const response = COMMANDS[cmd]
  if (response) {
    return { type: 'command', respond: response }
  }
  return null
}
```

### Song Request
```javascript
// @name Song Request
export default function songRequest(msg) {
  if (msg.text.toLowerCase().includes('!song')) {
    return { type: 'command', respond: '__song__' }
  }
  return null
}
```

### VIP Highlighter
```javascript
// @name VIP Highlighter
const VIPS = ['alice', 'bob', 'charlie']

export default function vipHighlighter(msg) {
  if (VIPS.includes(msg.author)) {
    return { type: 'tag', label: 'VIP', color: '#ff6b6b' }
  }
  return null
}
```

## Advanced Examples

### Conditional Responses
```javascript
// @name Smart Responses
export default function smartResponses(msg) {
  const text = msg.text.toLowerCase()

  // Only respond to subscribers
  if (!msg.isSubscriber) return null

  if (text.includes('hello')) {
    return { type: 'command', respond: 'Hello! Thanks for subscribing!' }
  }

  if (text.includes('bye')) {
    return { type: 'command', respond: 'Goodbye! See you next stream!' }
  }

  return null
}
```

### Platform-Specific Behavior
```javascript
// @name Platform Filter
export default function platformFilter(msg) {
  // Only work on Twitch
  if (msg.platform !== 'twitch') return null

  // Your Twitch-specific logic here
  return null
}
```

## Tips

- Plugins run in a sandboxed environment for security
- Use `console.log()` for debugging (output goes to developer console)
- Plugins hot-reload when saved - no need to restart the app
- Test your plugins thoroughly before using in live streams
- Keep plugin names descriptive with the `// @name` comment

## Troubleshooting

### Plugin Not Working
- Check that the plugin is enabled in Settings → Plugins
- Look for errors in the plugin list (red error icon)
- Ensure the plugin exports a default function
- Check the JavaScript syntax

### Commands Not Responding
- Verify the channel is connected
- Check that you're authenticated
- Make sure the platform supports sending messages (Twitch/YouTube do, others may not)

### Performance Issues
- Avoid complex operations in plugins
- Don't use external APIs or file system access
- Keep plugin logic simple and fast

## Need Help?

If you need help creating a plugin, copy the content of `docs/plugins/PLUGIN_GUIDE_FOR_AI.md` and paste it into an AI assistant like Claude, ChatGPT, or Gemini, then describe what you want your plugin to do.