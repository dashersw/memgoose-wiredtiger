// Standalone WiredTiger test - no memgoose
import { WiredTigerConnection } from 'memgoose-wiredtiger'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, 'data')

// Ensure directory exists
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true })
}

console.log('🔧 WiredTiger Standalone Example\n')

try {
  console.log('1. Creating connection...')
  const conn = new WiredTigerConnection()
  console.log('   ✓ Connection created')

  console.log('2. Opening database...')
  console.log('   Path:', dataPath)
  conn.open(dataPath, 'create')
  console.log('   ✓ Database opened')

  console.log('3. Opening session...')
  const session = conn.openSession()
  console.log('   ✓ Session opened')

  console.log('4. Creating table...')
  session.createTable('test', 'key_format=u,value_format=u')
  console.log('   ✓ Table created')

  console.log('5. Opening cursor...')
  const cursor = session.openCursor('test')
  console.log('   ✓ Cursor opened')

  console.log('6. Inserting data...')
  cursor.set('key1', 'value1')
  cursor.insert()
  console.log('   ✓ Inserted key1=value1')

  console.log('7. Searching...')
  const found = cursor.search('key1')
  console.log('   ✓ Found:', found)

  console.log('8. Cleaning up...')
  cursor.close()
  session.close()
  conn.close()
  console.log('   ✓ Closed')

  console.log('\n✅ All tests passed!')
} catch (error) {
  console.error('\n❌ Error:', error.message)
  if (error.stack) console.error(error.stack)
  process.exit(1)
}
