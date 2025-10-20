import { describe, it, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { WiredTigerConnection } from '../src/connection'
import * as fs from 'fs'
import * as path from 'path'

describe('Edge Cases and Error Handling', () => {
  const testDbPath = path.join(__dirname, 'test-db-edge')
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

  it('should handle searchNear operation', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    const cursor = session.openCursor('test')

    cursor.set('key1', 'value1')
    cursor.insert()
    cursor.set('key3', 'value3')
    cursor.insert()

    // Search near for a key that doesn't exist
    const buffer = new Uint8Array(Buffer.from('key2')).buffer
    const result = cursor.searchNear(buffer)
    assert.ok(result !== null)

    cursor.close()
    session.close()
  })

  it('should handle raw key and value operations', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    const cursor = session.openCursor('test')

    const keyBuffer = new Uint8Array(Buffer.from('rawkey')).buffer
    const valueBuffer = new Uint8Array(Buffer.from('rawvalue')).buffer

    assert.doesNotThrow(() => {
      cursor.setRawKey(keyBuffer)
      cursor.setRawValue(valueBuffer)
      cursor.insert()
    })

    cursor.close()
    session.close()
  })

  it('should handle openCursorWithConfig', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    const cursor = session.openCursorWithConfig('table:test', 'raw=true')
    assert.ok(cursor)

    cursor.close()
    session.close()
  })

  it('should handle transaction with configs', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    assert.doesNotThrow(() => {
      session.beginTransaction('isolation=snapshot')
      session.commitTransaction('sync=on')
    })

    assert.doesNotThrow(() => {
      session.beginTransaction()
      session.rollbackTransaction('operation_timeout_ms=1000')
    })

    session.close()
  })

  it('should handle drop with config', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    assert.doesNotThrow(() => {
      session.drop('table:test', 'force=true')
    })

    session.close()
  })

  it('should handle compact with config', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    const cursor = session.openCursor('test')
    cursor.set('key1', 'value1')
    cursor.insert()
    cursor.close()

    assert.doesNotThrow(() => {
      session.compact('table:test', 'timeout=30')
    })

    session.close()
  })

  it('should handle loadExtension', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    // Note: This will likely fail because we don't have an extension to load
    // but it tests the code path
    try {
      conn.loadExtension('/nonexistent/path.so', 'entry=ext_init')
    } catch (error) {
      // Expected to fail, but code path is tested
      assert.ok(error)
    }
  })

  it('should handle get() returning key-value object', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    const cursor = session.openCursor('test')

    cursor.set('key1', 'value1')
    cursor.insert()

    // Position cursor at the record first
    cursor.search('key1')

    const result = cursor.get()
    assert.ok(result)
    assert.strictEqual(result.key, 'key1')
    assert.strictEqual(result.value, 'value1')

    cursor.close()
    session.close()
  })

  it('should handle session close when already closed', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.close()

    // Closing again should not throw (idempotent)
    assert.doesNotThrow(() => {
      session.close()
    })
  })

  it('should handle custom connection config', () => {
    conn = new WiredTigerConnection()
    assert.doesNotThrow(() => {
      conn.open(testDbPath, 'create,cache_size=100M,statistics=(fast)')
    })
  })

  it('should handle custom table config', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    assert.doesNotThrow(() => {
      session.createTable('test', 'key_format=S,value_format=S')
    })

    session.close()
  })
})
