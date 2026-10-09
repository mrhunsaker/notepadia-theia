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
- Notepad++-style menus (File, Edit, Search, View, Encoding, Language, Macros,
  Run, Window, Settings, plus Theia's Help) and Ctrl/Cmd shortcuts
- chords a browser claims (`Ctrl+N`, `Ctrl+W`, `Ctrl+Shift+W`, `Ctrl+O`, `F5`,
  `Ctrl+F5`) stay bound for the desktop app and gain browser-safe alternates on
  the web (`Ctrl+Alt+N`, `Ctrl+F4`, `Ctrl+Alt+Shift+W`, `Ctrl+Alt+O`,
  `Ctrl+Alt+D`, `Ctrl+Alt+Shift+D`) — see
  [shortcuts the browser
  claims](https://mrhunsaker.github.io/notepadia-theia/usage/#shortcuts-the-browser-claims).
  `Ctrl+=` / `Ctrl+-` / `Ctrl+0` zoom the editor text while the editor has
  focus and leave page zoom alone everywhere else, and `Settings ▸ Shortcut
  Mapper` lists and rebinds every registered chord
- `Open` means your own disk, everywhere it appears: the `File` menu entry,
  the toolbar's Open button and `Ctrl+O` all open a file picker on the machine
  you are sitting at, and all three are labeled `Open from Computer`. The
  server workspace is a separate place with its own name — `Open from
  Workspace...` browses it, `Save As...` writes to it, and
  `Save To This Computer...` and `Upload to Workspace...` are the bridges. On
  Chromium, a file opened with Open from Computer keeps its file handle, so
  Ctrl+S on that tab writes back to the same local file; Firefox and Safari
  fall back to an upload/download round trip
- the four file commands Notepad++ puts alongside Save As: `Reload from
  Disk` (asks only when the buffer is dirty), `Save a Copy As...` (writes a
  copy without moving the tab off the original file, and works on an untitled
  document), `Rename...` (moves the file through `FileService`, keeps the tab
  on the new path and carries unsaved text across) and `Delete from Disk`
  (always confirmed, closes the tab). `Open Folder as Workspace...` is in the
  File menu; the rename box refuses `..` and absolute paths
- crash recovery for unsaved work: a copy of every document with unsaved
  changes is written to the browser's own IndexedDB a few seconds after typing
  stops, and restored on the next launch, left dirty so `Ctrl+S` is what keeps
  it. Saving or discarding clears the copy, a file that changed on disk after
  the copy was taken is never overwritten, oversized documents are skipped
  rather than stored, and `notepadia.backup.enabled` /
  `notepadia.backup.intervalSeconds` (5s) control it. IndexedDB rather than
  Theia's `StorageService` because in 1.75 that is localStorage, a small
  synchronous string store
- search/replace in the active document (find next/previous, replace all,
  regex, match case, whole word) through the tabbed Find dialog
- find in files / replace in files via Theia's search-in-workspace, driven
  from the Find in Files tab of that same dialog
- encoding conversion (UTF-8, UTF-8 BOM, UTF-16 LE/BE, ANSI) with re-save,
  `Change File Encoding...` to reopen or save with any encoding Theia ships
  (the ISO-8859 family, KOI8-R, Big5, Shift JIS and the rest), `Reload as
  UTF-8` for decoding, and a status-bar encoding indicator that opens the same
  picker when clicked
- EOL conversion (LF, CRLF) with re-save; classic CR is detected and reported
  in the status bar but is not offered as a conversion target, because Monaco
  has no CR line separator
- bookmarks (toggle, next/previous, clear) and line operations
  (duplicate line, delete current line, move line up/down)
- document list panel (View > Document List): filtered list of open files
  with click-to-focus and dirty indicators
- tab size selection (2/4/8) and an Insert Spaces / Use Tabs toggle
  (View > Tab Size) with a status bar indicator
- go to line and matching bracket navigation
- language support: 21 curated languages with Monarch tokenizers
- full Notepad++ status bar: length/lines, `Ln  Col  Pos`, selection,
  encoding, EOL, indent mode and an INS/OVR indicator
- real INS/OVR overtype mode: `Insert` (or a click on the mode indicator)
  toggles a block caret and overwrites characters as you type, like Notepad++
- a Macros menu: record/stop/discard/playback/clear with a status-bar REC
  indicator while recording
- Column Editor (Edit > Line Operations): text, sequential numbers or cycled
  repeated text down the selected lines, including rectangular blocks
- Blank Operations (Edit > Blank Operations): TAB Space toggling, trims,
  EOL-to-space and "remove unnecessary EOL"; Line Operations also has
  Split Lines and Remove Consecutive Duplicate Lines
- one modeless, Notepad++-style tabbed Find dialog (Ctrl+F / Ctrl+H /
  Ctrl+Shift+F / Ctrl+M) with Find, Replace, Find in Files and Mark tabs,
  which replaces Monaco's inline find widget; the Mark controls also stay
  reachable from a Search > Mark submenu
- a Search Results window (F7 / F4 / Shift+F4): a foot panel that keeps every
  Find All and Find-in-Files run's hits, with wrapping next/previous stepping
  and a tree that announces itself to screen readers
- an Incremental Search bar (Ctrl+Alt+I): the thin bottom strip that jumps to
  the next match as you type with wrap-around, turns red and announces
  `no match` when nothing matches, shares its term / Match case / search mode
  with the Find dialog, and restores the caret on Escape until you accept a
  jump
- Search > Mark: Mark/Mark All/Clear Marks color the search term in one of
  five styles; Select and Find Next adds each next occurrence to the
  selection
- extended search mode (Find dialog > Search Mode > Extended radio): Notepad++'s
  `\n`, `\r`, `\t`, `\0`, `\\`, `\xHH`, `\oOOO`, `\dDDD` and `\bBBBBBBBB`
  escapes are expanded to literals before searching
- Edit > Character Panel: a keyboard-accessible ASCII/symbol grid that inserts
  the picked character at the caret
- Edit > Copy to Clipboard: current full file path, current filename and
  current directory path, on the system clipboard with a real fallback where
  the async clipboard API is unavailable
- Edit > Paste Special: Paste and Indent, Paste and Unindent and Paste
  Unformatted, each judged against the line above the caret
- Edit > Insert > Date & Time: Notepad++'s short (`F5`) and long (`Ctrl+F5`)
  formats plus a token-based customized box that refuses a format with no token
  in it
- Edit > Select: Begin/End Select (`Ctrl+Alt+B`) and Multi-Select All with
  Match case and Whole word variants, which put a cursor on every occurrence of
  the word under the caret
- Edit > Line Operations > Column Mode (`Alt+C`): the current selection becomes
  a rectangular block, for the people who do not know Monaco's Alt+drag
- Edit > Clipboard History: the session's last 20 copies, newest first, one
  click to put one back at every caret
- File > Set/Clear Read-Only (`Ctrl+Alt+R`): the document refuses edits, the
  tab shows the padlock and the status bar reads `Read-Only`, remembered per
  document for the session
- File > Save Session... / Load Session...: named session files persist the
  open tab set, order, active tab, caret positions and bookmarks
- File > Print and File > Print Preview...: render the active document as
  plain text with line numbers and a file-name header in a dedicated window,
  then hand it to the OS print dialog (Print) or leave it open (Print
  Preview...). The toolbar and tab context menu carry the same commands. No
  chord is bound - in a browser Ctrl+P belongs to the page's own print
  dialog
- View > Document Map toggles the minimap, applied to every open editor via
  the `editor.minimap.enabled` preference and persisted across tabs and reloads
- View > Function List opens a panel next to Document Map: a per-language
  outline of the current document's functions, classes and sections
  (JavaScript, TypeScript, Python, C, C++, C#, Java, PHP, Ruby, PowerShell,
  shell, SQL, JSON, XML, HTML, Markdown, INI, Go, Rust) with a name filter, an
  A-Z / document-order sort, click-to-jump, and a re-parse 250 ms after typing
  stops; toggled from the menu or the toolbar button
- the complete Notepad++ View menu: a **Show Symbol** submenu (Show Space and
  TAB, Show All Characters, Show End of Line, Show Indent Guide) driving
  Monaco's `editor.renderWhitespace`, `editor.guides.indentation` and
  `editor.experimentalWhitespaceRendering` preferences (so every open editor
  follows and the choice persists), with the End of Line `¶` drawn as a
  stylesheet decoration because Monaco has no EOL glyph
- Fold All (`Alt+0`), Unfold All (`Alt+Shift+0`) and Fold Level 1-7
  (`Alt+1`-`Alt+7`); Notepad++ lists eight levels but Monaco registers folding
  actions only for 1-7, so level 8 is left off rather than bound to nothing
- a two-pane split view, Notepad++'s Clone to Other View and Move to Other
  View, plus Synchronize Vertical / Horizontal Scrolling, which mirrors the two
  panes through a re-entrancy guard
- Full Screen (`F11`, plus **Ctrl+Shift+F11** where the browser claims F11)
  through the Fullscreen API, and Post-It / distraction-free (`F12`), a real
  view mode that hides the menu bar, toolbar, tab bar and status bar and
  restores cleanly
- View > Summary..., Notepad++'s document statistics (characters, words,
  lines and selected characters) computed from the same pure counters as the
  status bar
- a Window menu in Notepad++'s position (between Macros and Settings): the first
  ten open documents numbered from one and renumbered as tabs open and close,
  plus **Windows...**, a `Name`/`Path`/`Type` list with multi-select and
  Activate / Save / Close / Sort; the menu and the Document List read the same
  shared model
- a Run menu in Notepad++'s position (between Macros and Window): **Run...**
  expands Notepad++'s `$(FULL_CURRENT_PATH)`, `$(FILE_NAME)`,
  `$(CURRENT_DIRECTORY)`, `$(CURRENT_WORD)` and the rest before running, opens
  `http`/`https` commands in a new tab, and explains plainly that starting a
  program needs the desktop build - where it does reach `child_process.spawn`,
  behind the `notepadia.run.allowProcessLaunch` preference, which is off by
  default. Named commands are listed in the menu and managed through **Modify
  Shortcut/Delete Command...**
- Notepad++'s Show Wrap Symbol and Project Panels are deliberately absent:
  Monaco 1.75 has no wrapping-indicator option, and Project Panels is already
  `Open Folder as Workspace...`
- a Notepad++ default behavior profile as the cold-start baseline: word wrap
  off, 4-wide real tabs (`editor.insertSpaces: false`), no auto-closing
  brackets/surround, no suggestions on type, formatting-off by default, and
  untitled documents named `new 1`, `new 2`, ... in plain text
- Notepad++ window surface: Notepadia Classic light/dark themes, an extension
  stylesheet layer, and shell chrome reduced to the Notepad++ shape (no
  activity bar, no right-hand panel, no breadcrumbs, a minimal status bar)
- a 26px Notepad++-style toolbar under the menu bar: 27 buttons grouped as
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
- CI workflows: build (browser app on Linux), e2e (lint + build + 41
  Puppeteer test suites, sharded across two jobs, with artifact upload on
  failure), release (tag-triggered publishing for Windows/Linux/macOS) and docs
  (MkDocs site deployed to GitHub Pages)

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

Run the 41 end-to-end suites (headless Chromium via Puppeteer):

```bash
yarn test:e2e
```

Each suite boots the browser application against a seeded workspace and
asserts the Notepad++-style behavior. Run a single suite directly, e.g.
`E2E_URL=http://localhost:3000 node e2e/search.cjs`, pointing `E2E_URL` at a
running `yarn start` instance.

`e2e/screenshots.cjs` renders the running app at a fixed 1280x800 viewport and
pixel-diffs the main editor and the Find dialog against the committed baselines
in `e2e/baselines/`. A styling regression fails CI, and the failure artifact
bundle carries the `baseline-*`, `actual-*` and `diff-*` PNGs. Refresh the
baselines deliberately with `E2E_UPDATE_BASELINES=1 E2E_SUITES=screenshots node
e2e/run.cjs` and commit the rewritten PNGs. CI runs the suites as two
interleaved matrix shards (`E2E_SHARD=1/2` and `2/2`) to stay under 20 minutes.

## Next milestones

Tracked in `pair_programming_prompt.json`. The Notepad++ visual identity
work (themes, shell chrome, the toolbar and the tab bar) is complete. Phase 1
— the Notepad++ default behavior profile (word-wrap and auto-indent
defaults, untitled naming), the persistent Document Map, and status-bar
parity with a real INS/OVR overtype mode — is complete.
Remaining work, in execution order:

1. Browser-target correctness: opening and saving files from the user's own
   computer, browser-reserved keybinding conflicts, and unsaved-work
   protection and crash recovery are done; what remains here is the
   browser-level accelerator check that cannot be driven from Puppeteer (see
   [shortcuts the browser
   claims](https://mrhunsaker.github.io/notepadia-theia/usage/#shortcuts-the-browser-claims))
2. Deployment and verification debt: the release pipeline is now verified end
   to end - the once-never-run macOS leg runs green and a first dated release
   is published. Remaining are an Electron parity pass for the browser-first
   work and the updater-flow proof on older installed builds pulling a new
   released version

See the [documentation site](https://mrhunsaker.github.io/notepadia-theia/)
for the [user guide](https://mrhunsaker.github.io/notepadia-theia/usage/),
[development](https://mrhunsaker.github.io/notepadia-theia/development/),
[deployment](https://mrhunsaker.github.io/notepadia-theia/deployment/) and
[release](https://mrhunsaker.github.io/notepadia-theia/releases/) guidance.

## License

[Apache License 2.0](LICENSE). See also [CONTRIBUTING.md](CONTRIBUTING.md),
[STYLE.md](STYLE.md) and [SECURITY.md](SECURITY.md).
