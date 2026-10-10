# Windows package build

The setup compiles a small .NET Framework tray host and bundles Node.js with the app.

1. Place the official x64 Node.js runtime files in `packaging/windows/payload/runtime/`. At minimum this folder needs `node.exe` and `LICENSE.node.txt` (including the Node.js license and third-party notices).
2. Install Inno Setup 6 or later and .NET Framework 4.x. `ISCC.exe` can be selected with the `INNO_SETUP_COMPILER` environment variable.
3. From the repository root, run `powershell -ExecutionPolicy Bypass -File packaging/windows/build.ps1`.

The output is written to `packaging/windows/dist/`. The runtime and build output are ignored by Git. The release build includes the configured `config.json`; review it before distributing a custom build.
