import { nativeBindings } from './bindings'
import { WiredTigerSession } from './session'
import * as pathModule from 'path'
import * as fs from 'fs'

export class WiredTigerConnection {
  private connection: any
  private readonly activeSessions: Set<string>

  constructor() {
    if (!nativeBindings) {
      throw new Error(
        'WiredTiger native bindings not available. You need to build the native addon first.\n' +
          'Run: npm install\n' +
          'This will compile the WiredTiger bindings.\n' +
          'Or use a different storage strategy (memory, file, or sqlite).'
      )
    }
    this.connection = new nativeBindings.WiredTigerConnection()
    this.activeSessions = new Set<string>()
  }

  open(path: string, config?: string): void {
    this.connection.open(path, config)
    this.loadCompressionExtensions()
  }

  private loadCompressionExtensions(): void {
    // Find the WiredTiger build directory
    const buildDir = pathModule.join(__dirname, '..', 'lib', 'wiredtiger', 'build')
    const extDir = pathModule.join(buildDir, 'ext', 'compressors')

    if (!fs.existsSync(extDir)) {
      return // Extensions not built, skip
    }

    // Try to load each compression extension
    const compressionLibs = ['snappy', 'zlib', 'lz4', 'zstd']
    const platform = process.platform
    // CMake MODULE type creates .so files even on macOS
    const libExt = platform === 'win32' ? '.dll' : '.so'

    for (const compressor of compressionLibs) {
      const libPath = pathModule.join(extDir, compressor, `libwiredtiger_${compressor}${libExt}`)

      if (fs.existsSync(libPath)) {
        try {
          this.connection.loadExtension(libPath)
        } catch (err) {
          // Silently fail - compression is optional
          // The error will surface when user tries to use compression
        }
      }
    }
  }

  openSession(): WiredTigerSession {
    const session = this.connection.openSession()
    if (!session?.__nativeSessionPtr) {
      throw new Error('WiredTiger session missing native pointer identifier')
    }
    const id = session.__nativeSessionPtr as string
    this.activeSessions.add(id)
    return new WiredTigerSession(session, sessionId => {
      if (this.activeSessions.has(sessionId)) {
        this.activeSessions.delete(sessionId)
      }
      this.connection.releaseSession(sessionId)
    })
  }

  checkpoint(): void {
    this.connection.checkpoint()
  }

  loadExtension(path: string, config?: string): void {
    this.connection.loadExtension(path, config)
  }

  close(): void {
    for (const sessionId of Array.from(this.activeSessions)) {
      this.activeSessions.delete(sessionId)
      this.connection.releaseSession(sessionId)
    }
    this.connection.close()
  }
}
