# User guide

A tour of the Notepad++-style behavior implemented by the `notepadia`
extension.

## Default behavior profile

On a cold profile (no saved settings) Notepadia starts with
Notepad++-style defaults rather than VS Code-style editor intelligence:

- **word wrap off**, **4-wide real tabs** (`insertSpaces: false`), tab-size
  detection disabled
- no auto-closing brackets, quotes or auto-surround
- no suggestions popup while typing (`quickSuggestions` off) and no
  suggestions on trigger characters
- formatting off on paste/type, no trimming of trailing whitespace on save
- whitespace and control characters hidden, line numbers on, rulers off,
  autosave off

Each of these lives in the app's `theia.frontend.config.preferences` block in
`applications/browser/package.json` and `applications/electron/package.json`,
so they take effect before any user setting and can be overridden per
workspace or per user.

## Document Map

`View ▸ Document Map` toggles the minimap, the narrow overview of the whole
file beside the editor. The toggle writes the `notepadia.documentMap.visible`
preference (mirrored into `editor.minimap.enabled`), so the choice:

- applies to **every** open editor at once,
- survives opening other tabs and a page reload,
- is editable directly in Settings alongside the Notepad++ preferences.

The "minimap hidden on a cold profile" default is part of the behavior
profile above.

## New documents

`File ▸ New` (Ctrl+N) opens a new untitled document named `new 1`, `new 2`,
... like Notepad++, in plain text (no extension, no language detection).
Save As... (Ctrl+Shift+S) prompts for a real file name.

## Menus and commands

Notepadia adds the top-level menus `Search`, `Encoding`, `Language`, and
`Settings`, while the `File` and `Edit` menus gain Notepad++-style sections:

- **File**: New / Open / Save / Save As / Save All / Close / Close All /
  Close All But Active, plus **Recent Files**.
- **Edit**: Indent / Unindent / Duplicate Current Line / Delete Current Line /
  Move Current Line Up + Down / Join Lines / comment line, a **Line
  Operations** submenu, and a **Convert Case** submenu. **Bookmarks** are
  also under Edit.
- **Search**: Find / Find Next / Find Previous / Replace / Find in Files.

Text manipulation reuses Monaco's hardened editing engine through
`editor.action.*` triggers instead of bespoke string rewriting.

## Toolbar

A 26px Notepad++-style toolbar runs under the menu bar. `View ▸ Toolbar`
toggles the strip on and off, and the choice survives reloads.

- **Groups**, left to right: file actions (New, Open, Save, Save All, Close,
  Close All), Print, clipboard (Cut / Copy / Paste), history (Undo / Redo),
  search (Find, Replace, Find Next, Find Previous), zoom (In / Out /
  Restore Default), view toggles (Word Wrap, Show All Characters, Document
  Map, Folder as Workspace) and macros (Start Recording, Stop Recording,
  Play Recording).
- **State**: buttons that map to a real toggle — `Word Wrap`,
  `Show All Characters`, `Document Map`, `Folder as Workspace` and
  `Start Recording` — render `aria-pressed`, so their state is visible and
  announced. Buttons without a toggled meaning never claim one.
- **Keyboard**: the strip is a single tab stop (ARIA toolbar / roving
  tabindex). `→` / `←` move between buttons, `Home` / `End` jump to the
  first/last, and `Enter` activates the focused button. Disabled buttons are
  skipped.
- Toolbar buttons follow the current editor: file/editor actions such as Save
  and Undo are enabled only while a file is open.

## Tab bar

The editor tab bar uses Notepad++'s own state icons instead of VS Code's dot:

- a **red floppy** means the file has unsaved changes, a **blue floppy** that
  it is saved, and a **padlock** that the document is read-only.

Right-clicking a tab opens the Notepad++ tab menu rather than VS Code's:

- **Close**, **Close All BUT This**, **Close All to the Left** and **Close All
  to the Right**
- **Save** and **Save As...**
- **Print**
- **Copy File Path**, **Copy File Name** and **Copy Directory Path**

Middle-clicking a tab closes it. `View > Tab Bar > Draw Close Button` toggles
whether every tab shows an always-visible `x` on hover.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl+D | Duplicate current line |
| Ctrl+L | Delete current line |
| Ctrl+F2 | Toggle bookmark on the current line |
| F2 / Shift+F2 | Next / previous bookmark (wraps in file) |
| F3 / Shift+F3 | Find next / previous |

!!! note
    The editor is forced onto the classic textarea input path
    (`editContext: false`) so Theia's own keybinding layer stays
    deterministic. The Ctrl+D / Ctrl+L chords are mirrored into Monaco's
    keybinding service as a fallback.

## Encoding

The **Encoding** menu provides Notepad++-style operations backed by Theia's
iconv-lite pipeline:

- `Encode in UTF-8`
- `Encode in UTF-8 BOM`
- `Encode in UTF-16 LE` / `Encode in UTF-16 BE`
- `Convert to ANSI (Windows 1252)`
- `Change File Encoding...` — quick-pick to reopen/save with any supported
  encoding (including the ISO-8859 family).
- `Reload as UTF-8` (decode mode).

The status bar shows the current encoding and is clickable to change it.
UTF-16 LE/BE and UTF-8 BOM files round-trip as-is. A UTF-8-BOM encode is
patched with the `EF BB BF` bytes post-write so the BOM survives (upstream
collapses `utf8bom` to `utf8` at write time).

## Line endings (EOL)

`Edit ▸ EOL Conversion` offers:

- `Convert to Unix Format (LF)`
- `Convert to Windows Format (CRLF)`

Both transform the buffer with Monaco's `setEOL` and are undoable.
`Change Line Endings...` (also reachable by clicking the EOL entry in the
status bar) offers the same targets as a quick-pick.

!!! tip
    Only LF and CRLF are offered. Monaco's line model splits on `\n`, so
    classic CR cannot be a separators inside the editor; CR files are
    detected and shown as `CR` in the status bar.

## Bookmarks

- `Ctrl+F2` toggles a bookmark on the current line.
- `F2` / `Shift+F2` jump to the next / previous bookmark (wrapping).
- `Edit ▸ Bookmarks ▸ Clear All Bookmarks` empties the current file's set.

Bookmarks are per-model (keyed by URI), session-scoped, and rendered as
glyphs in the line-number gutter.

## Language menu

- **`Change Language Mode...`** opens Monaco's language quick-pick.
- A curated list (JavaScript, TypeScript, HTML, CSS, Markdown, YAML, XML,
  Python, C, C++, C#, Java, PHP, Ruby, Go, Rust, Shell Script, SQL, Plain
  Text) is registered at startup with lightweight Monarch tokenizers, and
  each entry is a menu action switching the editor language.
- The status bar shows the friendly language name and is clickable.

## Recent Files

`File ▸ Recent Files` lists recently opened editors (most recent first,
deduplicated, capped at 15) with a `Clear Recent Files` entry. History
survives reloads via localStorage.

## Unsaved changes and drag-and-drop

- `File ▸ Close` and `File ▸ Close All` confirm before discarding dirty
  editors (Save / Don't Save / Cancel; Close All also offers Save All).
- Dropping files onto the browser app window offers the built-in "Upload
  Files..." flow to copy them into the workspace.

## Automatic updates (desktop)

Installed desktop builds check GitHub Releases for updates on startup and on
`Help ▸ Check for Updates...`. When an update is found it downloads in the
background and prompts to restart and install.

!!! warning "Windows installer"
    Updates apply only to the **default installation directory**. The
    installer does not offer a custom install location (assisted installer,
    fixed directory) so that `electron-updater` always knows where the app
    lives.