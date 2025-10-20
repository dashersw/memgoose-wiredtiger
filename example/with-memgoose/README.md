# Memgoose + WiredTiger Example

This example demonstrates using **memgoose** with the **WiredTiger storage backend**.

## What It Does

Shows the full memgoose API working with WiredTiger storage:

1. ✅ Connect with WiredTiger storage
2. ✅ Define schemas with types, validation, indexes
3. ✅ Use virtual properties
4. ✅ Insert multiple documents
5. ✅ Query with MongoDB-like operators ($gte, $gt, etc.)
6. ✅ Update with operators ($inc)
7. ✅ Count documents
8. ✅ Delete documents
9. ✅ Disconnect properly

## Prerequisites

Install Node.js 16+ and build tools for your platform.

## Running

```bash
npm install
npm start
```

## Output

You should see something like:

```
🚀 Memgoose + WiredTiger Example

1. Connecting to memgoose with WiredTiger storage...
   ✓ Connected
2. Defining User schema...
   ✓ Schema defined with index on age
3. Inserting users...
   ✓ Inserted 4 users
4. Querying users age >= 30...
   ✓ Found: [ 'Bob (35)', 'Charlie (42)', 'Diana (31)' ]
5. Finding user by email...
   ✓ Found: Alice (28)
6. Updating Bob's age...
   ✓ Bob is now 36
7. Counting documents...
   ✓ Total: 4, Over 40: 1
8. Deleting Charlie...
   ✓ Remaining users: 3
9. Listing all users...
   - Alice: alice@example.com (28)
   - Bob: bob@example.com (36)
   - Diana: diana@example.com (31)
10. Disconnecting...
    ✓ Disconnected

✅ Memgoose + WiredTiger example completed successfully!
```

## What's Different from Standalone?

This example uses the **full memgoose API**:

- Schema definitions
- Model creation via `db.model()`
- MongoDB-like queries
- Virtual properties
- Async/await operations
- Automatic persistence with WiredTiger

The standalone example (`example/standalone/`) uses the low-level WiredTiger bindings directly without memgoose.

## Learn More

- [Memgoose Documentation](https://github.com/dashersw/memgoose)
- [WiredTiger Storage Guide](https://github.com/dashersw/memgoose/blob/main/docs/WIREDTIGER.md)
