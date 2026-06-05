#!/usr/bin/env node
// podium/install.mjs
// Registers Podium hooks in the project's .claude/settings.json.
//
// Usage:
//   node install.mjs              -- registers hooks, prints status
//   node install.mjs --uninstall  -- removes Podium hooks
//   node install.mjs --check      -- exits 0 if installed, 1 if not
//   node install.mjs --global     -- target ~/.claude/settings.json

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Copy hook.mjs to a stable location that won't change between plugin updates.
// Registered path in settings.json must not depend on the plugin cache hash.
const STABLE_DIR = join(process.env.HOME ?? '~', '.claude', 'podium')
const STABLE_HOOK = join(STABLE_DIR, 'hook.mjs')
mkdirSync(STABLE_DIR, { recursive: true })
copyFileSync(resolve(join(__dirname, 'hook.mjs')), STABLE_HOOK)

const HOOK_PATH = STABLE_HOOK

const HOOK_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',   // turn boundaries — groups tool calls into reasoning turns
  'PreToolUse',         // every tool call start (Bash, Read, Write, Agent, …)
  'PostToolUse',        // every tool call end
  'PostToolUseFailure', // failed tool calls
  'SubagentStart',      // sub-agent identity enrichment
  'SubagentStop',
  'SessionEnd',
]

const PODIUM_MARKER = '.claude/podium/hook.mjs'

// Legacy markers from when Podium was embedded inside Maestro — cleaned up on install.
const LEGACY_MARKERS = [
  'hook-handler.js',
  'podium/dashboard/scripts',
]

// ── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const MODE = args.includes('--uninstall') ? 'uninstall'
  : args.includes('--check') ? 'check'
  : 'install'

// ── Find settings.json (project or global) ────────────────────────────────────
const projectSettings = join(process.cwd(), '.claude', 'settings.json')
const globalSettings  = join(process.env.HOME ?? '~', '.claude', 'settings.json')
const SETTINGS_PATH   = args.includes('--global') ? globalSettings : projectSettings

// ── Read existing settings ────────────────────────────────────────────────────
let settings = {}
if (existsSync(SETTINGS_PATH)) {
  try { settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) }
  catch { console.error(`Cannot parse ${SETTINGS_PATH}`); process.exit(1) }
}

// ── Check if already installed ────────────────────────────────────────────────
function isInstalled(settings) {
  if (!settings.hooks) return false
  return HOOK_EVENTS.some((evt) => {
    const entries = settings.hooks[evt]
    if (!Array.isArray(entries)) return false
    return entries.some((e) =>
      Array.isArray(e.hooks) &&
      e.hooks.some((h) => typeof h.command === 'string' && h.command.includes(PODIUM_MARKER))
    )
  })
}

if (MODE === 'check') {
  const installed = isInstalled(settings)
  console.log(installed ? 'Podium hooks: installed' : 'Podium hooks: not installed')
  process.exit(installed ? 0 : 1)
}

if (MODE === 'uninstall') {
  if (!settings.hooks) { console.log('Nothing to uninstall.'); process.exit(0) }
  const allMarkers = [PODIUM_MARKER, ...LEGACY_MARKERS]
  let removed = 0
  for (const evt of HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[evt])) continue
    const before = settings.hooks[evt].length
    settings.hooks[evt] = settings.hooks[evt].filter((e) =>
      !(Array.isArray(e.hooks) &&
        e.hooks.some((h) =>
          typeof h.command === 'string' &&
          allMarkers.some((m) => h.command.includes(m))
        ))
    )
    removed += before - settings.hooks[evt].length
  }
  writeSettingsFile(settings)
  console.log(`Podium hooks removed (${removed} entries). Restart Claude Code to apply.`)
  process.exit(0)
}

// ── Install ───────────────────────────────────────────────────────────────────
if (!settings.hooks) settings.hooks = {}

// Remove any legacy hooks from the old Maestro-embedded Podium path.
let cleaned = 0
for (const evt of HOOK_EVENTS) {
  if (!Array.isArray(settings.hooks[evt])) continue
  const before = settings.hooks[evt].length
  settings.hooks[evt] = settings.hooks[evt].filter((e) =>
    !(Array.isArray(e.hooks) &&
      e.hooks.some((h) =>
        typeof h.command === 'string' &&
        LEGACY_MARKERS.some((m) => h.command.includes(m))
      ))
  )
  cleaned += before - settings.hooks[evt].length
}
if (cleaned > 0) {
  console.log(`  Removed ${cleaned} legacy Podium hook(s) from old Maestro path.`)
}

let added = 0
for (const evt of HOOK_EVENTS) {
  if (!settings.hooks[evt]) settings.hooks[evt] = []

  // Skip if already registered for this event
  const already = settings.hooks[evt].some((e) =>
    Array.isArray(e.hooks) &&
    e.hooks.some((h) => typeof h.command === 'string' && h.command.includes(PODIUM_MARKER))
  )
  if (already) continue

  settings.hooks[evt].push({
    hooks: [{
      type: 'command',
      command: `node "${HOOK_PATH}"`,
      timeout: 2,
    }],
  })
  added++
}

if (added === 0) {
  console.log(`Podium hooks already installed in ${SETTINGS_PATH}`)
  process.exit(0)
}

writeSettingsFile(settings)
console.log(`✓ Podium hooks installed (${added} events) in ${SETTINGS_PATH}`)
console.log('  Restart Claude Code to activate.')

// ── Helpers ───────────────────────────────────────────────────────────────────
function writeSettingsFile(data) {
  const dir = join(SETTINGS_PATH, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2) + '\n')
}
