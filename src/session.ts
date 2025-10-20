import { WiredTigerCursor } from './cursor'

export class WiredTigerSession {
  private session: any
  private readonly sessionId: string
  private readonly invalidate: (id: string) => void

  constructor(session: any, invalidate: (id: string) => void) {
    if (!session?.__nativeSessionPtr) {
      throw new Error('Invalid WiredTiger session: native identifier missing')
    }
    this.session = session
    this.sessionId = session.__nativeSessionPtr
    this.invalidate = invalidate
  }

  createTable(name: string, config?: string): void {
    this.session.createTable(name, config)
  }

  openCursor(tableName: string): WiredTigerCursor {
    const cursor = this.session.openCursor(tableName)
    return new WiredTigerCursor(cursor)
  }

  openCursorWithConfig(uri: string, config?: string): WiredTigerCursor {
    const cursor = this.session.openCursorWithConfig(uri, config)
    return new WiredTigerCursor(cursor)
  }

  beginTransaction(config?: string): void {
    this.session.beginTransaction(config)
  }

  commitTransaction(config?: string): void {
    this.session.commitTransaction(config)
  }

  rollbackTransaction(config?: string): void {
    this.session.rollbackTransaction(config)
  }

  createIndex(uri: string, config: string): void {
    this.session.createIndex(uri, config)
  }

  drop(uri: string, config?: string): void {
    this.session.drop(uri, config)
  }

  compact(uri: string, config?: string): void {
    this.session.compact(uri, config)
  }

  close(): void {
    if (!this.session) return
    this.session.close()
    this.invalidate(this.sessionId)
    this.session = null
  }
}
