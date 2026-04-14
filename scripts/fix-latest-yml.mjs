/**
 * Reads the actual .exe filename(s) from dist/ and rewrites latest.yml
 * so the filename references always match what was actually built.
 *
 * Runs automatically after every package:win via the postpackage:win script.
 * Can also be run manually: node scripts/fix-latest-yml.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ymlPath = path.join(dist, 'latest.yml')

if (!fs.existsSync(ymlPath)) {
  console.error('latest.yml not found in dist/ — run a Windows build first.')
  process.exit(1)
}

// Find the actual .exe in dist/ (exclude blockmaps)
const exeFiles = fs.readdirSync(dist).filter(f => f.endsWith('.exe'))
if (exeFiles.length === 0) {
  console.error('No .exe found in dist/ — nothing to fix.')
  process.exit(1)
}

// Pick the largest exe (the main installer, not any stub)
const mainExe = exeFiles
  .map(f => ({ name: f, size: fs.statSync(path.join(dist, f)).size }))
  .sort((a, b) => b.size - a.size)[0].name

let yml = fs.readFileSync(ymlPath, 'utf8')

// Extract the filename currently referenced in latest.yml
const urlMatch = yml.match(/^  - url: (.+)$/m)
const pathMatch = yml.match(/^path: (.+)$/m)

if (!urlMatch || !pathMatch) {
  console.error('latest.yml format not recognised — no url/path fields found.')
  process.exit(1)
}

const ymlExe = urlMatch[1].trim()

if (ymlExe === mainExe) {
  console.log(`✓ latest.yml already correct: ${mainExe}`)
  process.exit(0)
}

console.log(`Fixing latest.yml:`)
console.log(`  was: ${ymlExe}`)
console.log(`  now: ${mainExe}`)

// Replace all occurrences of the wrong filename (url, path, blockmap references)
yml = yml.replaceAll(ymlExe, mainExe)
// Fix blockmap reference too (same base + .blockmap suffix)
const wrongBlockmap = ymlExe + '.blockmap'
const rightBlockmap = mainExe + '.blockmap'
yml = yml.replaceAll(wrongBlockmap, rightBlockmap)

fs.writeFileSync(ymlPath, yml, 'utf8')
console.log(`✓ latest.yml updated — ${dist}/latest.yml`)