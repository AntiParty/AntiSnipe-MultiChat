/**
 * Cleans the dist/ directory before a new release build.
 * Removes installers, blockmaps, yml files, and unpacked folders
 * but leaves dist/ itself in place so electron-builder doesn't recreate it.
 *
 * Usage:  node scripts/clean-dist.mjs
 *   or add to package.json scripts and call via npm run clean
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

if (!fs.existsSync(dist)) {
  console.log('dist/ does not exist — nothing to clean.')
  process.exit(0)
}

const entries = fs.readdirSync(dist)
if (entries.length === 0) {
  console.log('dist/ is already empty.')
  process.exit(0)
}

const REMOVE_EXTENSIONS = new Set(['.exe', '.blockmap', '.yml', '.yaml', '.dmg', '.pkg', '.deb', '.AppImage', '.snap', '.rpm', '.zip'])
const REMOVE_DIR_PATTERNS = ['-unpacked', 'mac', 'mac-arm64', 'linux-unpacked']

let removed = 0

for (const entry of entries) {
  const full = path.join(dist, entry)
  const stat = fs.statSync(full)

  if (stat.isDirectory()) {
    if (REMOVE_DIR_PATTERNS.some(p => entry.includes(p))) {
      fs.rmSync(full, { recursive: true, force: true })
      console.log(`  removed dir  ${entry}`)
      removed++
    }
  } else {
    const ext = path.extname(entry).toLowerCase()
    if (REMOVE_EXTENSIONS.has(ext)) {
      fs.rmSync(full)
      console.log(`  removed file ${entry}`)
      removed++
    }
  }
}

if (removed === 0) {
  console.log('dist/ has no build artifacts to remove.')
} else {
  console.log(`\n✓ Cleaned ${removed} item(s) from dist/`)
}
