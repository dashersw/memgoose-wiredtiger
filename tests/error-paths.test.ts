import { describe, it, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { WiredTigerConnection } from '../src/connection'
import * as fs from 'fs'
import * as path from 'path'

describe('Error Paths and Edge Cases', () => {
  const testDbPath = path.join(__dirname, 'test-db-errors')
  let conn: WiredTigerConnection

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true })
    }
    fs.mkdirSync(testDbPath, { recursive: true })
  })

  afterEach(() => {
    try {
      conn?.close()
    } catch {
      // Ignore
    }
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true })
    }
  })

  it('should call getRawKey and getRawValue', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    const cursor = session.openCursor('test')

    cursor.set('key1', 'value1')
    cursor.insert()

    // Search to position cursor
    cursor.search('key1')

    // Call getRawKey and getRawValue
    const rawKey = cursor.getRawKey()
    const rawValue = cursor.getRawValue()

    assert.ok(rawKey !== null)
    assert.ok(rawValue !== null)

    cursor.close()
    session.close()
  })

  it('should use createIndex method', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()

    // Create table with columns for indexing
    session.createTable('indexed', 'key_format=S,value_format=S,columns=(id,data)')

    // Create an index on the data column
    assert.doesNotThrow(() => {
      session.createIndex('index:indexed:data_idx', 'columns=(data)')
    })

    session.close()
  })

  it('should handle loadExtension with config', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    // Try to load a non-existent extension with config
    try {
      conn.loadExtension('/fake/ext.so', 'entry=init')
      assert.fail('Should have thrown an error')
    } catch (error: any) {
      assert.ok(error.message.includes('Failed to load extension'))
    }
  })

  it('should handle close with open sessions', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    // Open multiple sessions but don't close them
    const session1 = conn.openSession()
    const session2 = conn.openSession()
    const session3 = conn.openSession()

    // Connection.close() should handle cleanup of all sessions
    assert.doesNotThrow(() => {
      conn.close()
    })
  })

  it('should handle session.close() multiple times', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()

    // First close
    session.close()

    // Second close should be safe (line 56 check: if (!this.session) return)
    assert.doesNotThrow(() => {
      session.close()
    })
  })

  it('should use openCursor with just table name', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('simple', 'key_format=u,value_format=u')

    // This uses the simple openCursor path (not openCursorWithConfig)
    const cursor1 = session.openCursor('simple')
    assert.ok(cursor1)

    cursor1.close()
    session.close()
  })

  it('should use openCursorWithConfig without config parameter', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    // Call without config to test the optional parameter path
    const cursor = session.openCursorWithConfig('table:test')
    assert.ok(cursor)

    cursor.close()
    session.close()
  })

  it('should handle searchNear with exact match', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    const cursor = session.openCursor('test')

    cursor.set('key1', 'value1')
    cursor.insert()

    // Search near for exact key
    const buffer = new Uint8Array(Buffer.from('key1')).buffer
    const result = cursor.searchNear(buffer)

    assert.ok(result !== null)
    assert.strictEqual(result.exact, 0) // Exact match

    cursor.close()
    session.close()
  })

  it('should cover prev when cursor is at beginning', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    const cursor = session.openCursor('test')

    cursor.set('key1', 'value1')
    cursor.insert()

    cursor.reset()
    cursor.next()

    // Now try prev - should return null at beginning
    const result = cursor.prev()
    assert.strictEqual(result, null)

    cursor.close()
    session.close()
  })

  it('should handle get() when cursor not positioned', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    const cursor = session.openCursor('test')

    cursor.set('key1', 'value1')
    cursor.insert()

    cursor.reset()

    // Try get() without positioning cursor
    const result = cursor.get()
    // May return null or throw depending on WiredTiger behavior
    assert.ok(result === null || typeof result === 'object')

    cursor.close()
    session.close()
  })
})
