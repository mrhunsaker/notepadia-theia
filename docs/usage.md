# User guide

A tour of the Notepad++-style behavior implemented by the `notepadia`
extension, organized by the menu tree a Notepad++ user already knows. Each
menu section lists its entries with the chord (if any) and whether the
browser gets in the way; the prose below each table is the detail. Browser-only
limitations are collected in one place in
[Differences from Notepad++](differences.md); the tables here just point at
them.

The menu tree is Notepad++'s:

| Place | Menu |
| --- | --- |
| 1 | **File** |
| 2 | **Edit** |
| 3 | **Search** |
| 4 | **View** |
| 5 | **Encoding** |
| 6 | **Language** |
| 6b | **Macros** |
| 6c | **Run** |
| 6d | **Window** |
| 7 | **Settings** |

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

## File menu

| Entry | Chord | Browser-limited? |
| --- | --- | --- |
| New | `Ctrl+N`, **or `Ctrl+Alt+N`** | yes, see below |
| Open from Computer | `Ctrl+O`, **`Ctrl+Alt+O`** | yes, see below |
| Open from Workspace... | - | no |
| Upload to Workspace... | - | no |
| Save | `Ctrl+S` | no |
| Save As... | `Ctrl+Shift+S` | no |
| Save a Copy As... | - | no |
| Save All | - | no |
| Save Session... / Load Session... | - | no |
| Reload from Disk | - | no |
| Rename... | - | no |
| Delete from Disk | - | no |
| Close | `Ctrl+F4` | yes, see below |
| Close All | `Ctrl+Alt+Shift+W` | yes, see below |
| Print | - | no |
| Print Preview... | - | no |
| Open Folder as Workspace... | - | no |
| Recent Files | - | no |
| Set/Clear Read-Only | `Ctrl+Alt+R` | no |
| Save To This Computer... | - | yes, see below |

See [Shortcuts the browser claims](#shortcuts-the-browser-claims) for the
`Ctrl+N` / `Ctrl+O` / `Ctrl+W` / `Ctrl+Shift+W` pairings, and [Files on your
own computer](#files-on-your-own-computer) for `Open from Computer` /
`Save To This Computer...` / `Upload to Workspace...`.

### New documents

`File ▸ New` (`Ctrl+N`, or **`Ctrl+Alt+N`** where the browser claims `Ctrl+N`)
opens a new untitled document named `new 1`, `new 2`, ... like Notepad++, in
plain text (no extension, no language detection). Save As... (`Ctrl+Shift+S`)
prompts for a real file name.

### Working on a file

Four File-menu entries act on the file behind the current tab. Each one goes
through Theia's `FileService`, so the tab, the Files tree and the bytes on
disk agree afterwards:

- **Reload from Disk** throws away what is on screen and re-reads the file. It
  asks first, and only when the tab has unsaved changes.
- **Save a Copy As...** writes the current buffer to a file you name and leaves
  the tab on the file it already had, so the next `Ctrl+S` still goes to the
  original. This is the way to get an untitled buffer out of the browser: a
  copy of `new 1` is offered as `new 1.txt`.
- **Rename...** moves the file and moves the tab with it, carrying unsaved text
  across, so a save after the rename writes to the new name. A relative path is
  allowed (`sub/notes.txt` moves the file into a subfolder) but `..` and
  absolute paths are refused: a command called "Rename" should not also be a
  way to move a file out of the folder you are looking at. Renaming onto an
  existing file asks before replacing it.
- **Delete from Disk** removes the file and closes the tab, always after a
  confirmation that names the file, and says so when unsaved changes will go
  with it.

**Open Folder as Workspace...** picks a directory as the workspace root. It is
Theia's own folder chooser, kept in the menu under a name that says what it
does.

### Read-only documents

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

### Sessions and recent files

`File ▸ Save Session...` / `Load Session...` write and restore a named session
file: the open tab set, order, active tab, caret positions and bookmarks.
`File ▸ Recent Files` lists recently opened editors (most recent first,
deduplicated, capped at 15) with a `Clear Recent Files` entry; that history
survives reloads via localStorage.

### Unsaved changes and drag-and-drop

- `File ▸ Close` and `File ▸ Close All` confirm before discarding dirty editors
  (Save / Don't Save / Cancel; Close All also offers Save All).
- Dropping files onto the browser app window offers the built-in "Upload
  Files..." flow to copy them into the workspace.

### Files on your own computer

Notepad++'s `File ▸ Open` and `File ▸ Save` always mean **the disk of the
machine you are sitting at**. Notepadia is a browser app served by another
machine, so it has two entirely separate storages and the menu names them
explicitly. Nothing else in the UI is ambiguous about this:

**`Open` is the user's own disk, everywhere.** The `File` menu entry, the
toolbar's Open button and `Ctrl+O` are one command with one label —
`Open from Computer` — and all three open a file picker on your machine. The
server workspace keeps its own entry, `Open from Workspace...`, which says
which filesystem it browses. No control in the application is labeled
`Open...`, so the verb can never resolve to two different places.

| Command | Reads from | Creates / writes to | Changes the tab? |
| --- | --- | --- | --- |
| `Open from Computer` (File menu, toolbar button, `Ctrl+O`) | **your disk** | a new in-browser tab (nothing is written to the server) | opens a new tab |
| `Open from Workspace...`, `Save`, `Save As...`, `Save All` | server workspace | server workspace | yes |
| `Save To This Computer...` | the open tab | **a copy on your disk** | no |
| `Upload to Workspace...` | **your disk** | server workspace | opens the uploaded file |

On Chromium, `Open from Computer` keeps the handle to the file it picked, so
**Ctrl+S on that tab writes straight back to the same file on your disk**
instead of asking for a server-side name. The tab is titled with the real file
name (`notes.txt`), not `new 1`, and a second copy of the same name opens as
`notes (2).txt`.

`Save To This Computer...` never changes the tab. It asks where to write, and
on a browser without the picker it falls back to an ordinary download, so you
end up with a copy on your disk and the tab untouched.

`Upload to Workspace...` is the deliberate route for getting a file *into* the
server workspace, where the Files tree, Find in Files and every other
workspace-aware feature can see it. It is the working replacement for Theia's
own `Upload Files...` command, which is only enabled when a node happens to be
selected in the Files tree and is therefore a dead entry in the File menu.

A cancelled picker is never treated as an error: closing the dialog does
nothing at all. If the browser refuses write permission, the message names the
file that was not saved.

#### Browser support

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
    claims](#shortcuts-the-browser-claims) - and the command is in the File
    menu as always.

## Edit menu

| Entry | Chord | Browser-limited? |
| --- | --- | --- |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` | no |
| Cut / Copy / Paste | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | no |
| **Copy to Clipboard** group | - | no |
| **Paste Special** group | - | yes, clipboard read, see below |
| Indent / Unindent | - | no |
| Duplicate Current Line | `Ctrl+D` | no |
| Delete Current Line | `Ctrl+L` | no |
| Move Current Line Up / Down | - | no |
| Join Lines | `Ctrl+J` | no |
| Toggle Comment | - | no |
| **Select** group | `Ctrl+A`, `Ctrl+Alt+B` | no |
| **Line Operations** submenu | see below | no |
| **Convert Case** submenu | `Ctrl+Shift+U`, `Ctrl+U` | no |
| **Insert ▸ Date & Time** | `F5`, `Ctrl+F5`, `Ctrl+Alt+D`, `Ctrl+Alt+Shift+D` | yes, `F5`, `Ctrl+F5`, see below |
| **Blank Operations** submenu | - | no |
| **EOL Conversion** submenu | - | no |
| **Bookmarks** submenu | `Ctrl+F2`, `F2`, `Shift+F2` | no |
| **Clipboard History** panel | - | no |
| **Character Panel** | - | no |

`Paste Special` needs to *read* the clipboard, which a browser only allows from
a secure context and only after the user has granted permission. Served over
`https` or from `localhost` it works; opened as a plain `http://` page from
another machine it cannot, and the app says so in a message instead of
silently pasting nothing. `Ctrl+V` is unaffected and always works.

`Insert ▸ Date & Time` is bound to `F5` / `Ctrl+F5` in the desktop app; in the
browser those are the reload chords, so `Ctrl+Alt+D` / `Ctrl+Alt+Shift+D` are
added (see [Shortcuts the browser claims](#shortcuts-the-browser-claims)).

### Line Operations

`Edit ▸ Line Operations` holds Notepad++'s bulk line editing commands, all
undoable (the single-line commands - Indent, Duplicate, Delete, Move, Join,
Toggle Comment - sit directly in the Edit menu above this submenu):

- **Split Lines** splits each selected line at the caret column, or every line
  at its longest common prefix when there is no selection.
- **Remove Consecutive Duplicate Lines** deletes duplicate lines that are
  adjacent, leaving the first of each run; **Remove Duplicate Lines** catches
  duplicates anywhere in the selection, not just neighbours.
- **Sort Lines Ascending** / **Descending** and **Reverse Lines** reorder the
  selected lines; with no selection the whole document is sorted.
- **Trim Trailing Whitespace** strips trailing spaces and tabs from every
  selected line (there is also `Edit ▸ Blank Operations` for the leading end).
- **Column Editor...** opens Notepad++'s column dialog: insert a fixed text
  string, a number sequence with its own initial value and increment (with or
  without leading zeros), or a repeated text down the current selection.
- **Column Mode** (`Alt+C`) turns the current selection into a rectangular
  block: the selection's columns are applied to every line it covers, and
  typing then edits every cell at once. Monaco already does this with `Alt` +
  drag, so this is for the people who do not know about the modifier. Unlike
  Notepad++, no dialog opens - the command is the conversion, and a `...` on a
  menu entry should mean "you are about to be asked something".

### Blank Operations

`Edit ▸ Blank Operations` holds Notepad++'s whitespace helpers, all working on
the buffer through Monaco's edit engine (so each is undoable):

- **Tab to Space** converts the leading tabs of each selected line to spaces,
  and **Space to Tab** converts leading spaces back to tabs, both against the
  current tab width.
- **Trim Leading and Trailing Space** strips both ends of every selected line;
  **Trim Trailing Space** only the end.
- **EOL to Space** replaces the line endings of the selected lines with
  spaces, joining them.
- **Remove Unnecessary EOL** removes the line-endings that mark empty lines.

### Convert Case

`Edit ▸ Convert Case` registers the two single-shot conversions whose effect
depends only on the selected text:

| Entry | Chord | Effect |
| --- | --- | --- |
| UPPER CASE | `Ctrl+Shift+U` | every selected character uppercased |
| lower case | `Ctrl+U` | every selected character lowercased |

Notepad++ also offers `Title Case`, `Sentence case`, `invert case` and
`ranDOM cASE`; those are not registered here (see
[Differences from Notepad++](differences.md)).

### Copy to Clipboard

Covers Notepad++'s `Copy to Clipboard` group, which copies *where the document
is*, because the text itself is already on the clipboard after any ordinary
Copy:

| Entry | What lands on the clipboard |
| --- | --- |
| Current Full File Path | the whole path, e.g. `/home/you/notes/todo.txt` |
| Current Filename | just the name, e.g. `todo.txt` |
| Current Directory Path | the folder, with no trailing separator |

The three are disabled while an untitled document is active, because it has no
path to report.

### Paste Special

`Edit ▸ Paste Special` pastes at the caret and then fixes the indentation,
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

### Select

`Edit ▸ Select` holds the selection commands:

- **Select All** is `Ctrl+A`, unchanged.
- **Begin/End Select** (`Ctrl+Alt+B`) works the way Notepad++'s does: the
  first press drops an anchor where the caret is, every move from then on
  extends the selection from that anchor rather than from the caret, and a
  second press leaves the selection on screen and forgets the anchor. The
  anchor belongs to the document, so switching tabs and back keeps it, and it
  stays armed until that second press - so give it one before you go back to
  placing a plain caret, or the next move you make will grow the selection
  again.
- **Multi-Select All** puts a cursor on every occurrence of the word under the
  caret - no selection needed, which is what makes it useful. **Match case**
  only finds the same casing, and **Whole word** skips occurrences inside a
  longer word. At most 1000 matches are selected, and saying so is better than
  freezing the editor on a file with a million of them.

### Line endings (EOL)

`Edit ▸ EOL Conversion` offers, in menu order:

- `Convert to Windows Format (CRLF)`
- `Convert to Unix Format (LF)`
- `Change Line Endings...` - a quick-pick offering the same two targets, also
  reachable by clicking the EOL entry in the status bar.

The two conversions transform the buffer with Monaco's `setEOL` and are
undoable.

!!! tip
    Only LF and CRLF are offered. Monaco's line model splits on `\n`, so
    classic CR cannot be a separator inside the editor; CR files are
    detected and shown as `CR` in the status bar.

### Bookmarks

- `Ctrl+F2` toggles a bookmark on the current line.
- `F2` / `Shift+F2` jump to the next / previous bookmark (wrapping).
- `Edit ▸ Bookmarks ▸ Clear All Bookmarks` empties the current file's set.

Bookmarks are per-model (keyed by URI), session-scoped, and rendered as
glyphs in the line-number gutter.

### Insert ▸ Date & Time

`Edit ▸ Insert ▸ Date & Time` puts a timestamp at every caret:

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

## Search menu

| Entry | Chord | Browser-limited? |
| --- | --- | --- |
| Find... | `Ctrl+F` | no |
| Find Next / Find Previous | `F3` / `Shift+F3` | no |
| Replace... | `Ctrl+H` | no |
| Find in Files... | `Ctrl+Shift+F` | no |
| Replace in Files... | - | no |
| Mark... | `Ctrl+M` | no |
| **Mark** submenu (Mark All, Clear All Marks, Select and Find Next) | - | no |
| Go To Line... | - | no |
| Matching Bracket | - | no |
| Incremental Search | `Ctrl+Alt+I` | no |
| Search Results Window | `F7` | no |
| Next Search Result | `F4` | no |
| Previous Search Result | `Shift+F4` | no |
| Clear All Search Results | - | no |

### The Find dialog

`Ctrl+F`, `Ctrl+H`, `Ctrl+Shift+F` and `Ctrl+M` all open the same modeless
dialog with four Notepad++ tabs — **Find**, **Replace**, **Find in Files** and
**Mark**. The dialog floats over the editor and is not modal, so you can keep
typing while it is open. Monaco's inline find widget is disabled; `Escape`
closes the dialog from the editor, the menu bar or anywhere else.

Shared controls: **Find what**, **Search Mode** (Normal / Extended / Regular
expression), the options checkboxes (Match case, Match whole word only,
Backward direction, Wrap around, In selection) and a status line reporting the
match position, e.g. `2 of 4` or `4 results on current document`.

- **Find**: `Find Next`, `Count`, `Find All in Current Document` (selects
  every hit) and `Find All in All Opened Documents`. Both Find All actions also
  fill the [Search Results window](#search-results-window).
- **Replace**: `Replace`, `Replace All` and `Replace All in All Opened
  Documents`, all of which are ordinary undoable edits.
- **Find in Files**: `Filters` and `Directory` narrow the workspace search,
  `In hidden folders` includes dot-folders, and `Find All` / `Replace All`
  drive the existing search-in-workspace backend. `Find All` sends its results
  to the [Search Results window](#search-results-window); `Replace All` stays
  on Theia's search panel, because that is where the replacement machinery
  lives.
- **Mark**: marks every occurrence in the current document in one of five
  styles, with `Mark All`, `Clear All Marks`, `Select and Find Next` and a
  `Purge for each search` option. The same actions remain available under
  `Search ▸ Mark`.

!!! note
    The editor's search engine matches within a single line, so the
    `. matches newline` option is shown disabled with an explanation rather
    than silently doing nothing. Notepad++ supports it; this build does not.

### Extended search mode

The Find dialog's **Search Mode ▸ Extended** radio turns the **Find what**
field into Notepad++'s extended search: `\n`, `\r`, `\t`, `\0`, `\\`, `\xHH`,
`\oOOO`, `\dDDD` and `\bBBBBBBBB` escapes are expanded to their literal
characters before searching. Unlike Regular expression mode the rest of the
text is matched literally, so a file full of backslashes is still searchable.
Unrecognised escapes and a lone trailing backslash pass through literally -
Notepad++ does not error on them either. The same three Search Mode radios
(Normal / Extended / Regular expression) also apply to the Incremental Search
bar.

There is no `Search ▸ Search Mode` menu: the radios live in the dialog where
the search is typed.

### Incremental Search

`Ctrl+Alt+I` (or `Search ▸ Incremental Search`) opens Notepad++'s Incremental
Search bar, a thin strip docked at the foot of the editor. Unlike the Find
dialog it searches as you type: every keystroke jumps to the next occurrence
of the whole term after the caret, wrapping around the end of the document.

- `Enter` / `Shift+Enter` step to the next / previous occurrence; the **▲** /
  **▼** buttons do the same.
- **Highlight all** colors every occurrence and cleans up when the bar closes.
- **Match case** is shared with the Find dialog, so either UI toggles the same
  setting, and the **Search Mode** radios (Normal / Extended / Regular
  expression) apply to the bar's search too.
- When nothing matches, the field turns red and the bar announces `no match`
  through an aria-live region instead of just showing red.
- `Escape` closes the bar. If no match was accepted during the session the
  caret returns to where it was when the bar opened; once a match has been
  stepped to with Enter, `Escape` keeps the jump.

### Search Results window

`F7` (or `Search ▸ Search Results Window`) opens a panel at the foot of the
window that lists what a search found, in the order Notepad++ lists it. `F7`
toggles it, so the same key shows and hides it.

Every search that Theia runs for you appends a group to the window, newest
last, and a group stays until you clear it:

- `Find All in Current Document` and `Find All in All Opened Documents` from
  the Find tab,
- `Find All` from the Find in Files tab.

The header reads `Search "foo" (12 hits in 3 files of 1 searched)`. Under it,
one row per file with the file's name as a URI, and under that a row per hit
reading `Line 4: foo bar foo` with the matching text highlighted. Clicking a
row opens that file and puts the caret on the match; double-clicking hands
focus to the editor so you can carry on typing. A group's files can be
collapsed with `Collapse All` and brought back with `Expand All`, a single
group can be `Clear`ed, and `Clear All` empties the window.

`F4` moves to the next hit and `Shift+F4` to the previous one, wrapping at
either end. With no row chosen, stepping starts from the caret in the editor
instead of the top of the list, so `F4` takes you to the hit at or after the
caret. `F3` and `Shift+F3` still step through the editor's own matches, so
nothing that worked before F4 was added has changed.

The panel is a tree to a screen reader: each row announces its level, its
expanded or collapsed state, and whether it holds the cursor, and a search
that adds hits announces the new count.

!!! note
    A Find in Files header stops at `in 5 files`. The workspace search backend
    reports the matches it found but never how many files it looked at, and a
    made-up `of N searched` would be worse than none.

## View menu

| Entry | Chord | Browser-limited? |
| --- | --- | --- |
| Folder as Workspace | - | no |
| Toolbar | - | no |
| Status Bar | - | no |
| Zoom (In / Out / Restore Default) | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | yes, editor focus decides |
| Tab Size | - | no |
| Word Wrap | - | no |
| Document Map | - | no |
| Document List | - | no |
| Show Symbol submenu | - | no |
| Fold All / Unfold All | `Alt+0` / `Alt+Shift+0` | no |
| Fold Level | `Alt+1..7` / `Alt+Shift+1..7` | no |
| Clone to Other View | - | no |
| Move to Other View | - | no |
| Synchronize Vertical / Horizontal Scrolling | `Ctrl+Alt+Shift+V` / `Ctrl+Alt+Shift+H` | no |
| Summary... | - | no |
| Full Screen | `F11`, **or `Ctrl+Shift+F11`** | yes |
| Post-It | `F12` | no |
| Function List | - | no |
| Tab Bar submenu (Draw Close Button, Multi-line) | - | no |

### Document Map

`View ▸ Document Map` toggles the minimap, the narrow overview of the whole
file beside the editor. The toggle writes the `notepadia.documentMap.visible`
preference (mirrored into `editor.minimap.enabled`), so the choice:

- applies to **every** open editor at once,
- survives opening other tabs and a page reload,
- is editable directly in Settings alongside the Notepad++ preferences.

The "minimap hidden on a cold profile" default is part of the behavior profile
above.

### Show Symbol, folding and the split view

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
widget. The product pins `editor.renderWhitespace: "none"`, and Theia
re-applies that on every preference pass, so a `control.updateOptions()` call
on one editor is overwritten almost immediately - which is why the markers
used to light the check mark and draw nothing. A preference change also
reaches every open editor at once and survives a page reload, which is what
you want from a view setting. Monaco only draws the whitespace glyphs through
its font renderer, so Show Symbol also pins
`editor.experimentalWhitespaceRendering` to `font`; its default, `svg`, paints
an overlay with no `.mwh` element to style.

Notepad++'s **Show Wrap Symbol** is not offered, because Monaco 1.75 has no
wrapping-indicator option to bind it to. Show All Characters is still
available from the toolbar.

#### Folding

`View ▸ Fold All` (`Alt+0`) collapses every fold and `View ▸ Unfold All`
(`Alt+Shift+0`) opens them again. `View ▸ Fold Level` folds to a level:
`Alt+1` through `Alt+7` fold, and `Alt+Shift+1` through `Alt+Shift+7` unfold
back to it. Notepad++ lists eight levels, but Monaco registers folding actions
only for levels 1-7, so level 8 is left off rather than bound to an action
that does not exist.

#### Split view and synchronized scrolling

`View ▸ Clone to Other View` shows the current file in a second pane, and
`View ▸ Move to Other View` moves it there so it is only in the other pane.
Notepad++'s constraint of exactly two panes is kept; closing the second pane
returns the file to a single view. With a second pane open, `View ▸
Synchronize Vertical Scrolling` and `View ▸ Synchronize Horizontal Scrolling`
mirror the two positions as you scroll either one, through a re-entrancy guard
so the pane that follows does not scroll the first one back.

#### Full Screen and Post-It

`View ▸ Full Screen` (`F11`, or **Ctrl+Shift+F11** where the browser claims
F11) puts the whole application in the Fullscreen API. `View ▸ Post-It`
(`F12`) is Notepad++'s distraction-free mode: it hides the menu bar, toolbar,
tab bar and status bar, leaving the editor alone on the page. It is a real
view mode, not a one-off class, so it is remembered. Both restore cleanly.

#### Summary...

`View ▸ Summary...` reports the document's characters, words, lines and
selected characters. It uses the same counters as the status bar's
`length : N lines : N` and `Sel` fields, so the dialog and the status bar
cannot disagree.

### Document List panel

`View ▸ Document List` opens the Document List panel (`View ▸ Document Map` is
the minimap - two different things). The panel lists every open document, is
filterable, and clicking a row focuses its tab. The Document List panel and
the Window menu read the same model, so they always agree about what is open.

## Encoding menu

| Entry | Chord |
| --- | --- |
| Encode in UTF-8 | - |
| Encode in UTF-8 BOM | - |
| Encode in UTF-16 LE | - |
| Encode in UTF-16 BE | - |
| Convert to ANSI (Windows 1252) | - |
| Change File Encoding... | - |
| Reload as UTF-8 | - |

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

## Language menu

| Entry | Chord |
| --- | --- |
| Change Language Mode... | - |
| one action per curated language | - |

- **`Change Language Mode...`** opens Monaco's language quick-pick.
- A curated list (JavaScript, TypeScript, HTML, CSS, Markdown, YAML, XML,
  Python, C, C++, C#, Java, JSON, PHP, PowerShell, Ruby, Go, Rust, Shell
  Script, SQL, Plain Text) is registered at startup with lightweight Monarch
  tokenizers, and each entry is a menu action switching the editor language.
- The status bar shows the friendly language name and is clickable.

## Macros menu

| Entry | Chord |
| --- | --- |
| Record Macro... | - |
| Stop Recording | - |
| Discard Recording | - |
| Run Macro | - |
| Clear Macro | - |

The Macros menu records keyboard-driven editing as a script and replays it.
**Record Macro...** starts a recording (the `...` is honest: it is the start of
a session, and the status bar shows a `REC` indicator while recording);
**Stop Recording** ends it, **Discard Recording** throws the current one away,
**Run Macro** replays it at the current caret, and **Clear Macro** empties it.

This build holds **one** macro at a time, in memory. It does not survive a
restart, and there is no macro manager - see
[Differences from Notepad++](differences.md).

## Run menu

| Entry | Chord |
| --- | --- |
| Run... | - |
| saved commands (first ten) | - |
| Modify Shortcut/Delete Command... | - |

`Run` sits where Notepad++ has it, between `Macros` and `Window`, and holds
**Run...** plus **Modify Shortcut/Delete Command...**. It is not bound to a
single chord: Notepad++ reaches it with `F5`, and here `F5` is
**Insert ▸ Date & Time**, so **Run...** is opened from the menu. Bind it in
the keybindings preferences if you want a chord.

**Run...** takes a command line, expands Notepad++'s run variables in it, and
then does what the target it is running in can actually do:

- a command that expands to an `http://` or `https://` URL opens in a new tab,
- any other command in the browser says that a browser tab cannot start a
  program, and that it needs the desktop build. It never fails silently.

The variables are expanded before anything else happens:

| Variable | Expands to |
| --- | --- |
| `$(FULL_CURRENT_PATH)` | full path of the current document, empty for an unsaved one |
| `$(CURRENT_DIRECTORY)` | its directory, without a trailing separator |
| `$(FILE_NAME)` | the file name, e.g. `notes.txt` |
| `$(NAME_PART)` | the name without its last extension, e.g. `notes` |
| `$(EXT_PART)` | that last extension, without the dot, e.g. `txt` |
| `$(CURRENT_WORD)` | the word under the caret |
| `$(CURRENT_LINE)` | the caret's line number, from 1 |
| `$(CURRENT_LINESTR)` | the text of the caret's line |
| `$(CURRENT_COLUMN)` | the caret's column, from 1 |

Both `/` and `\` are understood as separators. Only the last extension is
split off, so `.gitignore` is all name and `archive.tar.gz` has the name part
`archive.tar`. A variable Notepad++ does not define, such as `$(HOME)`, is
left exactly as written rather than being emptied - dropping it would run a
different command from the one you typed.

**Save as (optional)** names the command and **Save** keeps it. Saved commands
are listed in the Run menu (the first ten) and kept across restarts.
**Modify Shortcut/Delete Command...** lists them all with their commands and
offers **Run**, **Delete** and **Close**; Delete removes the entry from the
menu. It keeps Notepad++'s dialog name but does not store a shortcut with each
entry - assign chords in the keybindings preferences if you want them.

On the desktop build the expanded command really is launched, in the current
document's directory, and the exit code and output are reported back. That
executes arbitrary text, so it is gated behind the
`notepadia.run.allowProcessLaunch` preference, which is **off** by default;
until you turn it on, the Run menu explains that launching is turned off. A
command that runs longer than 30 seconds reports that it is still running
rather than holding the dialog: the process is left alone on purpose.

## Window menu

### Windows...

`Window ▸ Windows...` opens Notepad++'s document switcher: every open document
with its **Name**, **Path** and **Type** (`Text` when the name has no usable
extension), and the **Activate**, **Save**, **Close** and **Sort** buttons.
Rows are multi-selectable - Ctrl-click to add one, Shift-click for a range, or
Space with the keyboard - so **Save** and **Close** act on everything selected
at once. **Sort** cycles Name, Path and Type and reverses direction when it
wraps. The dialog is a real listbox: the arrow keys and Home/End move, Space
toggles, Enter activates the focused document, and double-clicking a row opens
it.

The Document List panel (`View ▸ Document List`) and this menu read the same
model, so they always agree about what is open.

### The first ten documents

`Window` lists the first ten open documents, numbered from one, in tab order.
Clicking one activates that tab. The list follows the open set, so it is
renumbered as documents are opened and closed; only the first ten appear, as
in Notepad++.

## Settings menu

`Settings ▸ Shortcut Mapper` opens Theia's own shortcut editor, which lists
every registered chord and rebinds it. Nothing in this app is reachable only by
keyboard: each command is also a menu entry.

The Settings UI also holds the Notepad++ preferences this product adds
(`notepadia.*`: the Document Map visibility, the backup feature, run-process
launch, and the rest), alongside the editor preferences each toggle writes.

## The rest of the chrome

These are not menu entries, but they are part of the Notepad++ shape:

### Toolbar

A 26px Notepad++-style toolbar runs under the menu bar. `View ▸ Toolbar`
toggles the strip on and off, and the choice survives reloads.

- **Groups**, left to right: file actions (New, Open, Save, Save All, Close,
  Close All), Print, clipboard (Cut / Copy / Paste), history (Undo / Redo),
  search (Find, Replace, Find Next, Find Previous), zoom (In / Out / Restore
  Default), view toggles (Word Wrap, Show All Characters, Document Map, Folder
  as Workspace, Function List) and macros (Start Recording, Stop Recording,
  Play Recording).
- **State**: buttons that map to a real toggle — `Word Wrap`, `Show All
  Characters`, `Document Map`, `Folder as Workspace`, `Function List` and
  `Start Recording` — render `aria-pressed`, so their state is visible and
  announced. Buttons without a toggled meaning never claim one.
- **Keyboard**: the strip is a single tab stop (ARIA toolbar / roving
  tabindex). `→` / `←` move between buttons, `Home` / `End` jump to the
  first/last, and `Enter` activates the focused button. Disabled buttons are
  skipped.
- Toolbar buttons follow the current editor: file/editor actions such as Save
  and Undo are enabled only while a file is open.

### Tab bar

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

### Status bar and INS/OVR overtype mode

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
  document is flagged read-only (see [Read-only documents](#read-only-documents))

Pressing `Insert` (or clicking the mode indicator) toggles overtype mode.
In OVR the caret becomes a block and each character you type replaces the
character under the cursor instead of inserting, exactly like Notepad++ —
typing at the end of a line just inserts normally. Toggling back to INS
restores insert behavior. The status bar is throttled to render once per
animation frame, so it stays responsive even in very large files.

### Clipboard History panel

`Edit ▸ Clipboard History` opens a panel listing what you have copied in this
session, newest first, up to 20 entries. Click one to put it back at the
caret, as a single undoable edit applied at every cursor.

The list is filled by the editor's own `copy` and `cut` events, so it records
what actually went to the clipboard — including copies made with `Ctrl+C` from
anywhere in the app, not only from a Notepadia command. Copies made outside
the app's window cannot be observed by a web page and are not recorded, and
the list is per session: it is not written to disk.

`Clear` empties it, and the panel closes the same way it opened, from the same
menu entry.

### Character Panel

`Edit ▸ Character Panel` opens the Notepad++ panel that holds the special
characters Notepad++ ships - arrows, boxes, blocks, currency and mathematical
signs - grouped by category. Clicking one puts that character into the
document at the caret, so a character that has no key on this keyboard can
still be typed. The panel is also under `View`, which is where Notepad++
keeps it; both entries run the same command and only one of them can be
showing at a time.

### Folder as Workspace panel

The file tree Notepad++ calls Folder as Workspace is Notepadia's left panel.
It starts hidden; `View ▸ Folder as Workspace`, or the matching toolbar
button, opens it, and the same toggle closes it again.

The panel is headed `Folder as Workspace` whatever folder is open, rather than
taking the workspace root's name the way VS Code's Explorer does. Its rows are
drawn Notepad++'s way — a tight 20px line and plain names rather than a
per-language file icon — and a right-click opens the Folder as Workspace menu
(New File, New Folder, Find in Files, Copy Path, Rename, Delete, Remove
Folder) rather than Explorer's full editor menu.

!!! note
    Notepad++'s separate multi-root Project Panels 1, 2 and 3 are not built.
    The single Folder as Workspace tree is the whole of the left panel.

### Function List panel

`View ▸ Function List` opens a panel down the right-hand side listing the
functions of the file you are editing, in the order Notepad++ lists them. The
same command hides it again, and the toolbar carries a **Function List**
button that toggles it too.

The list reads the text of the current document, so it keeps itself current:
it re-reads 250 ms after you stop typing, and again when you switch to a file
in another language. It never writes to your document.

Each row reads the function's name, its kind (`function`, `class` or
`section`) and the line it is declared on, and clicking a row puts the caret
on that line. Use the filter box to narrow the list by name as you type;
`Escape` clears it. The sort button reads `A-Z` or `1-9` and toggles between
document order (the default, top to bottom) and alphabetical; its pressed
state and tooltip say which of the two is in force.

Languages with rules include JavaScript, TypeScript, Python, C, C++, C#, Java,
PHP, Ruby, PowerShell, Bash and shell scripts, SQL, JSON, XML, HTML, Markdown,
INI, Go and Rust. A file in a language with no rules, or one with nothing
declared in it, says so instead of showing an empty box.

The panel is a tree to a screen reader: the list is announced as a tree naming
the language it is listing, each row announces its name, kind and line, and
the row holding the list's own cursor is announced as selected. `Up` and
`Down` move that cursor, `Home` and `End` jump to the ends, and `Enter` jumps
to the cursor's row in the editor.

!!! note
    The list is built by matching each language's declaration syntax, not by
    parsing the file. A declaration written in a way the pattern does not
    recognise is not listed.

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
  oldest copy first. A copy of a document that has since grown past the limit
  is dropped rather than left behind stale.

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

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl+D | Duplicate current line |
| Ctrl+L | Delete current line |
| Ctrl+F2 | Toggle bookmark on the current line |
| F2 / Shift+F2 | Next / previous bookmark (wraps in file) |
| F3 / Shift+F3 | Find next / previous |
| F4 / Shift+F4 | Next / previous search result |
| F7 | Show / hide the Search Results window |
| Ctrl+F | Open the tabbed Find dialog (Find tab) |
| Ctrl+H | Open the tabbed Find dialog (Replace tab) |
| Ctrl+Shift+F | Open the tabbed Find dialog (Find in Files tab) |
| Ctrl+M | Open the tabbed Find dialog (Mark tab) |
| Ctrl+Alt+I | Toggle the Incremental Search bar |
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

- **Editor has focus** - `Ctrl+=` grows the editor text, `Ctrl+-` shrinks it
  and `Ctrl+0` resets it, and the page does not zoom.
- **Anything else has focus** - the menubar, the tab bar, the folder panel -
  the browser keeps its own page zoom.

`Alt` is left alone throughout, because `Ctrl+Alt` is `AltGr` on Windows
keyboard layouts and those chords belong to the layout, not to the app.

!!! note "How this list was checked"
    The automated browser tests cannot confirm which chords a browser reserves:
    Puppeteer injects key events over the DevTools protocol, which delivers
    them straight to the page and bypasses the browser's accelerator handling
    entirely. The table therefore records standard Chromium and Firefox
    behaviour, and the automated tests cover the parts that *are* reachable -
    that each alternate opens the right thing, and that the editor zoom wins
    while the editor has focus. Re-check the table by hand after a major
    browser upgrade.