<!--
 Copyright 2026 Michael Ryan Hunsaker, M.Ed., Ph.D.
 SPDX-License-Identifier: Apache-2.0
-->
# Notepadia

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
![GitHub top language](https://img.shields.io/github/languages/top/mrhunsaker/notepadia-theia)
[![CI](https://img.shields.io/github/actions/workflow/status/mrhunsaker/notepadia-theia/build.yml?label=build)](https://github.com/mrhunsaker/notepadia-theia/actions/workflows/build.yml)
[![E2E](https://img.shields.io/github/actions/workflow/status/mrhunsaker/notepadia-theia/e2e.yml?label=e2e)](https://github.com/mrhunsaker/notepadia-theia/actions/workflows/e2e.yml)
[![Last commit](https://img.shields.io/github/last-commit/mrhunsaker/notepadia-theia)](https://github.com/mrhunsaker/notepadia-theia/commits/main)
![GitHub Release](https://img.shields.io/github/v/release/mrhunsaker/notepadia-theia)
[![Contributors](https://img.shields.io/github/contributors/mrhunsaker/notepadia-theia)](https://github.com/mrhunsaker/notepadia-theia/graphs/contributors)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

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

Product icons are defined by `applications/electron/build/icon.svg`; the
committed `icon.png`, `icon.ico`, `icon.icns` and `icons/*.png` are generated
from it. After editing the SVG, regenerate them with:

```bash
node applications/electron/build/generate-icons.mjs
```

This requires `rsvg-convert` (librsvg) and ImageMagick's `magick` on the PATH.
The browser application injects the same artwork as an SVG favicon at runtime.

## What is implemented

The Notepad++-style feature layer is implemented as the shared
`notepadia` extension in `extensions/notepadia`:

- Theia browser application and desktop (Electron) application
- Monaco editor through Theia
- file navigator/filesystem, editor tabs, session restore and recent files
- Notepad++-style menus (File, Edit, Search, View, Encoding, Language,
  Macros, Settings) and Ctrl/Cmd shortcuts
- search/replace in the active document (find next/previous, replace all,
  regex, match case, whole word)
- find in files / replace in files via Theia's search-in-workspace
- encoding conversion (UTF-8, UTF-8 BOM, UTF-16 LE/BE, ANSI) with re-save
- EOL conversion (LF, CRLF, CR) with re-save
- bookmarks (toggle, next/previous, clear) and line operations
  (duplicate line, delete current line, move line up/down)
- document list panel (View > Document List): filtered list of open files
  with click-to-focus and dirty indicators
- tab size selection (2/4/8) and an Insert Spaces / Use Tabs toggle
  (View > Tab Size) with a status bar indicator
- go to line and matching bracket navigation
- language support: 22 curated languages with Monarch tokenizers
- live status bar with line/column, encoding, EOL, indent mode and insert mode
- product branding as Notepadia
- product icons: a pink, Notepad-style icon for Windows (`.ico`), macOS
  (`.icns`) and Linux (size set) packaging, plus a matching browser favicon
- Electron packaging configuration (AppImage, RPM, DEB)
- CI workflows: build (browser app on Linux) and e2e (lint + build + 12
  Puppeteer test suites with artifact upload on failure)

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
          +-- keybindings (Theia + Monaco level)
          +-- language registrations
          +-- status bar
          +-- e2e test infrastructure
```

The product intentionally does not fork Monaco, reimplement a filesystem, or
replace Theia's command/keybinding architecture.

## Testing

Run the linter and the TypeScript build:

```bash
yarn lint
yarn build
```

Run the 12 end-to-end suites (headless Chromium via Puppeteer):

```bash
yarn test:e2e
```

Each suite boots the browser application against a seeded workspace and
asserts the Notepad++-style behavior. Run a single suite directly, e.g.
`E2E_URL=http://localhost:3000 node e2e/search.cjs`, pointing `E2E_URL` at a
running `yarn start` instance.

## Next milestones

Tracked in `notepadia_prompt_20260915.json`. In order:

1. Windows packaging and file associations
2. macOS packaging and signing
3. automatic updates
4. CI release workflow
5. documentation site (mkdocs, published to GitHub Pages)

## License

[Apache License 2.0](LICENSE). See also [CONTRIBUTING.md](CONTRIBUTING.md),
[STYLE.md](STYLE.md) and [SECURITY.md](SECURITY.md).
