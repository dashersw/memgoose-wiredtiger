#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const wtPath = path.join(__dirname, '..', 'lib', 'wiredtiger')
const buildPath = path.join(wtPath, 'build')

// Check if WiredTiger source exists
if (!fs.existsSync(wtPath)) {
  console.error('Error: WiredTiger source not found in lib/wiredtiger')
  process.exit(1)
}

// Check if already built
const isWin = process.platform === 'win32'
const libName = isWin ? 'wiredtiger.dll' : process.platform === 'darwin' ? 'libwiredtiger.dylib' : 'libwiredtiger.so'
const libPath = isWin ? path.join(buildPath, 'Release', libName) : path.join(buildPath, libName)

if (fs.existsSync(libPath)) {
  console.log('WiredTiger already built')
  process.exit(0)
}

console.log('Building WiredTiger...')

// Create build directory
if (!fs.existsSync(buildPath)) {
  fs.mkdirSync(buildPath, { recursive: true })
}

// Patch CMakeLists.txt to skip test/bench/examples/tools that aren't in npm package
const cmakeFile = path.join(wtPath, 'CMakeLists.txt')
let cmakeContent = fs.readFileSync(cmakeFile, 'utf8')
if (!cmakeContent.includes('# NPM_PATCHED')) {
  console.log('Patching CMakeLists.txt to skip missing directories...')
  cmakeContent = cmakeContent
    .replace(/^add_subdirectory\(bench\/wtperf\)/m, '# NPM_PATCHED\n# add_subdirectory(bench/wtperf)')
    .replace(/^add_subdirectory\(bench\/tiered\)/m, '# add_subdirectory(bench/tiered)')
    .replace(/^add_subdirectory\(bench\/wt2853_perf\)/m, '# add_subdirectory(bench/wt2853_perf)')
    .replace(/^add_subdirectory\(examples\)/m, '# add_subdirectory(examples)')
    .replace(/^add_subdirectory\(test\)/m, '# add_subdirectory(test)')
    .replace(/^add_subdirectory\(tools\/checksum_bitflip\)/m, '# add_subdirectory(tools/checksum_bitflip)')
    .replace(
      /^if\(ENABLE_PYTHON\)\s+add_subdirectory\(lang\/python\)\s+add_subdirectory\(bench\/workgen\)\s+endif\(\)/m,
      '# NPM: Python disabled'
    )
  fs.writeFileSync(cmakeFile, cmakeContent)
}

// Configure with CMake
console.log('Configuring WiredTiger with CMake...')
const cmakeArgs = [
  '-DCMAKE_BUILD_TYPE=Release',
  '-DENABLE_SHARED=ON',
  '-DENABLE_STATIC=OFF',
  '-DHAVE_DIAGNOSTIC=OFF',
  '-DENABLE_STRICT=OFF',
  '-DENABLE_PYTHON=OFF',
  '-DENABLE_SNAPPY=1',
  '-DENABLE_ZLIB=1',
  '-DENABLE_LZ4=1',
  '-DENABLE_ZSTD=1'
]

if (isWin) {
  cmakeArgs.push('-A', 'x64')
}

try {
  execSync(`cmake ${cmakeArgs.join(' ')} ..`, {
    cwd: buildPath,
    stdio: 'inherit'
  })
} catch (error) {
  console.error('CMake configuration failed')
  process.exit(1)
}

// Build
console.log('Building WiredTiger library...')
const ncpu = os.cpus().length

try {
  if (isWin) {
    // Windows: use msbuild
    execSync('msbuild wiredtiger_shared.vcxproj /p:Configuration=Release', {
      cwd: buildPath,
      stdio: 'inherit'
    })
  } else {
    // macOS/Linux: use make
    // Build main library
    execSync(`make -j${ncpu} wiredtiger_shared`, {
      cwd: buildPath,
      stdio: 'inherit'
    })

    // Build compression extensions
    console.log('Building compression extensions...')
    const compressionTargets = ['wiredtiger_snappy', 'wiredtiger_zlib', 'wiredtiger_lz4', 'wiredtiger_zstd']
    for (const target of compressionTargets) {
      try {
        execSync(`make -j${ncpu} ${target}`, {
          cwd: buildPath,
          stdio: 'inherit'
        })
      } catch (err) {
        console.warn(`Warning: Failed to build ${target} - compression may not be available`)
      }
    }
  }
} catch (error) {
  console.error('Build failed')
  process.exit(1)
}

console.log('WiredTiger build complete!')
