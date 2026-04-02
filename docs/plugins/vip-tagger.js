// @name VIP Tagger
// Adds a purple "VIP" tag to messages from a configured list of users.
// Edit the VIP_USERS set below to add or remove users (lowercase login names).

const VIP_USERS = new Set([
  'alice',
  'bob',
  'slopo_master',
])

export default function vipTagger(msg) {
  if (VIP_USERS.has(msg.author.toLowerCase())) {
    return { type: 'tag', label: 'VIP', color: '#a78bfa' }
  }
  return null
}
