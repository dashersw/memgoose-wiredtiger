import { describe, it, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { WiredTigerConnection } from '../src/connection'
import { WiredTigerSession } from '../src/session'
import { WiredTigerCursor } from '../src/cursor'
import * as fs from 'fs'
import * as path from 'path'

describe('WiredTigerCursor', () => {
  const testDbPath = path.join(__dirname, 'test-db-cursor')
  let conn: WiredTigerConnection
  let session: WiredTigerSession
  let cursor: WiredTigerCursor

  beforeEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true })
    }
    fs.mkdirSync(testDbPath, { recursive: true })

    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')
    session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    cursor = session.openCursor('test')
  })

  afterEach(() => {
    try {
      cursor?.close()
      session?.close()
      conn?.close()
    } catch {
      // Ignore errors if already closed
    }
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true })
    }
  })

  it('should insert a record', () => {
    assert.doesNotThrow(() => {
      cursor.set('key1', 'value1')
      cursor.insert()
    })
  })

  it('should search for a record', () => {
    cursor.set('key1', 'value1')
    cursor.insert()

    const value = cursor.search('key1')
    assert.strictEqual(value, 'value1')
  })

  it('should return null for non-existent key', () => {
    const value = cursor.search('nonexistent')
    assert.strictEqual(value, null)
  })

  it('should update a record', () => {
    cursor.set('key1', 'value1')
    cursor.insert()

    cursor.set('key1', 'updated')
    cursor.update()

    const value = cursor.search('key1')
    assert.strictEqual(value, 'updated')
  })

  it('should remove a record', () => {
    cursor.set('key1', 'value1')
    cursor.insert()

    cursor.search('key1')
    cursor.remove()

    const value = cursor.search('key1')
    assert.strictEqual(value, null)
  })

  it('should iterate with next()', () => {
    cursor.set('key1', 'value1')
    cursor.insert()
    cursor.set('key2', 'value2')
    cursor.insert()
    cursor.set('key3', 'value3')
    cursor.insert()

    cursor.reset()

    const result1 = cursor.next()
    assert.ok(result1)
    assert.strictEqual(result1.key, 'key1')
    assert.strictEqual(result1.value, 'value1')

    const result2 = cursor.next()
    assert.ok(result2)
    assert.strictEqual(result2.key, 'key2')

    const result3 = cursor.next()
    assert.ok(result3)
    assert.strictEqual(result3.key, 'key3')

    const result4 = cursor.next()
    assert.strictEqual(result4, null)
  })

  it('should iterate with prev()', () => {
    cursor.set('key1', 'value1')
    cursor.insert()
    cursor.set('key2', 'value2')
    cursor.insert()

    cursor.reset()
    cursor.next()
    cursor.next()

    const result = cursor.prev()
    assert.ok(result)
    assert.strictEqual(result.key, 'key1')
  })

  it('should reset cursor', () => {
    cursor.set('key1', 'value1')
    cursor.insert()

    cursor.next()

    assert.doesNotThrow(() => {
      cursor.reset()
    })
  })

  it('should handle multiple inserts', () => {
    for (let i = 0; i < 100; i++) {
      cursor.set(`key${i}`, `value${i}`)
      cursor.insert()
    }

    cursor.reset()
    let count = 0
    let result = cursor.next()
    while (result) {
      count++
      result = cursor.next()
    }

    assert.strictEqual(count, 100)
  })

  it('should handle transactions', () => {
    session.beginTransaction()

    cursor.set('txn-key', 'txn-value')
    cursor.insert()

    session.commitTransaction()

    const value = cursor.search('txn-key')
    assert.strictEqual(value, 'txn-value')
  })

  it('should rollback transactions', () => {
    cursor.set('before', 'value')
    cursor.insert()

    session.beginTransaction()
    cursor.set('txn-key', 'txn-value')
    cursor.insert()
    session.rollbackTransaction()

    // The txn-key should not exist after rollback
    const value = cursor.search('txn-key')
    assert.strictEqual(value, null)

    // But 'before' should still exist
    const beforeValue = cursor.search('before')
    assert.strictEqual(beforeValue, 'value')
  })

  it('should close cursor', () => {
    assert.doesNotThrow(() => {
      cursor.close()
    })
  })

  it('should handle get() at different cursor positions', () => {
    cursor.set('k1', 'v1')
    cursor.insert()
    cursor.set('k2', 'v2')
    cursor.insert()

    // Position at first record
    cursor.reset()
    cursor.next()

    const result = cursor.get()
    assert.ok(result)
    assert.strictEqual(result.key, 'k1')
    assert.strictEqual(result.value, 'v1')
  })

  it('should handle prev() on empty cursor', () => {
    cursor.reset()
    const result = cursor.prev()
    assert.strictEqual(result, null)
  })

  it('should handle next() returning null at end', () => {
    cursor.set('k1', 'v1')
    cursor.insert()

    cursor.reset()
    cursor.next() // Position at k1
    const result = cursor.next() // Try to move past end
    assert.strictEqual(result, null)
  })
})
