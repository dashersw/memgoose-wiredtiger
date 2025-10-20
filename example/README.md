# Examples

This directory contains two working examples demonstrating WiredTiger usage.

## Examples

### 1. Standalone (`standalone/`)

Direct usage of WiredTiger native bindings without memgoose.

```bash
cd standalone
npm install
npm start
```

**What it demonstrates:**

- Creating connections
- Opening sessions
- Creating tables & cursors
- Inserting and retrieving data
- Proper cleanup

### 2. With Memgoose (`with-memgoose/`)

Full memgoose integration with WiredTiger storage backend.

```bash
cd with-memgoose
npm install
npm start
```

**What it demonstrates:**

- Connecting with WiredTiger storage
- Schema definitions with indexes and virtuals
- MongoDB-like queries ($gte, $inc, etc.)
- Full CRUD operations
- Async/await API
- Automatic persistence

## Quick Start

To run both examples:

```bash
# Standalone
cd standalone && npm install && npm start && cd ..

# With Memgoose
cd with-memgoose && npm install && npm start
```

## Requirements

Both examples require the parent package to be built:

```bash
# From repository root
npm install
```

This builds the WiredTiger library and Node.js bindings.
