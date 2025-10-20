import { describe, it, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { WiredTigerConnection } from '../src/connection'
import * as fs from 'fs'
import * as path from 'path'

describe('Integration Tests', () => {
  const testDbPath = path.join(__dirname, 'test-db-integration')
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

  it('should perform complete CRUD workflow', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('users', 'key_format=u,value_format=u')
    const cursor = session.openCursor('users')

    // Create
    cursor.set('user:1', JSON.stringify({ name: 'Alice', age: 30 }))
    cursor.insert()

    cursor.set('user:2', JSON.stringify({ name: 'Bob', age: 25 }))
    cursor.insert()

    // Read
    const alice = cursor.search('user:1')
    assert.ok(alice)
    const aliceData = JSON.parse(alice)
    assert.strictEqual(aliceData.name, 'Alice')
    assert.strictEqual(aliceData.age, 30)

    // Update
    cursor.set('user:1', JSON.stringify({ name: 'Alice', age: 31 }))
    cursor.update()

    const updatedAlice = cursor.search('user:1')
    const updatedData = JSON.parse(updatedAlice!)
    assert.strictEqual(updatedData.age, 31)

    // Delete
    cursor.search('user:2')
    cursor.remove()

    const deletedBob = cursor.search('user:2')
    assert.strictEqual(deletedBob, null)

    // Verify Alice still exists
    const stillThere = cursor.search('user:1')
    assert.ok(stillThere)

    cursor.close()
    session.close()
  })

  it('should handle checkpoint and recovery', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('persistent', 'key_format=u,value_format=u')
    const cursor = session.openCursor('persistent')

    cursor.set('key1', 'value1')
    cursor.insert()

    cursor.close()
    session.close()

    // Create checkpoint
    conn.checkpoint()
    conn.close()

    // Reopen and verify data persisted
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const newSession = conn.openSession()
    const newCursor = newSession.openCursor('persistent')

    const value = newCursor.search('key1')
    assert.strictEqual(value, 'value1')

    newCursor.close()
    newSession.close()
  })

  it('should handle multiple tables', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()

    session.createTable('users', 'key_format=u,value_format=u')
    session.createTable('posts', 'key_format=u,value_format=u')

    const usersCursor = session.openCursor('users')
    const postsCursor = session.openCursor('posts')

    usersCursor.set('u1', 'Alice')
    usersCursor.insert()

    postsCursor.set('p1', 'Hello World')
    postsCursor.insert()

    assert.strictEqual(usersCursor.search('u1'), 'Alice')
    assert.strictEqual(postsCursor.search('p1'), 'Hello World')

    usersCursor.close()
    postsCursor.close()
    session.close()
  })

  it('should handle large datasets', () => {
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')

    const session = conn.openSession()
    session.createTable('large', 'key_format=u,value_format=u')
    const cursor = session.openCursor('large')

    const recordCount = 1000

    // Insert records
    for (let i = 0; i < recordCount; i++) {
      cursor.set(`key${i}`, `value${i}`)
      cursor.insert()
    }

    // Verify count via iteration
    cursor.reset()
    let count = 0
    let result = cursor.next()
    while (result) {
      count++
      result = cursor.next()
    }

    assert.strictEqual(count, recordCount)

    cursor.close()
    session.close()
  })
})
