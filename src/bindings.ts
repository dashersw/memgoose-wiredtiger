// Dynamically load WiredTiger native bindings
import * as path from 'path'
import * as fs from 'fs'

let nativeBindings: any = null

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  // Try multiple paths to handle different installation scenarios
  const possiblePaths = [
    // When running from installed package (dist/)
    path.join(__dirname, '../build/Release/wiredtiger_native.node'),
    // When running from source with tsx (src/)
    path.join(__dirname, '../build/Release/wiredtiger_native.node'),
    // When installed as node_modules package
    path.join(__dirname, '../../build/Release/wiredtiger_native.node')
  ]

  let bindingPath: string | null = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      bindingPath = p
      break
    }
  }

  if (bindingPath) {
    nativeBindings = require(bindingPath)
  } else {
    nativeBindings = null
  }
} catch {
  // Will throw a better error message in constructor if user tries to use WiredTiger without building it
  nativeBindings = null
}

export { nativeBindings }
