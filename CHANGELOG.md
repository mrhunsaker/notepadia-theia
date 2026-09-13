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