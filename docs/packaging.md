# Packaging

Packaging happens centrally **on CI**: a tag push triggers
[`.github/workflows/release.yml`](releases.md), which builds all three
platforms and uploads the artifacts to a GitHub Release.

## Local packaging (no publish)

The root package provides per-platform helpers. Each one cleans `dist`,
rebuilds the extension and the app in production mode, and invokes
`electron-builder` with `--publish never`:

```bash
yarn package:win       # NSIS installer + portable, per current Windows host
yarn package:linux     # AppImage + rpm + deb, per current Linux host
yarn package:mac       # dmg + zip, per current macOS host
```

Electron Builder cannot cross-compile installers: Windows builds must run on
Windows, Linux on Linux, and macOS on macOS.

For a fast artifacts-less smoke check:

```bash
yarn package:preview   # produces dist/win-unpacked (unpacked app dir)
```

## What actually gets built

From `applications/electron/electron-builder.yml`:

| Platform | Targets | Artifacts |
| --- | --- | --- |
| Windows | `nsis`, `portable` | `Notepadia-<version>-x64.exe`, `Notepadia-<version>-x64-portable.exe` |
| macOS | `dmg`, `zip` | `Notepadia-<version>-x64.dmg`, `.zip` |
| Linux | `AppImage`, `rpm`, `deb` | `Notepadia-<version>-x86_64.AppImage`, `.rpm`, `.deb` |

`npmRebuild: false` — native addons are already rebuilt for the Electron ABI
by `theia rebuild:electron` before `electron-builder` runs. See
[Development](development.md) for the node-pty/Spectre caveat.

## Installers and auto-update

- Windows installers use an **assisted** (per-user) NSIS installer with a
  **fixed install directory**: `electron-updater` can only apply updates to
  the default location, so users are not offered a custom directory.
- Installed apps poll GitHub Releases (`publish.provider: github`); the
  contract is described in [Releases & updates](releases.md).

## Native dependencies

Rebuilding native modules for Electron requires a full C++ toolchain on the
host running the build:

- **Windows**: Visual Studio with the *Desktop development with C++*
  workload (this is what node-pty's `conpty` targets need).
- **Linux**: `build-essential`, `python3`, `make`, `g++`.
- **macOS**: Xcode Command Line Tools.

In CI the runners already provide these. GitHub hosts which do not include
the Spectre-mitigated MSVC libraries cannot rebuild `node-pty` from source
(hence a rebuild list that omits it).