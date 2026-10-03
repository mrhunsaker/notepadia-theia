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

- A Notepad++-style menu layout: `Search`, `Encoding`, `Language`, `Settings`
  menus plus Npp-style `File`/`Edit` sections.
- One modeless, tabbed Find dialog (Find / Replace / Find in Files / Mark)
  behind Ctrl+F, Ctrl+H, Ctrl+Shift+F and Ctrl+M, replacing Monaco's inline
  find widget, with the Find in Files tab driving workspace search and the
  Mark tab providing the five Notepad++ mark styles.
- Notepad++-style shortcuts: Ctrl+D (duplicate line), Ctrl+L (delete line),
  Ctrl+F2 bookmarks, and more.
- Browser-proof shortcuts: the chords a browser claims (`Ctrl+N`, `Ctrl+W`,
  `Ctrl+Shift+W`, `Ctrl+O`, `F5`, `Ctrl+F5`) keep working in the desktop app
  and gain alternates on the web (`Ctrl+Alt+N`, `Ctrl+F4`, `Ctrl+Alt+Shift+W`,
  `Ctrl+Alt+O`, `Ctrl+Alt+D`, `Ctrl+Alt+Shift+D`); editor zoom keeps `Ctrl+=` /
  `Ctrl+-` / `Ctrl+0` to the text while the editor has focus and leaves page
  zoom to the browser elsewhere; `Settings ▸ Shortcut Mapper` lists and
  rebinds every chord.
- The clipboard and selection half of the Edit menu: Copy to Clipboard (path,
  filename, folder), Paste Special (indent, unindent, unformatted), Insert ▸
  Date & Time with a token-based customized box, Select ▸ Begin/End Select and
  Multi-Select All, Line Operations ▸ Column Mode, and a Clipboard History
  panel of the session's last 20 copies.
- `File ▸ Set/Clear Read-Only`: the document refuses edits, the tab shows the
  padlock and the status bar reads `Read-Only` instead of `INS` / `OVR`.
- Encoding conversion (UTF-8, UTF-8 BOM, UTF-16 LE/BE, ANSI, ISO-8859 family).
- EOL conversion (LF / CRLF) with live status-bar display.
- A Notepad++ default behavior profile: on a cold profile the editor starts
  with word wrap off, 4-wide real tabs, no auto-closing brackets/suggestions,
  formatting off, and Notepad++-style `new 1`, `new 2`, ... plaintext untitled
  documents.
- Bookmarks with gutter glyphs and next/previous navigation, plus a Document
  Map (persistent, preference-backed minimap) for the editor.
- The complete Notepad++ View menu: a **Show Symbol** submenu (space/tab,
  end-of-line `¶`, indent guides) driven by Monaco preferences, **Fold All** /
  **Unfold All** / **Fold Level 1-7** (`Alt+0` / `Alt+Shift+0` / `Alt+1`-`Alt+7`),
  a two-pane **Clone** / **Move to Other View** split with **Synchronize
  Vertical / Horizontal Scrolling**, **Full Screen** (`F11`) and **Post-It**
  (`F12`) distraction-free mode, and **Summary...** document statistics.
- Notepad++'s **Window** menu: the first ten open documents numbered from one
  and renumbered as tabs change, and **Windows...**, a multi-select
  `Name`/`Path`/`Type` list with Activate / Save / Close / Sort.
- A full Notepad++ status bar — length/lines, `Ln / Col / Pos`, selection,
  encoding, EOL, indent mode and an `INS`/`OVR` indicator — with a real
  overtype mode toggled by the `Insert` key.
- Curated `Language` menu with lightweight Monarch tokenizers.
- A Notepad++-style 26px toolbar under the menu bar (file, print, clipboard,
  undo/redo, search, zoom, view toggles, macros) with keyboard navigation.
- Notepadia Classic light/dark themes and a Notepad++ window surface (no
  activity bar, no right-hand panel, no breadcrumbs).
- A Notepad++-style tab bar: red/blue floppy saved-dirty icons and a padlock
  for read-only tabs, the Notepad++ right-click tab menu, and middle-click to
  close.
- Recent files with session persistence.
- The four file commands Notepad++ users expect: `Reload from Disk`,
  `Save a Copy As...` (a copy that leaves the tab on the original file),
  `Rename...` (moves the file and keeps the tab on it, carrying unsaved text
  across) and `Delete from Disk` (always confirmed, closes the tab), plus
  `Open Folder as Workspace...` in the `File` menu.
- `Open` means your own disk, everywhere: the `File` menu entry, the toolbar's
  Open button and `Ctrl+O` are one command labeled `Open from Computer`, and
  the server workspace keeps its own differently named entry,
  `Open from Workspace...`. `Save To This Computer...` and
  `Upload to Workspace...` are the bridges between the two, so it is always
  clear which disk a command touches. On Chromium, a file opened from your
  disk keeps its handle and Ctrl+S writes back to that same file.
- Automatic updates over GitHub Releases (desktop app).
- Unsaved work survives a crash: a copy of every document with unsaved changes
  is kept in the browser's own storage a few seconds after you stop typing, and
  restored the next time you open Notepadia. Saving or discarding clears the
  copy, a file that changed on disk in the meantime is never overwritten, and
  `notepadia.backup.enabled` / `notepadia.backup.intervalSeconds` control it.

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
- **M28** Notepad++ tabbed Find dialog: a single modeless dialog for Find,
  Replace, Find in Files and Mark, with workspace search, the five mark
  styles, and the Mark controls kept in a `Search ▸ Mark` submenu.

See [Architecture](architecture.md) for the internal design, and
[Releases & updates](releases.md) for how new builds reach users.