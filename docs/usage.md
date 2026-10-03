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

## Show Symbol, folding and the split view

`View ▸ Show Symbol` is where Notepad++ keeps the character markers, so all
four that map to Monaco live there:

- **Show Space and TAB** and **Show All Characters** write
  `editor.renderWhitespace` (`all` / `none`). Show All Characters is the
  umbrella: checking it turns on the space/tab *and* end-of-line markers, and
  unchecking it clears both.
- **Show End of Line** draws a `¶` after the last character of every line.
  Monaco has no end-of-line glyph, so it is a decoration whose stylesheet
  `::after` supplies the character.
- **Show Indent Guide** writes `editor.guides.indentation`.

These are written as editor **preferences**, not as options on the current
widget. The product pins `editor.renderWhitespace: "none"`, and Theia re-applies
that on every preference pass, so a `control.updateOptions()` call on one editor
is overwritten almost immediately - which is why the markers used to light the
check mark and draw nothing. A preference change also reaches every open editor
at once and survives a page reload, which is what you want from a view setting.
Monaco only draws the whitespace glyphs through its font renderer, so Show
Symbol also pins `editor.experimentalWhitespaceRendering` to `font`; its
default, `svg`, paints an overlay with no `.mwh` element to style.

Notepad++'s **Show Wrap Symbol** is not offered, because Monaco 1.75 has no
wrapping-indicator option to bind it to. Show All Characters is still available
from the toolbar.

### Folding

`View ▸ Fold All` (`Alt+0`) collapses every fold and `View ▸ Unfold All`
(`Alt+Shift+0`) opens them again. `View ▸ Fold Level` folds to a level:
`Alt+1` through `Alt+7` fold, and `Alt+Shift+1` through `Alt+Shift+7` unfold
back to it. Notepad++ lists eight levels, but Monaco registers folding actions
only for levels 1-7, so level 8 is left off rather than bound to an action that
does not exist.

### Split view and synchronized scrolling

`View ▸ Clone to Other View` shows the current file in a second pane, and
`View ▸ Move to Other View` moves it there so it is only in the other pane.
Notepad++'s constraint of exactly two panes is kept; closing the second pane
returns the file to a single view. With a second pane open, `View ▸
Synchronize Vertical Scrolling` and `View ▸ Synchronize Horizontal Scrolling`
mirror the two positions as you scroll either one, through a re-entrancy guard
so the pane that follows does not scroll the first one back.

### Full Screen and Post-It

`View ▸ Full Screen` (`F11`, or **Ctrl+Shift+F11** where the browser claims
F11) puts the whole application in the Fullscreen API. `View ▸ Post-It`
(`F12`) is Notepad++'s distraction-free mode: it hides the menu bar, toolbar,
tab bar and status bar, leaving the editor alone on the page. It is a real view
mode, not a one-off class, so it is remembered. Both restore cleanly.

### Summary...

`View ▸ Summary...` reports the document's characters, words, lines and
selected characters. It uses the same counters as the status bar's
`length : N lines : N` and `Sel` fields, so the dialog and the status bar
cannot disagree.

## The Window menu

`Window` lists the first ten open documents, numbered from one, in tab order.
Clicking one activates that tab. The list follows the open set, so it is
renumbered as documents are opened and closed; only the first ten appear, as in
Notepad++.

`Window ▸ Windows...` opens Notepad++'s document switcher: every open document
with its **Name**, **Path** and **Type** (`Text` when the name has no usable
extension), and the **Activate**, **Save**, **Close** and **Sort** buttons. Rows
are multi-selectable - Ctrl-click to add one, Shift-click for a range, or Space
with the keyboard - so **Save** and **Close** act on everything selected at
once. **Sort** cycles Name, Path and Type and reverses direction when it wraps.
The dialog is a real listbox: the arrow keys and Home/End move, Space toggles,
Enter activates the focused document, and double-clicking a row opens it.

The Document List panel (`View ▸ Document List`) and this menu read the same
model, so they always agree about what is open.

## New documents

`File ▸ New` (Ctrl+N, or **Ctrl+Alt+N** where the browser claims Ctrl+N) opens a
new untitled document named `new 1`, `new 2`, ... like Notepad++, in plain text
(no extension, no language detection).
Save As... (Ctrl+Shift+S) prompts for a real file name.

## Menus and commands

Notepadia adds the top-level menus `Search`, `Encoding`, `Language`, and
`Settings`, while the `File` and `Edit` menus gain Notepad++-style sections:

- **File**: New / **Open from Computer** / **Open from Workspace...** /
  **Upload to Workspace...** / **Open Folder as Workspace...** / Save /
  Save As / **Save a Copy As...** / Save All / **Reload from Disk** /
  **Rename...** / **Delete from Disk** / Close / Close All / Close All But
  Active, plus **Save To This Computer...** for the user's own disk (see
  [Files on your own computer](#files-on-your-own-computer)), plus
  **Recent Files** and **Set/Clear Read-Only**
  (see [Read-only documents](#read-only-documents)).
- **Edit**: Indent / Unindent / Duplicate Current Line / Delete Current Line /
  Move Current Line Up + Down / Join Lines / comment line, a **Line
  Operations** submenu, a **Convert Case** submenu, and the clipboard and
  selection groups: **Copy to Clipboard** (current full file path, current
  filename, current directory path), **Paste Special** (Paste and Indent, Paste
  and Unindent, Paste Unformatted), **Select** (Select All, Begin/End Select,
  Multi-Select All, with Match case and Whole word variants), **Insert ▸ Date &
  Time** (short, long, customized), and the two panels at the foot,
  **Clipboard History** and **Character Panel**. **Bookmarks** are also under
  Edit.
- **Search**: Find / Find Next / Find Previous / Replace / Find in Files /
  Replace in Files / Mark, plus a **Mark** submenu (Mark All, Clear All Marks,
  Select and Find Next).
- **View**: Zoom, Tab Size, **Show Symbol** (Show Space and TAB, Show All
  Characters, Show End of Line, Show Indent Guide), **Fold All** / **Unfold
  All**, a **Fold Level** submenu, Document Map, Document List, **Clone to
  Other View** / **Move to Other View**, **Synchronize Vertical Scrolling** /
  **Synchronize Horizontal Scrolling**, **Summary...**, **Full Screen**,
  **Post-It**, Word Wrap, Toolbar, Status Bar and a **Tab Bar** submenu (see
  [Show Symbol, folding and the split view](#show-symbol-folding-and-the-split-view)).
- **Window**: the first ten open documents, numbered from one, and **Windows...**
  (see [The Window menu](#the-window-menu)).

Text manipulation reuses Monaco's hardened editing engine through
`editor.action.*` triggers instead of bespoke string rewriting.

## Working on a file

Four File-menu entries act on the file behind the current tab. Each one goes
through Theia's `FileService`, so the tab, the Files tree and the bytes on disk
agree afterwards:

- **Reload from Disk** throws away what is on screen and re-reads the file. It
  asks first, and only when the tab has unsaved changes.
- **Save a Copy As...** writes the current buffer to a file you name and leaves
  the tab on the file it already had, so the next `Ctrl+S` still goes to the
  original. This is the way to get an untitled buffer out of the browser: a copy
  of `new 1` is offered as `new 1.txt`.
- **Rename...** moves the file and moves the tab with it, carrying unsaved text
  across, so a save after the rename writes to the new name. A relative path is
  allowed (`sub/notes.txt` moves the file into a subfolder) but `..` and
  absolute paths are refused: a command called "Rename" should not also be a way
  to move a file out of the folder you are looking at. Renaming onto an existing
  file asks before replacing it.
- **Delete from Disk** removes the file and closes the tab, always after a
  confirmation that names the file, and says so when unsaved changes will go
  with it.

**Open Folder as Workspace...** picks a directory as the workspace root. It is
Theia's own folder chooser, kept in the menu under a name that says what it
does.

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
| Ctrl+Alt+O | Open from Computer (browser-safe) |
| Ctrl+= / Ctrl+- / Ctrl+0 | Zoom in / zoom out / reset the editor text |
| Ctrl+Alt+B | Begin/End Select |
| Alt+C | Column Mode |
| F5 / Ctrl+F5 | Insert Date & Time (short / long) |
| Ctrl+Alt+D | Insert Date & Time (browser-safe short) |
| Ctrl+Alt+Shift+D | Insert Date & Time (browser-safe long) |
| Ctrl+Alt+R | Set/Clear Read-Only |
| Alt+0 / Alt+Shift+0 | Fold all / unfold all |
| Alt+1..7 / Alt+Shift+1..7 | Fold / unfold to level |
| F11 / Ctrl+Shift+F11 | Full Screen |
| F12 | Post-It (distraction-free) |
| Ctrl+Alt+Shift+V | Synchronize vertical scrolling |
| Ctrl+Alt+Shift+H | Synchronize horizontal scrolling |

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
| Ctrl+O | Open File... (the browser's own file dialog) | Open from Computer (the app's own picker) | **Ctrl+Alt+O** |
| Ctrl+Shift+O | bookmark all tabs (Chromium) | - | nothing is bound to it |
| Ctrl+T | new browser tab | - | nothing is bound to it |
| Ctrl+Shift+N | incognito window | - | nothing is bound to it |
| Ctrl+Shift+T | reopen the last closed tab | - | nothing is bound to it |
| F5 | reload the page (Chromium) | Insert Date & Time (short) | **Ctrl+Alt+D** |
| Ctrl+F5 | hard reload, skipping the cache (Chromium) | Insert Date & Time (long) | **Ctrl+Alt+Shift+D** |
| Ctrl+Shift+R | hard reload in Firefox | - | nothing is bound to it |
| Ctrl+= / Ctrl+- / Ctrl+0 | page zoom | editor zoom | same chord, editor focused |

Nothing was taken away: `Ctrl+N`, `Ctrl+W`, `Ctrl+Shift+W`, `Ctrl+O`, `F5` and
`Ctrl+F5` are still bound and still work in the desktop app, where no browser
claims them. The alternates are added alongside them.

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
- the mode indicator `INS` / `OVR`, which reads `Read-Only` instead while a
  document is flagged read-only (see
  [Read-only documents](#read-only-documents))

Pressing `Insert` (or clicking the mode indicator) toggles overtype mode.
In OVR the caret becomes a block and each character you type replaces the
character under the cursor instead of inserting, exactly like Notepad++ —
typing at the end of a line just inserts normally. Toggling back to INS
restores insert behavior. The status bar is throttled to render once per
animation frame, so it stays responsive even in very large files.

## Clipboard, paste and selection

Notepad++'s clipboard and selection commands are all here, and all of them
work on the buffer rather than on a string the app keeps beside it.

**Edit ▸ Copy to Clipboard** copies *where the document is*, because the text
itself is already on the clipboard after any ordinary Copy:

| Entry | What lands on the clipboard |
| --- | --- |
| Current Full File Path | the whole path, e.g. `/home/you/notes/todo.txt` |
| Current Filename | just the name, e.g. `todo.txt` |
| Current Directory Path | the folder, with no trailing separator |

The three are disabled while an untitled document is active, because it has no
path to report.

**Edit ▸ Paste Special** pastes at the caret and then fixes the indentation,
comparing against the line above:

- **Paste and Indent** lines the first pasted line up with the line above the
  caret, which is what puts a copied block into an indented file at the right
  column. A line above with no indentation leaves the clipboard alone:
  "not indented here" is not a request to strip what was copied.
- **Paste and Unindent** is the mirror image - it removes that same run of
  spaces or tabs from the start of the pasted text, so copying an indented
  block and pasting it next to indented code does not double the indent.
- **Paste Unformatted** inserts the `text/plain` flavour of the clipboard as it
  stands. In a plain-text editor there is no formatting to strip, so this is
  the same as an ordinary Paste; it is here for the muscle memory.

`Paste Special` needs to *read* the clipboard, which a browser only allows
from a secure context and only after the user has granted permission. Served
over `https` or from `localhost` it works; opened as a plain `http://` page
from another machine it cannot, and the app says so in a message instead of
silently pasting nothing. `Ctrl+V` is unaffected and always works.

**Edit ▸ Select** holds the selection commands:

- **Select All** is `Ctrl+A`, unchanged.
- **Begin/End Select** (`Ctrl+Alt+B`) works the way Notepad++'s does: the first
  press drops an anchor where the caret is, every move from then on extends the
  selection from that anchor rather than from the caret, and a second press
  leaves the selection on screen and forgets the anchor. The anchor belongs to
  the document, so switching tabs and back keeps it, and it stays armed until
  that second press - so give it one before you go back to placing a plain
  caret, or the next move you make will grow the selection again.
- **Multi-Select All** puts a cursor on every occurrence of the word under the
  caret - no selection needed, which is what makes it useful. **Match case**
  only finds the same casing, and **Whole word** skips occurrences inside a
  longer word. At most 1000 matches are selected, and saying so is better than
  freezing the editor on a file with a million of them.

**Edit ▸ Line Operations ▸ Column Mode** (`Alt+C`) turns the current selection
into a rectangular block: the selection's columns are applied to every line it
covers, and typing then edits every cell at once. Monaco already does this with
`Alt` + drag, so this is for the people who do not know about the modifier.
Unlike Notepad++, no dialog opens - the command is the conversion, and a
`...` on a menu entry should mean "you are about to be asked something".

**Edit ▸ Insert ▸ Date & Time** puts a timestamp at every caret:

- **Date & Time (short)** (`F5`) inserts `HH:mm:ss dd/MM/yyyy`.
- **Date & Time (long)** (`Ctrl+F5`) inserts `ddd, MMM d, yyyy h:mm tt`, which
  comes out as `Mon, Sep 30, 2026 2:35 PM`.
- **Date & Time (customized)...** asks for a format string. The tokens are
  `yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dddd`, `ddd`, `dd`, `d`, `HH`, `H`,
  `hh`, `h`, `mm`, `m`, `ss`, `s` and `tt` (`AM` / `PM`). `MM` is always the
  month and `mm` is always the minutes - Windows' own `strftime` has to guess
  from the token before it, and nobody remembers that rule. Text in single
  quotes is literal, so `yyyy'-'MM'-'dd` gives `2026-09-30`, and `''` is a
  literal apostrophe. A format with no token in it is refused with a reason,
  rather than inserting the same constant string every time you use it.

## Clipboard History

`Edit ▸ Clipboard History` opens a panel listing what you have copied in this
session, newest first, up to 20 entries. Click one to put it back at the caret,
as a single undoable edit applied at every cursor.

The list is filled by the editor's own `copy` and `cut` events, so it records
what actually went to the clipboard — including copies made with `Ctrl+C` from
anywhere in the app, not only from a Notepadia command. Copies made outside the
app's window cannot be observed by a web page and are not recorded, and the
list is per session: it is not written to disk.

`Clear` empties it, and the panel closes the same way it opened, from the same
menu entry.

## Read-only documents

`File ▸ Set/Clear Read-Only` (`Ctrl+Alt+R`) flags the current document
read-only, and clears the flag when it is already set. This is the one
Notepad++ read-only entry that is a toggle, so it is labelled as one; the tab
context menu and a future "Clear Read-Only Flag" split are not duplicated
here.

While a document is flagged:

- typing, pasting and every editing command are rejected by the editor itself,
  not by the app deciding to ignore them - so nothing slips through a shortcut
  the app did not know about
- the tab shows the padlock icon
- the status bar mode indicator reads `Read-Only` instead of `INS` / `OVR`

The flag belongs to the document path, not to the tab, and lasts for the
session. Reopening the same file keeps it flagged; opening a different file
does not inherit it. An untitled document can be flagged too, and is tracked
separately.

## Character Panel

`Edit ▸ Character Panel` opens the Notepad++ panel that holds the special
characters Notepad++ ships - arrows, boxes, blocks, currency and mathematical
signs - grouped by category. Clicking one puts that character into the document
at the caret, so a character that has no key on this keyboard can still be
typed. The panel is also under `View`, which is where Notepad++ keeps it; both
entries run the same command and only one of them can be showing at a time.

## Files on your own computer

Notepad++'s `File ▸ Open` and `File ▸ Save` always mean **the disk of the
machine you are sitting at**. Notepadia is a browser app served by another
machine, so it has two entirely separate storages and the menu names them
explicitly. Nothing else in the UI is ambiguous about this:

**`Open` is the user's own disk, everywhere.** The `File` menu entry, the
toolbar's Open button and `Ctrl+O` are one command with one label —
`Open from Computer` — and all three open a file picker on your machine. The
server workspace keeps its own entry, `Open from Workspace...`, which says which
filesystem it browses. No control in the application is labeled `Open...`, so
the verb can never resolve to two different places.

| Command | Reads from | Creates / writes to | Changes the tab? |
| --- | --- | --- | --- |
| `Open from Computer` (File menu, toolbar button, `Ctrl+O`) | **your disk** | a new in-browser tab (nothing is written to the server) | opens a new tab |
| `Open from Workspace...`, `Save`, `Save As...`, `Save All` | server workspace | server workspace | yes |
| `Save To This Computer...` | the open tab | **a copy on your disk** | no |
| `Upload to Workspace...` | **your disk** | server workspace | opens the uploaded file |

On Chromium, `Open from Computer` keeps the handle to the file it
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

| Browser | Reading (`Open from Computer`) | Writing (`Save To This Computer...`) | Ctrl+S write-back |
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