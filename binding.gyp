{
  "targets": [
    {
      "target_name": "wiredtiger_native",
      "sources": [
        "lib/wiredtiger_binding.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "lib/wiredtiger/src/include",
        "lib/wiredtiger/build/include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15"
      },
      "msvs_settings": {
        "VCCLCompilerTool": { "ExceptionHandling": 1 }
      },
      "conditions": [
        ["OS=='mac'", {
          "libraries": [
            "-Wl,-rpath,<(module_root_dir)/lib/wiredtiger/build",
            "<(module_root_dir)/lib/wiredtiger/build/libwiredtiger.dylib"
          ]
        }],
        ["OS=='linux'", {
          "libraries": [
            "-Wl,-rpath,<(module_root_dir)/lib/wiredtiger/build",
            "<(module_root_dir)/lib/wiredtiger/build/libwiredtiger.so"
          ]
        }],
        ["OS=='win'", {
          "libraries": [
            "<(module_root_dir)/lib/wiredtiger/build/Release/wiredtiger.lib"
          ]
        }]
      ]
    }
  ]
}
