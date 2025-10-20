#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const templatePath = path.resolve(__dirname, '..', 'lib', 'wiredtiger', 'src', 'include', 'wiredtiger.in')
const outputPath = path.resolve(__dirname, '..', 'lib', 'wiredtiger', 'config', 'wiredtiger.h')

let template = fs.readFileSync(templatePath, 'utf8')

// Version from WiredTiger
const VERSION_MAJOR = '11'
const VERSION_MINOR = '3'
const VERSION_PATCH = '1'
const VERSION_STRING = `"${VERSION_MAJOR}.${VERSION_MINOR}.${VERSION_PATCH}"`

// Substitute version placeholders
template = template.replace(/@VERSION_MAJOR@/g, VERSION_MAJOR)
template = template.replace(/@VERSION_MINOR@/g, VERSION_MINOR)
template = template.replace(/@VERSION_PATCH@/g, VERSION_PATCH)
template = template.replace(/@VERSION_STRING@/g, VERSION_STRING)

// Required includes for POSIX/macOS/Linux
template = template.replace(
  /@wiredtiger_includes_decl@/g,
  `#include <sys/types.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>`
)

// Type declarations for portable types
template = template.replace(/@off_t_decl@/g, 'typedef off_t wt_off_t;')
template = template.replace(/@uintmax_t_decl@/g, '/* uintmax_t from stdint.h */')
template = template.replace(/@uintptr_t_decl@/g, '/* uintptr_t from stdint.h */')

fs.writeFileSync(outputPath, template)

console.log(`Generated ${outputPath}`)
