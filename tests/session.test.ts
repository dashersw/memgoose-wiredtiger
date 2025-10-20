import { describe, it, beforeEach, afterEach } from 'node:test'
import * as assert from 'node:assert'
import { WiredTigerConnection } from '../src/connection'
import * as fs from 'fs'
import * as path from 'path'

describe('WiredTigerSession', () => {
  const testDbPath = path.join(__dirname, 'test-db-session')
  let conn: WiredTigerConnection

  beforeEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true })
    }
    fs.mkdirSync(testDbPath, { recursive: true })
    conn = new WiredTigerConnection()
    conn.open(testDbPath, 'create')
  })

  afterEach(() => {
    try {
      conn?.close()
    } catch {
      // Ignore errors if already closed
    }
    if (fs.existsSync(testDbPath)) {
      fs.rmSync(testDbPath, { recursive: true, force: true })
    }
  })

  it('should create a table', () => {
    const session = conn.openSession()
    assert.doesNotThrow(() => {
      session.createTable('test', 'key_format=u,value_format=u')
    })
    session.close()
  })

  it('should open a cursor', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    const cursor = session.openCursor('test')
    assert.ok(cursor)
    cursor.close()
    session.close()
  })

  it('should begin and commit transaction', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    assert.doesNotThrow(() => {
      session.beginTransaction()
      session.commitTransaction()
    })
    session.close()
  })

  it('should begin and rollback transaction', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    assert.doesNotThrow(() => {
      session.beginTransaction()
      session.rollbackTransaction()
    })
    session.close()
  })

  it('should drop a table', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    assert.doesNotThrow(() => {
      session.drop('table:test')
    })
    session.close()
  })

  it('should compact a table', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    // Insert some data first
    const cursor = session.openCursor('test')
    cursor.set('key1', 'value1')
    cursor.insert()
    cursor.close()

    assert.doesNotThrow(() => {
      session.compact('table:test')
    })
    session.close()
  })

  it('should close session', () => {
    const session = conn.openSession()
    assert.doesNotThrow(() => {
      session.close()
    })
  })

  it('should create table with default config', () => {
    const session = conn.openSession()
    // No config parameter - uses defaults
    assert.doesNotThrow(() => {
      session.createTable('defaults')
    })
    session.close()
  })

  it('should begin transaction with default config', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    assert.doesNotThrow(() => {
      session.beginTransaction() // No config
      session.commitTransaction() // No config
    })
    session.close()
  })

  it('should rollback transaction with default config', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    session.beginTransaction()
    assert.doesNotThrow(() => {
      session.rollbackTransaction() // No config
    })
    session.close()
  })

  it('should drop table with default config', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    assert.doesNotThrow(() => {
      session.drop('table:test') // No config
    })
    session.close()
  })

  it('should compact table with default config', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')
    const cursor = session.openCursor('test')
    cursor.set('k', 'v')
    cursor.insert()
    cursor.close()

    assert.doesNotThrow(() => {
      session.compact('table:test') // No config
    })
    session.close()
  })

  it('should create index on table', () => {
    const session = conn.openSession()
    session.createTable('indexed', 'key_format=S,value_format=S,columns=(id,data)')

    assert.doesNotThrow(() => {
      session.createIndex('index:indexed:data_idx', 'columns=(data)')
    })
    session.close()
  })

  it('should handle openCursorWithConfig without config param', () => {
    const session = conn.openSession()
    session.createTable('test', 'key_format=u,value_format=u')

    // Call without optional config
    const cursor = session.openCursorWithConfig('table:test')
    assert.ok(cursor)
    cursor.close()
    session.close()
  })

  it('should reject invalid session objects', () => {
    // Test the error path when session doesn't have native pointer
    // This covers lines 10-11 in session.ts
    const { WiredTigerSession } = require('../src/session')

    // Try to create a session with an invalid object (no __nativeSessionPtr)
    assert.throws(
      () => new WiredTigerSession({}, () => {}),
      {
        message: /Invalid WiredTiger session: native identifier missing/
      },
      'Should throw error for invalid session object'
    )

    // Also test with null
    assert.throws(
      () => new WiredTigerSession(null, () => {}),
      {
        message: /Invalid WiredTiger session: native identifier missing/
      },
      'Should throw error for null session'
    )

    // Also test with undefined
    assert.throws(
      () => new WiredTigerSession(undefined, () => {}),
      {
        message: /Invalid WiredTiger session: native identifier missing/
      },
      'Should throw error for undefined session'
    )
  })
})
