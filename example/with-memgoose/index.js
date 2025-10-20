// Memgoose with WiredTiger storage example
import { connect, Schema } from 'memgoose'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, 'data')

console.log('🚀 Memgoose + WiredTiger Example\n')

try {
  // Connect with WiredTiger storage
  console.log('1. Connecting to memgoose with WiredTiger storage...')
  const db = connect({
    storage: 'wiredtiger',
    wiredtiger: {
      dataPath,
      cacheSize: '100M'
    }
  })
  console.log('   ✓ Connected')

  // Define schema
  console.log('2. Defining User schema...')
  const userSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    age: { type: Number, required: true }
  })

  // Add index
  userSchema.index('age')

  // Add virtual
  userSchema.virtual('info').get(doc => `${doc.name} (${doc.age})`)

  const User = db.model('User', userSchema)
  console.log('   ✓ Schema defined with index on age')

  // Insert documents
  console.log('3. Inserting users...')
  await User.insertMany([
    { name: 'Alice', email: 'alice@example.com', age: 28 },
    { name: 'Bob', email: 'bob@example.com', age: 35 },
    { name: 'Charlie', email: 'charlie@example.com', age: 42 },
    { name: 'Diana', email: 'diana@example.com', age: 31 }
  ])
  console.log('   ✓ Inserted 4 users')

  // Query documents
  console.log('4. Querying users age >= 30...')
  const adults = await User.find({ age: { $gte: 30 } })
  console.log(
    '   ✓ Found:',
    adults.map(u => `${u.name} (${u.age})`)
  )

  // Find one
  console.log('5. Finding user by email...')
  const alice = await User.findOne({ email: 'alice@example.com' })
  console.log('   ✓ Found:', alice.info) // Uses virtual

  // Update
  console.log("6. Updating Bob's age...")
  await User.updateOne({ name: 'Bob' }, { $inc: { age: 1 } })
  const bob = await User.findOne({ name: 'Bob' })
  console.log('   ✓ Bob is now', bob.age)

  // Count
  console.log('7. Counting documents...')
  const total = await User.countDocuments()
  const over40 = await User.countDocuments({ age: { $gt: 40 } })
  console.log(`   ✓ Total: ${total}, Over 40: ${over40}`)

  // Delete
  console.log('8. Deleting Charlie...')
  await User.deleteOne({ name: 'Charlie' })
  const remaining = await User.countDocuments()
  console.log('   ✓ Remaining users:', remaining)

  // List all
  console.log('9. Listing all users...')
  const allUsers = await User.find()
  allUsers.forEach(user => {
    console.log(`   - ${user.name}: ${user.email} (${user.age})`)
  })

  // Disconnect
  console.log('10. Disconnecting...')
  await db.disconnect()
  console.log('    ✓ Disconnected')

  console.log('\n✅ Memgoose + WiredTiger example completed successfully!')
  console.log('\n📊 Database stored in:', dataPath)
  console.log('💡 Using WiredTiger storage with ACID transactions and compression')
} catch (error) {
  console.error('\n❌ Error:', error.message)
  if (error.stack) console.error(error.stack)
  process.exit(1)
}
