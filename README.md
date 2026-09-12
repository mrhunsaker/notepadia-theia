# Notepadia

Notepadia is a focused, cross-platform desktop text editor modeled after the
Notepad++ user experience and implemented on Eclipse Theia.

## Current baseline

This repository targets **Eclipse Theia 1.75.0**, which was promoted to stable
on September 8, 2026. The current Theia development requirements are Node.js
24+ (Node 26 is supported) and Python 3 for native builds.

The exact Theia 1.75.0 package line is pinned intentionally. Do not mix
`@theia/*` versions.

## Development targets

Linux is the primary development target. The daily driver is the **browser
application** (`applications/browser`): it opens at `http://localhost:3000`,
iterates quickly (esbuild watch, no native rebuild per edit) and is used 99%+
of the time. The **Electron application** (`applications/electron`) is built
and packaged on demand for native desktop delivery (AppImage, RPM, DEB).

## Prerequisites

- Node.js 24+ (Node 26 supported)
- Yarn Classic 1.x
- Python 3
- Git
- Native compiler toolchain
  - Windows: Visual Studio 2022+ Build Tools, Desktop development with C++
  - macOS: Xcode command-line tools
  - Linux: GCC/build-essential and the native dependencies required by Theia

## Bootstrap

From the repository root:

```bash
yarn verify
yarn
yarn build
```

This compiles the `notepadia` extension and the browser application.

Run the development application in the browser:

```bash
yarn start
```

Open http://localhost:3000. For live frontend recompilation while developing
`extensions/notepadia`:

```bash
yarn watch
```

The native module cache (`.browser_modules`) is shared between the browser and
Electron targets. Running `yarn build:electron` (or `yarn build` inside
`applications/electron`) flips it to the Electron ABI; running `yarn build`
(browser) flips it back. There is no action needed in normal browser-first
workflows.

Build for Electron explicitly or package native installers:

```bash
yarn build:electron   # build only, do not package
yarn package:preview  # unpacked directory for local testing
yarn package          # AppImage/RPM/DEB (and NSIS/portable on Windows)
```

The first installation/build may take a substantial amount of time because
Theia contains native Node/Electron dependencies.

## What is implemented

The initial product layer provides:

- Theia browser application and desktop (Electron) application
- Monaco editor through Theia
- file navigator/filesystem
- editor tabs
- File/Edit/Search/View/Encoding/Language/Settings menus
- New / Close All / Duplicate Line commands
- Notepad++-style Ctrl/Cmd shortcuts for those commands
- live status bar with line/column, encoding, EOL and insert mode
- basic document encoding/EOL display based on Theia editor state
- product branding as Notepadia
- Electron packaging configuration (AppImage, RPM, DEB)
- CI build workflow (browser app on Linux)

## Architecture

```text
Notepadia apps
    |
    +-- applications/browser   (primary dev target, opens in a web browser)
    |     +-- Theia browser application platform
    |     |     +-- editor / Monaco
    |     |     +-- filesystem
    |     |     +-- navigator
    |     |     +-- workspace
    |     |     +-- search
    |     |     +-- preferences
    |
    +-- applications/electron  (native desktop packaging)
    |     +-- Electron + Electron Builder
    |     +-- AppImage / RPM / DEB (Linux), NSIS / portable (Windows)
    |
    +-- extensions/notepadia   (shared product extension)
          +-- commands
          +-- menus
          +-- keybindings
          +-- status bar
          +-- future encoding/session/search UX
```

The product intentionally does not fork Monaco, reimplement a filesystem, or
replace Theia's command/keybinding architecture.

## Next milestones

1. Search/replace UX parity
2. Encoding conversion and code-page support
3. EOL conversion
4. session restore/recent files
5. bookmarks and line operations
6. language packs (Monaco grammars; optional Open VSX integration)
7. Windows file associations and portable build
8. updater
9. macOS packaging
