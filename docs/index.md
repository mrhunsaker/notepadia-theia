# Notepadia

**Notepadia** is a Notepad++-style desktop text editor built on
[Eclipse Theia](https://theia-ide.org). It reproduces the Notepad++ user
experience — menus, shortcuts and editing behavior — without reproducing its
implementation.

The product is organized as a monorepo:

- `applications/browser` — the web development target, served at
  `http://localhost:3000`.
- `applications/electron` — the native desktop target (Electron +
  electron-builder): NSIS/portable installers on Windows, AppImage/RPM/DEB on
  Linux, DMG on macOS.
- `extensions/notepadia` — the product extension. All Notepad++-style behavior
  lives here and is shared by both application targets.

## Highlights

- Notepad++-style menu layout: `Search`, `Encoding`, `Language`, `Settings`
  menus plus Npp-style `File`/`Edit` sections.
- Notepad++-style shortcuts: Ctrl+D (duplicate line), Ctrl+L (delete line),
  Ctrl+F2 bookmarks, and more.
- Encoding conversion (UTF-8, UTF-8 BOM, UTF-16 LE/BE, ANSI, ISO-8859 family).
- EOL conversion (LF / CRLF) with live status-bar display.
- A Notepad++ default behavior profile: on a cold profile the editor starts
  with word wrap off, 4-wide real tabs, no auto-closing brackets/suggestions,
  formatting off, and Notepad++-style `new 1`, `new 2`, ... plaintext untitled
  documents.
- Bookmarks with gutter glyphs and next/previous navigation, plus a Document
  Map (persistent, preference-backed minimap) for the editor.
- Curated `Language` menu with lightweight Monarch tokenizers.
- A Notepad++-style 26px toolbar under the menu bar (file, print, clipboard,
  undo/redo, search, zoom, view toggles, macros) with keyboard navigation.
- Notepadia Classic light/dark themes and a Notepad++ window surface (no
  activity bar, no right-hand panel, no breadcrumbs).
- A Notepad++-style tab bar: red/blue floppy saved-dirty icons and a padlock
  for read-only tabs, the Notepad++ right-click tab menu, and middle-click to
  close.
- Recent files with session persistence.
- Automatic updates over GitHub Releases (desktop app).

## Project status

Project milestones:

- **M1–M8** Editor core: search/replace, encoding, EOL, recent files and
  session restore, bookmarks and line operations, language support, Notepad++
  menus and shortcuts.
- **M9** Linux Electron packaging (AppImage/rpm/deb).
- **M10–M16** CI e2e + ESLint, JSON/PowerShell languages, replace-in-files,
  matching bracket, document list panel, spaces-vs-tabs, product icons.
- **M17** Windows packaging, file associations, and file-open routing.
- **M18** macOS packaging and signing (installers build **unsigned** in CI;
  code-signing/notarization pending an Apple Developer ID).
- **M19** Automatic updates (electron-updater).
- **M20** CI release workflow (GitHub Actions).
- **M21** Documentation site (MkDocs on GitHub Pages).
- **M22** macOS release-workflow verification (unsigned builds; signing
  pending an Apple Developer ID).
- **M23** Macros, Column Editor, Blank Operations, Split Lines /
  Remove Consecutive Duplicate Lines, Search Mark / Select-and-Find-Next,
  and the Document Map.
- **M24** Unit tests for extracted logic, wired into `yarn test`.
- **M25** Escape-search mode, named sessions, character panel, and print.
- **M26** Notepad++ visual identity: Notepadia Classic light/dark themes,
  shell-chrome reduction, the toolbar, and tab-bar fidelity (floppy saved/dirty
  icons, the Notepad++ tab context menu, middle-click close).
- **M27** Notepad++ default behavior profile: editor defaults in the app
  preference blocks, Notepadia's own settings in the Settings UI, a persistent
  preference-backed Document Map, and Notepad++-style untitled naming.

See [Architecture](architecture.md) for the internal design, and
[Releases & updates](releases.md) for how new builds reach users.