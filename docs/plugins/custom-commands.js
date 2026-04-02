// @name Custom Commands
// Intercepts !commands typed by YOU in the chat input and sends a custom
// response instead. The original command is never sent to Twitch/YouTube/etc.
//
// How it works:
//   1. You type  !commands  and press Enter.
//   2. This plugin returns { type: 'command', respond: '...' }.
//   3. The app sends the `respond` text to chat instead.
//
// Add your own !commands below in the COMMANDS map.

const COMMANDS = {
  '!commands': '📋 Commands: !commands !so !discord',
  '!discord':  '💬 Join the Discord: discord.gg/YOUR_INVITE_HERE',
  '!socials':  '🔗 Follow me on Twitter: @yourhandle | TikTok: @yourhandle',
}

export default function customCommands(msg) {
  // Only fire on your own messages (remove the author check if you want
  // anyone to trigger these, but be careful in busy chats).
  const cmd = msg.text.trim().toLowerCase().split(' ')[0]
  const response = COMMANDS[cmd]
  if (response) {
    return { type: 'command', respond: response }
  }
  return null
}
