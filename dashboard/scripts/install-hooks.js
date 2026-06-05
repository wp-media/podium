#!/usr/bin/env node
/**
 * Delegates to the canonical install.mjs at the plugin root.
 * This file is kept for backward compat (dashboard server calls it at startup).
 */

const { execFileSync } = require('child_process')
const path = require('path')

const installScript = path.resolve(__dirname, '..', '..', 'install.mjs')
const args = process.argv.slice(2)

try {
  execFileSync(process.execPath, [installScript, ...args], { stdio: 'inherit' })
} catch {
  process.exit(1)
}
