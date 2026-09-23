# Changelog

## 2026.9.23 (WS-A visual identity: themes, shell chrome, toolbar, tab bar)

- **Notepad++ tab bar fidelity**: tabs show Notepad++'s icon states — a red
  floppy for modified, a blue floppy when saved, a padlock when read-only —
  replacing the VS Code dot. Right-clicking a tab opens the Notepad++ menu
  (Close, Close All BUT This, Close All to the Left/Right, Save, Save As...,
  Print, Copy File Path/Name/Directory Path) instead of VS Code's tab menu.
  Middle-click closes a tab. `View > Tab Bar > Draw Close Button` toggles the
  always-visible close button on tabs.
- **Notepadia Classic theme layer**: a light theme keyed to Notepad++'s
  defaults (white editor, grey gutter, black text) and a dark counterpart,
  both registered with Monaco; all styling now lives in one extension-owned
  stylesheet layer using Theia color tokens. `Notepadia Classic` is the
  default on a cold profile.
- **Shell chrome reduction**: the activity bar, right panel, breadcrumbs,
  minimap and non-Notepad++ status bar items are hidden by default;
  `View > Folder as Workspace` brings the left panel back.
- **Notepad++-style toolbar**: a 26px icon toolbar under the menubar
  (file, print, clipboard, undo/redo, search, zoom, view toggles, macros)
  with tooltips, roving-tabindex keyboard navigation and `aria-pressed`
  states; `View > Toolbar` persists.
- **Extended search mode**: Search > Mark respects a Search Mode submenu
  (Normal / Extended / Regular Expression); extended mode expands Notepad++'s
  `\n \r \t \0 \xHH \oOOO \dDDD \bBBBBBBB` escapes to literals
  (`src/common/extended-search.ts`, unit tested).
- **Character Panel** (Edit > Character Panel): a keyboard-accessible ASCII
  and symbol grid that inserts the picked character at the caret.
- **Named sessions** (File > Save Session... / Load Session...): session
  files persist the open tab set, order, active tab, caret positions and
  bookmarks (`src/common/sessions.ts`, unit tested).
- **Print** (File > Print, Ctrl+P): renders the document into an iframe with
  syntax colors, line numbers and header/footer variables before opening the
  print dialog.
- e2e grew to 23 suites.

## 2026.9.18 (unit tests)

- `yarn test` is no longer a no-op: the Notepad++-style logic is extracted
  into dependency-free pure modules under `extensions/notepadia/src/common`
  (`blank-ops`, `column-editor`, `macro-steps`) and covered by 44 Node test
  runner assertions (`node --test`), wired into `yarn test` (extension builds,
  then runs the tests) and as a step in `e2e.yml`.
- The extraction is pure refactoring: the browser contributions now import the
  same functions, and all 16 e2e suites still pass after the move.

## 2026.9.18 (M23)

- New top-level **Macros** menu with a Notepad++-style macro editor:
  `Record Macro...` / `Stop Recording` / `Discard Recording` / `Run Macro` /
  `Clear Macro`. Recording captures typed text, pastes and deletes as ordered
  steps (content changes, decomposed into type/delete actions); playback
  replays them from the current cursor position. A `REC` indicator shows in
  the status bar while recording, and Run/Clear are enabled only when a
  macro exists.
- **Edit ▸ Column Editor...** (`Line Operations` submenu): inserts text,
  sequential numbers (with optional leading zeros) or one cycled character
  of repeated text down the lines spanned by the current selection —
  including rectangular Alt+drag block selections.
- **Edit ▸ Blank Operations** submenu: `TAB to Space`, `Space to TAB`,
  `Trim leading and trailing space`, `Trim trailing space`, `EOL to space`,
  `Remove unnecessary EOL and trailing spaces` (empty selections operate on
  the whole document). `Line Operations` also gains `Split Lines` (word-aware
  wrap at 80 columns) and `Remove Consecutive Duplicate Lines`.
- **Search ▸ Mark** submenu: `Mark` / `Mark All` color every occurrence of
  the current search term (selection first, otherwise the Find widget's
  term) in one of five alternating styles; `Clear Marks` removes them;
  `Select and Find Next` selects the next occurrence and keeps adding matches
  without leaving the menu.
- **View ▸ Document Map** toggles the Monaco minimap for the active editor.
- e2e grew four new suites (`column-editor`, `blank-ops`, `search-mark`,
  `macros` → 16 total) covering the dialog inputs, byte-exact blank/spaces
  transforms, mark decorations and macro record→clear→replay.

## 2026.9.19

- First release under the new **date-based versioning** scheme
  (`YYYY.M.D`): the repo stays at `0.0.0` and the build version is generated
  by `scripts/set-build-version.mjs` (and injected by `package-electron.mjs` /
  CI) at package time, so no committed version bump is needed.
- Notepad++ editing essentials: new `Search`, `Encoding`, `Language`,
  `Settings` top-level menus plus a `Line Operations` submenu and a
  `Convert Case` submenu under Edit.
- File menu now offers New / Open / Save / Save As / Save All / Close /
  Close All / Close All But Active.
- Edit operations implemented through Monaco editor actions: duplicate line,
  delete line, move line up/down, join lines, indent/unindent, comment
  toggle, and case conversion.
- Ctrl+D (duplicate line) and Ctrl+L (delete line) now override Monaco's
  multicursor find and line-expansion defaults. Editor input is forced onto
  the classic textarea path (`editor.editContext: false`) so Theia-level
  chords fire deterministically; Monaco dynamic keybindings are bridged as a
  fallback.
- Ctrl+J join lines and Ctrl+Shift+U uppercase keep Monaco-level behavior via
  the Monaco keybinding bridge.
- Unsaved-change confirmation when closing dirty editors (Save / Don't Save /
  Cancel) for single-tab and Close All; `file.upload`-based OS drag-and-drop
  hint with an "Upload Files..." action.
- Test workspace recommends `files.autoSave: "off"` for Notepad++ semantics.

### Encoding conversion

- Functional `Encoding` menu backed by Theia's iconv-lite pipeline:
  Encode in UTF-8 / UTF-8 BOM / UTF-16 LE / UTF-16 BE, Convert to ANSI
  (Windows 1252), Reload as UTF-8, plus the built-in Change File Encoding
  quick-pick (reopen or save with any supported encoding).
- BOM auto-detection on open for UTF-8 BOM, UTF-16 LE and UTF-16 BE files.
- Status bar now reports the active editor's real encoding and EOL; the
  encoding entry is clickable to change encoding.
- Worked around a Theia write-path quirk where `utf8bom` was collapsed to
  `utf8` (bytes patched with the EF BB BF prefix after the encode).

### EOL conversion

- `Edit ▸ EOL Conversion` submenu with `Convert to Unix Format (LF)` and
  `Convert to Windows Format (CRLF)` (Monaco `setEOL`, undoable).
- `Change Line Endings...` quick-pick, also bound to the clickable EOL entry
  in the status bar.
- Status bar EOL/encoding entries now refresh on content changes as well as
  encoding changes. CR files are detected and reported but not convertible
  (Monaco has no CR line model).

### Recent Files

- `File ▸ Recent Files` lists the most recently opened documents (most recent
  first, deduplicated, capped at 15) with `Clear Recent Files`.
- History persists across reloads via localStorage; selecting an entry
  reopens it and bumps it to the top.

### Bookmarks

- `Ctrl+F2` toggles a bookmark on the current line (`F2` / `Shift+F2` jump to
  next/previous bookmark with wrap-around).
- `Edit ▸ Bookmarks` submenu with Toggle/Next/Previous/Clear All.
- Bookmarks render as a glyph in the line-number gutter (Monaco decoration
  collection, one per editor, updated in place).

### Language menu

- Functional `Language` top-level menu: `Change Language Mode...` (wraps the
  built-in quick-pick, whose own registration hides it from palettes/menus)
  plus a curated Notepad++-style list, each entry switching the active editor
  via `setLanguage`.
- The build ships almost no registered languages, so the listed languages are
  registered at startup with their file extensions (gives auto-detection for
  `.js`, `.scala`, etc.) and lightweight Monarch tokenizers (keywords,
  strings, comments, numbers). Registration is skipped for ids that already
  exist (e.g. `plaintext`, `jsonc`).
- Status bar shows the friendly language name of the active editor and is
  clickable to change language mode; it refreshes on language changes.
- JSON added to the curated list with a dedicated Monarch tokenizer
  (double-quoted strings, numbers, true/false/null literals, structural
  punctuation and bracket nesting) and auto-detection for `.json`/`.jsonc`/
  `.json5`.
- PowerShell added with a dedicated Monarch tokenizer (`#` and `<# #>`
  comments, `@`-here-strings, single/double-quoted strings, `$variables`,
  `Verb-Noun` cmdlets, operators and if/elseif/for/finally keywords) and
  auto-detection for `.ps1`/`.psm1`/`.psd1`/`.pssc`.

### CI and automated e2e

- New `.github/workflows/e2e.yml`: on every push/PR it runs `yarn lint`,
  `yarn build`, then `yarn test:e2e` (all 10 Puppeteer suites) on
  ubuntu-latest with Node 24, a 45-minute job timeout, a cached Puppeteer
  Chrome download, and an artifact upload of test logs/screenshots on
  failure.
- `yarn lint` is no longer a no-op: the `notepadia` extension now lints
  `src/**/*.ts` with ESLint 10 + typescript-eslint (flat config) and passes
  clean.
- The e2e runner now persists per-suite logs, a `results.json`, and a
  `status.txt` to `e2e-artifacts/` (gitignored), and failing suites also
  capture browser screenshots and console errors.
- The runner pre-flights the port and refuses to run against a stale Theia
  server, and fails fast if the backend exits early.

### Desktop packaging

- First Linux distributables: `applications/electron` now yields
  `dist/Notepadia-0.1.0-x86_64.AppImage`,
  `dist/Notepadia-0.1.0-x86_64.rpm`, and
  `dist/Notepadia-0.1.0-amd64.deb` via
  `yarn build:prod` + `npx electron-builder --linux <target> -p never`
  (Electron 42.8.1, native addons rebuilt, production bundle inside
  `resources/app.asar`).
- Documented packaging pipeline (and the outstanding icon/desktopName polish)
  in `docs/architecture.md`.

### Document list panel

- New `View ▸ Document List` toggle opens a right-side panel
  (`notepadia.documentList`) listing every open document sorted by filename,
  with a filter input, click-to-focus, active-tab highlighting and a dirty
  indicator per entry.

### Spaces vs tabs

- `View ▸ Tab Size` gains `Insert Spaces` and `Use Tabs` toggles (wired to
  `model.updateOptions({ insertSpaces })` and persisted through the preference
  service); the status bar shows the current `Spaces:`/`Tabs:` mode.
- Fixed a latent tab-size bug: `control.updateOptions({ tabSize })` is a
  no-op, so tab size is applied via `model.updateOptions({ tabSize,
  indentSize })`.

### Product icons

- Added a pink, Notepad-style product icon (`applications/electron/build/
  icon.svg`) and generated `icon.png`, `icon.ico`, `icon.icns` and an
  `icons/` PNG size set via `build/generate-icons.mjs`;
  `electron-builder.yml` now wires them into win/mac/linux packaging, and the
  browser app injects the same artwork as a runtime favicon.

### Windows packaging and file associations

- `applications/electron` now produces a Windows NSIS installer and a
  portable package (`yarn package:win`), with file associations for
  `.txt .log .ini .csv .json .xml .html .css .js .py .java .c .cpp .h .rs
  .go .sh .ps1 .md .sql .yaml/.yml`.
- Double-clicking an associated file opens Notepadia with that file loaded
  (OS file-open routing into the editor).
- Root helpers `yarn package:win` / `package:linux` / `package:mac` added
  (all local builds use `--publish never`).

### Automatic updates

- `electron-updater` integrated into the desktop app, fed by GitHub Releases
  (`publish.provider: github` in `electron-builder.yml`).
- The electron-main process configures `autoUpdater` (auto-download,
  install-on-quit) and reports status over Theia's Electron IPC; the frontend
  exposes `Help ▸ Check for Updates...`, shows download progress, and prompts
  to restart when an update is ready.
- Windows NSIS installer now uses a fixed install directory
  (`allowToChangeInstallationDirectory: false`) so updates can always find
  the app.

### Release workflow

- New `.github/workflows/release.yml`: triggered by `v*` tags (or manually),
  it builds and publishes installers on parallel Windows/Linux/macOS runners
  (`--publish always`, version derived from the tag).
- The workflow runs in three phases — **prepare** (creates the draft GitHub
  Release once, so the parallel build jobs never race on release creation),
  **build & publish** (the per-OS matrix uploads installers + update
  manifests into that draft), and **finalize** (publishes the draft
  automatically so `electron-updater` can serve it). No manual publish step.
- macOS artifacts (DMG/zip) build **unsigned** in CI
  (`CSC_IDENTITY_AUTO_DISCOVERY=false`); code-signing/notarization awaits an
  Apple Developer ID certificate.
- The native-module rebuild step excludes `node-pty` on Windows CI: it ships
  Electron-compatible N-API prebuilds, and its `binding.gyp` requires
  Spectre-mitigated MSVC libraries (MSB8040).

### macOS build in CI

- Windows/Linux jobs are always unsigned; the macOS job signs + notarizes
  **only when the Apple secrets are configured**
  (`CSC_IDENTITY_AUTO_DISCOVERY` is derived from `secrets.CSC_LINK`). With no
  credentials the macOS DMG/zip build runs unsigned exactly as before — the
  drop-in trigger needs zero workflow changes.
- `mac` config hardened: `hardenedRuntime`, `gatekeeperAssess`, the existing
  entitlements plists, and `mac.notarize` (electron-builder notarizes when
  `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` exist and skips
  otherwise).
- macOS file associations added as `mac.fileAssociations` — the same 22
  text/source extensions as Windows/Linux render as `CFBundleDocumentTypes`
  in `Info.plist` (this closes the long-standing "plist UTIs not configured"
  gap).
- Because there is no local Mac, `release.yml` now verifies every macOS build
  in CI: `plutil` lints the Info.plist, all associated extensions are
  asserted present, `hdiutil imageinfo` validates the DMG, and — only when
  signed — `codesign --verify --deep --strict` and `spctl -a -vv` must pass.

### Release integrity

- The release workflow now generates a SHA-256 checksum (`*.sha256`) for
  every installer/update-manifest/blockmap artifact, uploaded both as a
  workflow attachment and onto the GitHub Release beside each binary.
- Release docs gained a step-by-step secrets checklist for enabling macOS
  signing/notarization.

### Documentation site

- Added an MkDocs (Material) site published to
  https://mrhunsaker.github.io/notepadia-theia/ via
  `.github/workflows/docs.yml` (GitHub Pages with the "GitHub Actions"
  source).
- Pages: overview, getting started, user guide, architecture (migrated from
  `docs/ARCHITECTURE.md`), development, packaging, releases & updates.
- README now badges and links the docs site and the release/docs workflows.

## 0.1.1 (unreleased)

- Added `applications/browser`: browser-first development application served at
  `http://localhost:3000`. `yarn build`/`yarn start` now default to it.
- Root scripts reworked: `build`, `start`, `watch` target the browser app;
  Electron remains available via `build:electron`, `start:electron` and
  `build:all`.
- Added `react`/`react-dom` as direct application dependencies (peer
  dependencies of `@theia/core`).
- Removed stale Yarn Berry artifacts (`.pnp.cjs`, `.pnp.loader.mjs`,
  `.yarn/unplugged`) that prevented esbuild from resolving packages.
- Linux packaging precedence set to AppImage, then RPM, then DEB; desktop entry
  file associations added.
- CI now builds the browser application on Linux and uploads its artifacts.
- Updated README, architecture notes, artifact manifest and continuation prompt.

## 0.1.0

- Rebased the product baseline on Theia 1.75.0.
- Node.js 24+ baseline.
- Electron 42.8.1 baseline.
- Added buildable monorepo structure.
- Added Notepadia Theia extension.
- Added Notepad++-style menus, commands, shortcuts and status bar.
- Added Electron Builder configuration.
- Added environment verification and CI.