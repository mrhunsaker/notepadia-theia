<!--
 Copyright 2026 Michael Ryan Hunsaker, M.Ed., Ph.D.
 SPDX-License-Identifier: Apache-2.0
-->
# Notepadia

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
![GitHub top language](https://img.shields.io/github/languages/top/mrhunsaker/notepadia-theia)
[![CI](https://img.shields.io/github/actions/workflow/status/mrhunsaker/notepadia-theia/build.yml?label=build)](https://github.com/mrhunsaker/notepadia-theia/actions/workflows/build.yml)
[![E2E](https://img.shields.io/github/actions/workflow/status/mrhunsaker/notepadia-theia/e2e.yml?label=e2e)](https://github.com/mrhunsaker/notepadia-theia/actions/workflows/e2e.yml)
[![Release](https://img.shields.io/github/actions/workflow/status/mrhunsaker/notepadia-theia/release.yml?label=release)](https://github.com/mrhunsaker/notepadia-theia/actions/workflows/release.yml)
[![Docs](https://img.shields.io/github/actions/workflow/status/mrhunsaker/notepadia-theia/docs.yml?label=docs)](https://github.com/mrhunsaker/notepadia-theia/actions/workflows/docs.yml)
[![Documentation](https://img.shields.io/badge/docs-notepadia--theia-blue)](https://mrhunsaker.github.io/notepadia-theia/)
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
yarn package:win      # NSIS + portable (must run on Windows)
yarn package:linux    # AppImage/RPM/DEB (must run on Linux)
yarn package:mac      # DMG + ZIP (must run on macOS)
```

The `package:*` helpers build with `--publish never`; CI is the only place
that publishes (`v*` tag push). See
[Releases & updates](https://mrhunsaker.github.io/notepadia-theia/releases/)
for the release/update flow.

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
  Settings) and Ctrl/Cmd shortcuts
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
- a Macros menu: record/stop/discard/playback/clear with a status-bar REC
  indicator while recording
- Column Editor (Edit > Line Operations): text, sequential numbers or cycled
  repeated text down the selected lines, including rectangular blocks
- Blank Operations (Edit > Blank Operations): TAB Space toggling, trims,
  EOL-to-space and "remove unnecessary EOL"; Line Operations also has
  Split Lines and Remove Consecutive Duplicate Lines
- Search > Mark: Mark/Mark All/Clear Marks color the search term in one of
  five styles; Select and Find Next adds each next occurrence to the
  selection
- extended search mode (Search > Search Mode > Extended): Notepad++'s `\n`,
  `\r`, `\t`, `\xHH`, `\o...`, `\d...`, `\b...` escapes are expanded to
  literals before searching
- Edit > Character Panel: a keyboard-accessible ASCII/symbol grid that inserts
  the picked character at the caret
- File > Save Session... / Load Session...: named session files persist the
  open tab set, order, active tab, caret positions and bookmarks
- File > Print (Ctrl+P): prints the active document through an iframe with
  syntax colors, line numbers and header/footer variables
- View > Document Map toggles the minimap, applied to every open editor via
  the `editor.minimap.enabled` preference and persisted across tabs and reloads
- a Notepad++ default behavior profile as the cold-start baseline: word wrap
  off, 4-wide real tabs (`editor.insertSpaces: false`), no auto-closing
  brackets/surround, no suggestions on type, formatting-off by default, and
  untitled documents named `new 1`, `new 2`, ... in plain text
- Notepad++ window surface: Notepadia Classic light/dark themes, an extension
  stylesheet layer, and shell chrome reduced to the Notepad++ shape (no
  activity bar, no right-hand panel, no breadcrumbs, a minimal status bar)
- a 26px Notepad++-style toolbar under the menu bar: 26 buttons grouped as
  file actions, print, clipboard, undo/redo, search, zoom, view toggles and
  macros, with tooltips, roving-tabindex keyboard navigation, `aria-pressed`
  states on real toggles, and a persistent `View > Toolbar` toggle
- a Notepad++-style tab bar: red/blue floppy saved-dirty icons and a padlock
  for read-only tabs, Notepad++'s right-click tab menu (Close All BUT This,
  Close All to the Left/Right, Copy File Path/Name/Directory Path), and
  middle-click to close a tab
- product branding as Notepadia
- product icons: a pink, Notepad-style icon for Windows (`.ico`), macOS
  (`.icns`) and Linux (size set) packaging, plus a matching browser favicon
- Windows installers (NSIS + portable) with file associations for common
  text/source formats and OS file-open routing into the editor
- automatic updates via electron-updater + GitHub Releases (Help >
  Check for Updates...)
- Electron packaging configuration (AppImage, RPM, DEB, NSIS, DMG)
- CI workflows: build (browser app on Linux), e2e (lint + build + 23
  Puppeteer test suites with artifact upload on failure), release (tag-triggered
  publishing for Windows/Linux/macOS) and docs (MkDocs site deployed to GitHub
  Pages)

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
          +-- automatic updates (electron-updater over Electron IPC)
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

Run the 23 end-to-end suites (headless Chromium via Puppeteer):

```bash
yarn test:e2e
```

Each suite boots the browser application against a seeded workspace and
asserts the Notepad++-style behavior. Run a single suite directly, e.g.
`E2E_URL=http://localhost:3000 node e2e/search.cjs`, pointing `E2E_URL` at a
running `yarn start` instance.

## Next milestones

Tracked in `pair_programming_prompt.json`. The Notepad++ visual identity
work (themes, shell chrome, the toolbar and the tab bar) is complete. Phase 1
finish — the Notepad++ default behavior profile (word-wrap and auto-indent
defaults, untitled naming) and the persistent Document Map — is complete.
Remaining work, in execution order:

1. Status-bar parity with a real Notepad++ editing engine (INS/OVR mode, plus
   any remaining parity gaps)
2. The tabbed Find dialog: `Ctrl+F` opens one Notepad++-style tabbed Find
   dialog (Find / Replace / Mark / Find-in-Files tabs) instead of Monaco's
   inline widget
3. Browser-target correctness: opening and saving files from the user's own
   computer, resolving browser-reserved keybinding conflicts, and
   unsaved-work protection and crash recovery
4. Remaining menu and panel debt: menu completeness including the Window
   menu, the Function List panel and Folder-as-Workspace presentation, an
   incremental search bar, a browser-appropriate Run menu, and the Search
   Results window
5. Accessibility and release verification: keyboard/screen-reader/contrast
   verification, test growth with a visual baseline, a documentation truth
   pass, macOS release-workflow verification, Electron parity for everything
   added, and the first published `vYYYY.M.D` release to prove the updater
   flow end to end

See the [documentation site](https://mrhunsaker.github.io/notepadia-theia/)
for the [user guide](https://mrhunsaker.github.io/notepadia-theia/usage/),
[development](https://mrhunsaker.github.io/notepadia-theia/development/) and
[release](https://mrhunsaker.github.io/notepadia-theia/releases/) guidance.

## License

[Apache License 2.0](LICENSE). See also [CONTRIBUTING.md](CONTRIBUTING.md),
[STYLE.md](STYLE.md) and [SECURITY.md](SECURITY.md).
