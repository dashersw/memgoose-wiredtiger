# memgoose-wiredtiger

WiredTiger storage backend for [memgoose](https://github.com/dashersw/memgoose) - the high-performance storage engine that powers MongoDB.

**Version:** WiredTiger 11.3.1
**Platforms:** macOS, Linux, Windows

## Installation

```bash
npm install memgoose-wiredtiger
```

### Prerequisites

- Node.js 16+ with N-API support
- CMake 3.10+
- C++ compiler (gcc, clang, or MSVC)
- Python 3 (for node-gyp)

**Platform-specific:**

- **macOS**: `xcode-select --install` + `brew install cmake`
- **Linux**: `sudo apt-get install build-essential cmake` (Ubuntu/Debian) or `sudo dnf install gcc-c++ make cmake` (Fedora/RHEL)
- **Windows**: [Visual Studio 2022](https://visualstudio.microsoft.com/downloads/) with C++ tools + [CMake](https://cmake.org/download/)

**Compression libraries (recommended):**

WiredTiger supports several compression algorithms. Install the ones you need:

- **macOS**: `brew install snappy zlib lz4 zstd`
- **Linux**: `sudo apt-get install libsnappy-dev zlib1g-dev liblz4-dev libzstd-dev` (Ubuntu/Debian) or `sudo dnf install snappy-devel zlib-devel lz4-devel libzstd-devel` (Fedora/RHEL)
- **Windows**: Libraries are typically bundled with vcpkg: `vcpkg install snappy zlib lz4 zstd`

> **Note:** After installing compression libraries, you must rebuild: `npm rebuild` or delete `lib/wiredtiger/build/` and reinstall.

## Usage

```typescript
import { connect } from 'memgoose'

const db = connect({
  storage: 'wiredtiger',
  wiredtiger: {
    dataPath: './data/wiredtiger',
    cacheSize: '500M'
  }
})
```

## Features

- **High Performance**: Optimized for both read and write-heavy workloads
- **ACID Transactions**: Full transactional support with durability guarantees
- **Efficient Storage**: Built-in compression and space reclamation
- **Scalability**: MVCC (Multi-Version Concurrency Control) for high concurrency
- **WAL Logging**: Write-Ahead Logging for crash recovery

## Configuration

```typescript
interface WiredTigerStorageOptions {
  dataPath: string // Directory where WiredTiger stores data
  cacheSize?: string // Cache size (e.g., "500M", "1G", "2G")
  // Default: "500M"
}
```

## Performance

WiredTiger provides excellent performance for production workloads:

- **Insert 10k docs**: ~58ms
- **Query (indexed)**: ~0.14ms
- **Bulk insert 100k**: ~520ms

See [memgoose performance docs](https://github.com/dashersw/memgoose/blob/main/docs/PERFORMANCE.md) for detailed benchmarks.

## Examples

Two complete working examples are provided:

### Standalone WiredTiger (`example/standalone/`)

Direct usage of WiredTiger bindings without memgoose:

```bash
cd example/standalone
npm install && npm start
```

### With Memgoose (`example/with-memgoose/`)

Full memgoose integration with WiredTiger storage:

```bash
cd example/with-memgoose
npm install && npm start
```

## Direct API Usage

You can also use the WiredTiger bindings directly without memgoose:

```typescript
import { WiredTigerConnection } from 'memgoose-wiredtiger'

const conn = new WiredTigerConnection()
conn.open('./data', 'create')

const session = conn.openSession()
session.createTable('users', 'key_format=u,value_format=u')

const cursor = session.openCursor('users')
cursor.set('key1', 'value1')
cursor.insert()

const value = cursor.search('key1')
console.log(value) // 'value1'

cursor.close()
session.close()
conn.close()
```

See `example/standalone/` for a complete working example.

## Build Details

This package uses a **cross-platform build process**:

1. **CMake** builds WiredTiger library (`libwiredtiger.dylib`/`.so`/`.dll`) with compression support
2. **node-gyp** compiles the N-API bindings and links against WiredTiger
3. Supports **macOS** (Clang), **Linux** (GCC), and **Windows** (MSVC)

All build scripts are pure Node.js - no bash required for Windows compatibility.

## Troubleshooting

**Build fails:**

- Ensure CMake is installed: `cmake --version`
- Check C++ compiler is available
- On Windows, use "Developer Command Prompt for VS 2022"

**Runtime error "WiredTiger native bindings not available":**

- Run `npm rebuild` to rebuild the native addon
- Check that `build/Release/wiredtiger_native.node` exists

**Database won't open:**

- Ensure the data directory exists and is writable
- Check no other process has the database open (WiredTiger uses file locks)

**Compression error ("unknown compressor 'snappy'"):**

This means WiredTiger was built without compression support. To fix:

1. Install compression libraries (see Prerequisites above)
2. Delete the build directory: `rm -rf lib/wiredtiger/build/`
3. Rebuild: `npm rebuild`

If you don't need compression, remove the compression option from your table config (e.g., remove `block_compressor=snappy`)

## License

This project (memgoose-wiredtiger bindings) is licensed under the MIT License.

### WiredTiger License

This package includes WiredTiger, which is dual-licensed under GPL v2 or GPL v3 (your choice):

- Copyright (c) 2014-present MongoDB, Inc.
- Copyright (c) 2008-2014 WiredTiger, Inc.

You may redistribute and/or modify WiredTiger under the terms of either the GNU General Public License version 2 or version 3 as published by the Free Software Foundation. See `lib/wiredtiger/LICENSE` for full details.

For commercial licensing options or technical support, contact MongoDB, Inc.
