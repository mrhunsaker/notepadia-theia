# Changelog

## 0.2.0 (unreleased)

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
  in `docs/ARCHITECTURE.md`.

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