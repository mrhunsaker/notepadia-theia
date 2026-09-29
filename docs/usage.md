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

`File ▸ New` (Ctrl+N, or **Ctrl+Alt+N** where the browser claims Ctrl+N) opens a
new untitled document named `new 1`, `new 2`, ... like Notepad++, in plain text
(no extension, no language detection).
Save As... (Ctrl+Shift+S) prompts for a real file name.

## Menus and commands

Notepadia adds the top-level menus `Search`, `Encoding`, `Language`, and
`Settings`, while the `File` and `Edit` menus gain Notepad++-style sections:

- **File**: New / Open / Save / Save As / Save All / Close / Close All /
  Close All But Active, plus **Open From This Computer...** /
  **Upload to Workspace...** / **Save To This Computer...** for the user's own
  disk (see [Files on your own computer](#files-on-your-own-computer)), plus
  **Recent Files**.
- **Edit**: Indent / Unindent / Duplicate Current Line / Delete Current Line /
  Move Current Line Up + Down / Join Lines / comment line, a **Line
  Operations** submenu, and a **Convert Case** submenu. **Bookmarks** are
  also under Edit.
- **Search**: Find / Find Next / Find Previous / Replace / Find in Files /
  Replace in Files / Mark, plus a **Mark** submenu (Mark All, Clear All Marks,
  Select and Find Next).

Text manipulation reuses Monaco's hardened editing engine through
`editor.action.*` triggers instead of bespoke string rewriting.

## The Find dialog

`Ctrl+F`, `Ctrl+H`, `Ctrl+Shift+F` and `Ctrl+M` all open the same modeless
dialog with four Notepad++ tabs — **Find**, **Replace**, **Find in Files** and
**Mark**. The dialog floats over the editor and is not modal, so you can keep
typing while it is open. Monaco's inline find widget is disabled; `Escape`
closes the dialog from the editor, the menu bar or anywhere else.

Shared controls: **Find what**, **Search Mode** (Normal / Extended /
Regular expression), the options checkboxes (Match case, Match whole word
only, Backward direction, Wrap around, In selection) and a status line
reporting the match position, e.g. `2 of 4` or `4 results on current document`.

- **Find**: `Find Next`, `Count`, `Find All in Current Document` (selects
  every hit) and `Find All in All Opened Documents`.
- **Replace**: `Replace`, `Replace All` and `Replace All in All Opened
  Documents`, all of which are ordinary undoable edits.
- **Find in Files**: `Filters` and `Directory` narrow the workspace search,
  `In hidden folders` includes dot-folders, and `Find All` / `Replace All`
  drive the existing search-in-workspace backend.
- **Mark**: marks every occurrence in the current document in one of five
  styles, with `Mark All`, `Clear All Marks`, `Select and Find Next` and a
  `Purge for each search` option. The same actions remain available under
  `Search ▸ Mark`.

!!! note
    The editor's search engine matches within a single line, so the
    `. matches newline` option is shown disabled with an explanation rather
    than silently doing nothing. Notepad++ supports it; this build does not.

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
| Ctrl+F | Open the tabbed Find dialog (Find tab) |
| Ctrl+H | Open the tabbed Find dialog (Replace tab) |
| Ctrl+Shift+F | Open the tabbed Find dialog (Find in Files tab) |
| Ctrl+M | Open the tabbed Find dialog (Mark tab) |
| Insert | Toggle INS/OVR (overtype) mode |
| Ctrl+Alt+N | New document (browser-safe) |
| Ctrl+F4 | Close document (browser-safe) |
| Ctrl+Alt+Shift+W | Close all documents (browser-safe) |
| Ctrl+Alt+O | Open From This Computer... (browser-safe) |
| Ctrl+= / Ctrl+- / Ctrl+0 | Zoom in / zoom out / reset the editor text |

!!! note
    The editor is forced onto the classic textarea input path
    (`editContext: false`) so Theia's own keybinding layer stays
    deterministic. The Ctrl+D / Ctrl+L chords are mirrored into Monaco's
    keybinding service as a fallback.

`Settings ▸ Shortcut Mapper` opens Theia's own shortcut editor, which lists
every registered chord and rebinds it. Nothing in this app is reachable only by
keyboard: each command is also a menu entry.

### Shortcuts the browser claims

In a browser tab some of the chords a text editor is expected to own never
reach the page, because the browser acts on them first. A web app cannot
intercept them, and cannot unbind them either, so each one that Notepad++ uses
for something has an alternate chord that the browser leaves alone:

| Chord | What the browser does with it | What it is in Notepad++ | Use |
| --- | --- | --- | --- |
| Ctrl+N | new browser window (Chromium) / new tab (Firefox) | New document | **Ctrl+Alt+N** |
| Ctrl+W | close the browser tab | Close document | **Ctrl+F4** |
| Ctrl+Shift+W | close the browser window | Close All | **Ctrl+Alt+Shift+W** |
| Ctrl+O | Open File... (the browser's own file dialog) | Open From This Computer... | **Ctrl+Alt+O** |
| Ctrl+Shift+O | bookmark all tabs (Chromium) | - | nothing is bound to it |
| Ctrl+T | new browser tab | - | nothing is bound to it |
| Ctrl+Shift+N | incognito window | - | nothing is bound to it |
| Ctrl+Shift+T | reopen the last closed tab | - | nothing is bound to it |
| Ctrl+= / Ctrl+- / Ctrl+0 | page zoom | editor zoom | same chord, editor focused |

Nothing was taken away: `Ctrl+N`, `Ctrl+W`, `Ctrl+Shift+W` and `Ctrl+O` are still
bound and still work in the desktop app, where no browser claims them. The
alternates are added alongside them.

The zoom chords are the one place where both meanings are wanted, so the
division is by focus rather than by chord:

- **Editor has focus** - `Ctrl+=` grows the editor text, `Ctrl+-` shrinks it and
  `Ctrl+0` resets it, and the page does not zoom.
- **Anything else has focus** - the menubar, the tab bar, the folder panel -
  the browser keeps its own page zoom.

`Alt` is left alone throughout, because `Ctrl+Alt` is `AltGr` on Windows
keyboard layouts and those chords belong to the layout, not to the app.

!!! note "How this list was checked"
    The automated browser tests cannot confirm which chords a browser reserves:
    Puppeteer injects key events over the DevTools protocol, which delivers them
    straight to the page and bypasses the browser's accelerator handling
    entirely. The table therefore records standard Chromium and Firefox
    behaviour, and the automated tests cover the parts that *are* reachable -
    that each alternate opens the right thing, and that the editor zoom wins
    while the editor has focus. Re-check the table by hand after a major
    browser upgrade.

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

## Status bar and INS/OVR overtype mode

The status bar shows the Notepad++ fields, live, left to right:

- the language name (clickable to change language mode)
- the caret position as `Ln : 3  Col : 12  Pos : 47` — 1-based line and
  column with the 0-based character offset, thousands-grouped
- the selection size as `Sel : 18 | 2` (characters | lines); with no
  selection it reads `Sel : 0 | 0`
- the document size as `length : 1,234  lines : 56` (length includes the
  line endings)
- the encoding (clickable) and the EOL (clickable)
- the indent mode (`Spaces: 4` / `Tabs: 4`)
- the mode indicator `INS` / `OVR`

Pressing `Insert` (or clicking the mode indicator) toggles overtype mode.
In OVR the caret becomes a block and each character you type replaces the
character under the cursor instead of inserting, exactly like Notepad++ —
typing at the end of a line just inserts normally. Toggling back to INS
restores insert behavior. The status bar is throttled to render once per
animation frame, so it stays responsive even in very large files.

## Files on your own computer

Notepad++'s `File ▸ Open` and `File ▸ Save` always mean **the disk of the
machine you are sitting at**. Notepadia is a browser app served by another
machine, so it has two entirely separate storages and the menu names them
explicitly. Nothing else in the UI is ambiguous about this:

| Command | Reads from | Creates / writes to | Changes the tab? |
| --- | --- | --- | --- |
| `Open...`, `Save`, `Save As...`, `Save All` | server workspace | server workspace | yes |
| `Open From This Computer...` | **your disk** | a new in-browser tab (nothing is written to the server) | opens a new tab |
| `Save To This Computer...` | the open tab | **a copy on your disk** | no |
| `Upload to Workspace...` | **your disk** | server workspace | opens the uploaded file |

On Chromium, `Open From This Computer...` keeps the handle to the file it
picked, so **Ctrl+S on that tab writes straight back to the same file on your
disk** instead of asking for a server-side name. The tab is titled with the
real file name (`notes.txt`), not `new 1`, and a second copy of the same name
opens as `notes (2).txt`.

`Save To This Computer...` never changes the tab. It asks where to write, and on
a browser without the picker it falls back to an ordinary download, so you end up
with a copy on your disk and the tab untouched.

`Upload to Workspace...` is the deliberate route for getting a file *into* the
server workspace, where the Files tree, Find in Files and every other
workspace-aware feature can see it. It is the working replacement for Theia's
own `Upload Files...` command, which is only enabled when a node happens to be
selected in the Files tree and is therefore a dead entry in the File menu.

A cancelled picker is never treated as an error: closing the dialog does
nothing at all. If the browser refuses write permission, the message names the
file that was not saved.

### Browser support

| Browser | Reading (`Open From This Computer...`) | Writing (`Save To This Computer...`) | Ctrl+S write-back |
| --- | --- | --- | --- |
| Chromium 99+ (Chrome, Edge, Opera, Brave) | OS picker, file handle kept | OS picker, writes to the picked file | yes, to the original file |
| Firefox, Safari | OS picker via `<input type="file">` | browser download | no - Ctrl+S offers Save As |

The File System Access API needs a **secure context**, so `https://` or
`http://localhost`. On plain `http://` the app automatically falls back to the
upload/download route.

!!! note "Ctrl+Alt+O, not Ctrl+O"
    Notepad++ opens local files with Ctrl+O, but the browser claims Ctrl+O (and
    Ctrl+Shift+O, which is bookmark-all-tabs in Chromium) before the page ever
    sees the key, and a web app cannot intercept either. `Ctrl+Alt+O` is bound
    instead - see [Shortcuts the browser
    claims](#shortcuts-the-browser-claims) - and the command is in the File menu
    as always.

## Recent Files

`File ▸ Recent Files` lists recently opened editors (most recent first,
deduplicated, capped at 15) with a `Clear Recent Files` entry. History
survives reloads via localStorage.

## Unsaved changes and drag-and-drop

- `File ▸ Close` and `File ▸ Close All` confirm before discarding dirty
  editors (Save / Don't Save / Cancel; Close All also offers Save All).
- Dropping files onto the browser app window offers the built-in "Upload
  Files..." flow to copy them into the workspace.

## Recovering unsaved work

Asking before you close a tab only helps if the tab is still there. A crash, a
killed browser tab, or closing a document by accident left nothing behind: the
text existed only in memory. Notepadia now keeps a copy.

- **Every few seconds of typing, a copy of what is unsaved is written to this
  browser's own storage** (IndexedDB, in the page — nothing is sent to the
  server and no other user can see it). The copy is taken after you pause, so
  it is a whole document rather than a fragment, and only for documents with
  unsaved changes.
- **The next time you open Notepadia, those documents come back.** A recovered
  tab is marked dirty on purpose: the text is in the editor but not yet on
  disk, so `Ctrl+S` is how you keep it, and nothing is written for you.
- **Saving clears the copy**, and so does discarding the changes on purpose
  (`Don't Save`, or reverting the document). What you threw away does not come
  back the next morning.
- **A file that changed on disk since the copy was taken is not restored over.**
  If the file is newer than the copy, the newer version wins and the copy is
  dropped, so a recovery can never overwrite a file that moved on.
- **Two settings control it**, in `Settings ▸ notepadia.backup`:
  `notepadia.backup.enabled` (on by default) turns the whole feature off, and
  `notepadia.backup.intervalSeconds` (5 by default) is how many seconds to wait
  after the last keystroke before taking the copy. Turning the feature off does
  not delete copies that already exist; it just stops taking new ones.
- **Large documents are skipped rather than stored.** A document over 2 MB is
  not backed up, and the total kept across all documents is capped at 8 MB,
  oldest copy first. A copy of a document that has since grown past the limit is
  dropped rather than left behind stale.

The copies are per-browser: they live in the profile of the browser you are
using, they are not synchronized, and clearing that browser's site data removes
them. Use `Save` for anything you cannot afford to lose.

## Automatic updates (desktop)

Installed desktop builds check GitHub Releases for updates on startup and on
`Help ▸ Check for Updates...`. When an update is found it downloads in the
background and prompts to restart and install.

!!! warning "Windows installer"
    Updates apply only to the **default installation directory**. The
    installer does not offer a custom install location (assisted installer,
    fixed directory) so that `electron-updater` always knows where the app
    lives.