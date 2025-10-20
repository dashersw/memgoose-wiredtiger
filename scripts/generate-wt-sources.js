#!/usr/bin/env node

/**
 * Scans WiredTiger source tree and updates binding.gyp with the source list.
 * Run this after upgrading the WiredTiger submodule to a new version.
 */

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', 'lib', 'wiredtiger', 'src')
const sources = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (entry.isFile()) {
      if (/\.(c|cc|cpp|cxx)$/.test(entry.name)) {
        sources.push(path.relative(process.cwd(), full).split(path.sep).join('/'))
      }
    }
  }
}

walk(root)

// Filter out architecture-specific and platform-specific files
const filtered = sources.filter(s => {
  // Exclude architecture-specific checksum files except software
  if (s.includes('/checksum/') && !s.includes('/software/')) return false
  // Exclude ALL platform-specific os_ directories (os_posix, os_win, os_darwin, os_linux)
  // These are added conditionally in binding.gyp based on target OS
  if (s.includes('/os_posix/') || s.includes('/os_win/') || s.includes('/os_darwin/') || s.includes('/os_linux/'))
    return false
  // Exclude MSan-only wrapper (requires memory sanitizer build flags)
  if (s.includes('msan_fstat_suppression_wrappers.c')) return false
  return true
})

// Add our binding first
filtered.unshift('src/wiredtiger_binding.cc')

// Read current binding.gyp
const bindingPath = path.resolve(__dirname, '..', 'binding.gyp')
let binding = fs.readFileSync(bindingPath, 'utf8')

// Find and replace the sources section
const sourcesStart = binding.indexOf('"sources": [')
const sourcesEnd = binding.indexOf('],', sourcesStart)

if (sourcesStart === -1 || sourcesEnd === -1) {
  console.error('Could not find sources section in binding.gyp')
  process.exit(1)
}

const before = binding.substring(0, sourcesStart)
const after = binding.substring(sourcesEnd + 1)

const newSources = '"sources": [\n        "' + filtered.join('",\n        "') + '"\n      ]'

const newBinding = before + newSources + after
fs.writeFileSync(bindingPath, newBinding)

console.log(`✅ Updated binding.gyp with ${filtered.length} sources`)
console.log(`   - Total WiredTiger C files: ${sources.length}`)
console.log(`   - Excluded platform-specific: ${sources.length - filtered.length + 1}`)
