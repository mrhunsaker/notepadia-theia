# Changelog

## 2026.10.03 (The Run menu)

- **Notepad++'s `Run...` is here, in a form a browser tab can actually
  honour.** A new top-level `Run` menu sits where Notepad++ has it, between
  `Macros` and `Window`. A command that resolves to an `http://` or `https://`
  URL opens in a new tab; anything else says plainly that starting a program
  needs the desktop build. Nothing fails silently, and the menu is not
  registered at all when it would have nothing to offer.
- **Notepad++'s `$(NAME)` run variables expand, in a pure, unit-tested
  function.** `$(FULL_CURRENT_PATH)`, `$(CURRENT_DIRECTORY)`, `$(FILE_NAME)`,
  `$(NAME_PART)`, `$(EXT_PART)`, `$(CURRENT_WORD)`, `$(CURRENT_LINE)`,
  `$(CURRENT_LINESTR)` and `$(CURRENT_COLUMN)` are replaced before the command
  is handed anywhere. Both `/` and `\` are understood, only the last extension
  is split off (`.gitignore` is all name, `archive.tar.gz` keeps `archive.tar`),
  and an unknown variable such as `$(HOME)` is passed through untouched -
  dropping it would run a different command than the one you typed.
- **Named commands are saved and listed in the menu.**
  `Run ▸ Modify Shortcut/Delete Command...` keeps up to ten named entries in
  the Run menu, runs one or deletes one, and persists them across restarts
  through Theia's `StorageService`. The dialog keeps Notepad++'s label but does
  not store a shortcut per entry; keybindings live in the keybindings
  preferences instead, so nothing is faked.
- **The desktop build really can launch, behind a switch that is off by
  default.** In the packaged app the expanded command goes to
  `child_process.spawn` over a dedicated Electron channel, in the current
  document's directory, reporting back the exit code and up to 64 KiB of
  output. That is a genuine security surface - a saved command is arbitrary
  text - so it requires the `notepadia.run.allowProcessLaunch` preference,
  which is off until you turn it on.
- **Enter runs a command once.** The dialog overlay already routes Enter to the
  open dialog, so the command box has no handler of its own; without that
  detail a single Enter would have run the command twice.

## 2026.10.03 (The Window menu)

- **Notepad++'s Window menu is here.** A new top-level `Window` submenu sits
  where Notepad++ has it, between `Macros` and `Settings`. It lists the first
  ten open documents numbered from one; clicking an entry activates that tab,
  and the list is renumbered as tabs open and close.
- **`Windows...` opens Notepad++'s document switcher.** The dialog lists every
  open document with `Name`, `Path` and `Type` columns and offers `Activate`,
  `Save`, `Close` and `Sort`. Rows are multi-selectable (Ctrl/Shift click, or
  Space with the keyboard), so several documents can be saved or closed at once;
  `Sort` cycles Name, Path and Type and reverses on wrap.
- **The Window menu and the Document List now share one model.** A new
  `NotepadiaOpenDocuments` service lists the main-area editors in tab order and
  exposes "the set changed" and "the active document changed" as separate
  events, so both surfaces cannot disagree about what is open.
- **The menu rebuild no longer tears itself down.** Opening a top-level menu
  moves focus, and the first cut rebuilt the Window list on every active
  change - which cleared and refilled the menu bar while the menu was opening,
  leaving every menu showing nothing. The menu now listens only for documents
  being added or removed and rebuilds on the next tick, so it never touches the
  bar from inside the shell's widget event.

## 2026.10.03 (The View menu is complete)

- **The View menu now has the entries Notepad++ keeps there.** A **Show Symbol**
  submenu (Show Space and TAB, Show All Characters, Show End of Line, Show
  Indent Guide), **Fold All** (`Alt+0`) and **Unfold All** (`Alt+Shift+0`), a
  **Fold Level** submenu (`Alt+1`-`Alt+7`, `Alt+Shift+1`-`Alt+Shift+7`),
  **Clone to Other View** and **Move to Other View**, **Synchronize Vertical
  Scrolling** and **Synchronize Horizontal Scrolling**, **Summary...**, **Full
  Screen** (`F11`) and **Post-It** (`F12`). The old single "Show All
  Characters" row is now inside Show Symbol, where Notepad++ has it, and is no
  longer duplicated at the top level.
- **Show Symbol writes Monaco preferences, not just today's widget.** The
  toggles used to call `control.updateOptions()` on the current editor, which
  Theia overwrote on its next preference pass because the product pins
  `editor.renderWhitespace: "none"` - so checking Show Space and TAB lit the
  check mark and drew nothing. The commands now write `editor.renderWhitespace`,
  `editor.guides.indentation`, and `editor.experimentalWhitespaceRendering`
  (whitespace glyphs are only drawn as `.mwh` in Monaco's `font` renderer, not
  in its default `svg` overlay). A preference change reaches every open editor
  and survives a reload.
- **Show End of Line is a decoration, because Monaco has no end-of-line glyph.**
  Monaco exposes no option that draws a `¶`, so each line gets a decoration
  whose `afterContentClassName` is turned into a `::after` box by the
  extension's stylesheet. An inline `after` cannot be passed straight through
  `deltaDecorations`; only a registered class survives the view-model's
  decoration pipeline.
- **Folding stops at level 7 because Monaco does.** Notepad++ offers eight
  levels; Monaco registers `editor.foldLevel1` through `editor.foldLevel7` and
  nothing for eight, so the eighth row is left off rather than bound to an
  action that does not exist.
- **Split view is exactly two panes, and it scrolls in sync.** Clone puts the
  current file in a second pane, Move leaves it only in the other pane, and
  closing the pane returns the file. With both open, Synchronize Vertical /
  Horizontal Scrolling mirrors the two positions through a re-entrancy guard, so
  one pane following the other does not bounce back.
- **Full Screen and Post-It are the browser's to build, and they are.** Full
  Screen drives the Fullscreen API on the document; Post-It hides the menu bar,
  toolbar, tab bar and status bar and leaves the editor, and is a real view mode
  rather than a one-off class. `F11` is claimed by the browser before the page
  sees it, so `Ctrl+Shift+F11` ships alongside it, the way the other
  browser-reserved chords already do.
- **Summary... counts with the status bar's own arithmetic.** Characters,
  words, document lines and selected characters come from the same pure
  functions that feed `length : N lines : N` and `Sel`, so the dialog and the
  status bar cannot disagree.
- **Show Wrap Symbol, Function List and Project Panels are not offered.**
  Monaco 1.75 has no wrapping-indicator option to bind Show Wrap Symbol to;
  Project Panels is already `Open Folder as Workspace...`; and Function List
  arrives with the function-list work it depends on, rather than as a row with
  no panel behind it.

## 2026.10.03 (Begin/End Select keeps up with the arrow keys)

- **Arrow keys no longer throw the caret across the selection.** With a
  Begin/End Select anchor live, Monaco collapses a live selection to one of its
  ends on a plain arrow press rather than extending it, so a single ArrowRight
  could carry the caret from column 1 straight to the anchor at column 5 — and
  the selection it had been building with it. Extending now records the caret it
  installed so Monaco's echo of that write is not mistaken for a fresh move, and
  a navigation key is flagged before the editor handles it so the move is
  re-extended from the anchor instead. The result is what Notepad++ does: each
  arrow press moves the caret one step and the selection follows.
- **The anchor is armed until the second press, so the tests say so.** A test
  that armed Begin/End Select and went on to use the caret was still under its
  anchor, and the selection that followed swallowed the word Multi-Select All
  was asked to find. The e2e now disarms it explicitly between the two.

## 2026.10.02 (`Open` means your own computer)

- **`Open` now means one thing everywhere: a file picker on your own disk.**
  The `File` menu entry, the toolbar's Open button and `Ctrl+O` are a single
  command labeled `Open from Computer`, and all three open your machine's file
  picker. Previously the menu entry and the toolbar button ran Theia's
  workspace browser, so a Notepad++ user pressing `Ctrl+O` — which in
  Notepad++ always means "my own disk" — got a directory listing of a server
  they could not see, while the command that actually worked sat one row below
  under a different name.
- **The server workspace kept its route, under a name that says so.**
  `Open from Workspace...` browses the workspace; `Save As...`, `Save` and
  `Save All` still write to it. No control in the application is labeled
  `Open...` any more, so the verb can no longer resolve to two different
  filesystems. `Open Folder as Workspace...` and `Upload to Workspace...` are
  unchanged.
- **The toolbar button's tooltip and accessible name follow.** They derive from
  the button's label, so the Open button now announces "Open from Computer"
  rather than "Open". A unit test pins the button to `notepadia.file.openLocal`
  and the test that catches dead toolbar commands no longer treats
  `core.open` as a sanctioned target, so pointing the button back at the
  workspace browser fails the build.

## 2026.10.01 (The Edit menu is complete)

- **The Edit menu now has the clipboard, insertion, selection and protection
  entries Notepad++ has.** Copy to Clipboard, Paste Special, Insert ▸ Date &
  Time, Set/Clear Read-Only, Begin/End Select, Multi-Select All, Column Mode,
  Clipboard History and the Character Panel entry are all there, in
  Notepad++'s positions, and every one of them acts on the buffer rather than on
  a string the app keeps beside it.
- **Copy to Clipboard answers "where am I", not "what is this".** The text is
  already on the clipboard after any ordinary Copy, so the submenu offers the
  current full file path, the current filename and the current directory path,
  and is disabled on an untitled document that has no path to report. The write
  goes through `navigator.clipboard` with a real `execCommand` fallback,
  because a page served over plain `http` on a LAN is not a secure context and
  there the async API is simply absent.
- **Paste Special judges the clipboard against the line above the caret.** Paste
  and Indent lines the pasted block up with the code around it, Paste and
  Unindent takes the duplicate indent back off, and Paste Unformatted is the
  plain `text/plain` flavour unchanged. Reading the clipboard needs a secure
  context and a permission, so where the browser refuses, the app says so in a
  message rather than silently pasting nothing; `Ctrl+V` never needs either.
- **Date & Time comes in Notepad++'s two defaults and a box that checks its
  input.** `F5` inserts `HH:mm:ss dd/MM/yyyy`, `Ctrl+F5` inserts
  `ddd, MMM d, yyyy h:mm tt`, and the customized dialog takes a token string
  where quoted text is literal. A format with no token in it is refused with a
  reason instead of inserting the same constant string every time. `MM` is
  always the month and `mm` always the minutes, where Windows' `strftime` has
  to guess from the token in front of it and nobody remembers that rule.
- **Read-only is a property of the document, enforced by the editor.**
  `File ▸ Set/Clear Read-Only` (`Ctrl+Alt+R`) sets Monaco's own `readOnly`
  option, so typing, pasting and shortcuts the app does not know about are all
  rejected in the same place; the tab shows the padlock the tab decorator
  already painted and the status bar mode field reads `Read-Only` instead of
  `INS` / `OVR`. The flag is keyed by document path, so it survives a tab
  switch and a close-and-reopen in the same session without leaking onto
  untitled buffers.
- **Begin/End Select and Multi-Select All do what Notepad++'s do.** The first
  `Ctrl+Alt+B` drops an anchor, every later caret move extends the selection
  from it, and the second press leaves the selection on screen and forgets the
  anchor — per document, so switching tabs and back keeps it. Multi-Select All
  puts a cursor on every occurrence of the word under the caret with no
  selection required, with Match case and Whole word variants, and stops at
  1000 cursors *saying* it stopped.
- **Column Mode is a command, not a dialog.** `Alt+C` turns the current
  selection into a rectangular block — the selection's columns applied to every
  line it covers — for the people who do not know Monaco's `Alt` + drag. It sits
  beside the existing Column Editor in Line Operations, and is labelled without
  a `...`, because a menu entry that promises a dialog and opens none is worse
  than one that says what it does.
- **Clipboard History records what actually went to the clipboard.** The list is
  filled from the editor's own `copy` and `cut` events, so it catches `Ctrl+C`
  from anywhere in the app, not only from a Notepadia command; one click puts an
  entry back at every caret as a single undoable edit. It holds the session's
  last 20, is not written to disk, and copies made outside the app's window are
  not observable by a web page at all.
- New pure modules with 70 unit tests over them:
  `src/common/date-time-formats.ts` (the whole token table),
  `src/common/paste-special.ts` (the indent decisions),
  `src/common/column-block.ts`, `src/common/multi-select.ts` and
  `src/common/clipboard-history.ts`.
- The new `edit-extras` e2e suite drives all of it in a real browser: a path,
  a name and a folder read back off the system clipboard; each of the two
  default date formats and a custom one in the model, with a token-free format
  refused; a read-only document that ignores typing and clears again on
  `Ctrl+Alt+R`; a selection that grows from an anchor; four cursors from
  `search.txt`; a four-cell block edited in one keystroke; a copy landing in the
  history and back in the buffer; and all three Paste Special results compared
  against the exact expected text.
- A Theia 1.75 detail that bit the first draft and is worth recording: the
  per-editor cursor listener and the document-level `copy` listener were pushed
  into one `DisposableCollection`, and the editor listener was disposed on
  every tab switch — which silently took the clipboard listener with it. The
  app-lifetime and per-editor disposables are now separate collections.
- `F5` and `Ctrl+F5` are bound as Notepad++ binds them, and the browser claims
  both, so `Ctrl+Alt+D` and `Ctrl+Alt+Shift+D` are added alongside them for the
  web — the same treatment `Ctrl+N` and `Ctrl+O` already had.

## 2026.9.30 (The File menu finishes its job)

- **The four file commands a Notepad++ user reaches for without thinking are
  here.** `Reload from Disk`, `Save a Copy As...`, `Rename...` and `Delete from
  Disk` are in the File menu, and each one goes through Theia's `FileService`,
  so the tab, the file tree and the bytes on disk agree afterwards rather than
  the file being changed behind Theia's back.
- **`Save a Copy As...` copies without moving.** The buffer is written to the
  chosen name and the tab stays on the original file, so the next `Ctrl+S` goes
  where it always did. It works on an untitled document too, which gets a `.txt`
  so the copy is a file the user's own tools can open.
- **`Rename...` keeps the tab on the file.** Renaming moves the file and puts
  the open tab on the new path — a tab left pointing at the old path would
  quietly recreate it on the next save. Unsaved text is carried across, and the
  box refuses `..` and absolute paths: a command named "Rename" should not also
  be a way to move a file out of the folder the user is looking at.
- **`Reload from Disk` asks only when there is something to lose**, and
  `Delete from Disk` always asks, naming the file it is about to remove and
  saying when unsaved changes will go with it. Deleting closes the tab instead
  of leaving a dirty editor open on a file that no longer exists.
- **`Open Folder as Workspace...` is back in the File menu.** Theia's
  `workspace:open` command was being unregistered to keep duplicate folder
  entries out; it is now registered once, under its own label, at the position
  Notepad++ puts it.
- New `src/common/file-operations.ts` holds the decisions as pure functions —
  where a rename should resolve to, the copy's default name, and the wording of
  the two destructive prompts — with 27 unit tests over it.
- Three Theia 1.75 details were wrong in the first draft and are worth naming.
  `Path.name` is the file name *without* its extension, so the rename box opened
  on `notes` for `notes.txt` and an `app.js` copy would have been offered as
  `app.txt`; the right field is `Path.base`. `SingleTextInputDialog`'s validator treats a
  `DialogError` **string as the error message**, so an accepted name returns the
  empty string, not the name. And `tab-replace` cannot be used to re-point an
  editor after a move — by then the old widget is not a usable reference in the
  shell layout and the shell throws "Reference widget is not in the layout" — so
  the new resource is opened and the stale tab dropped instead.
- The `file-menu` e2e suite drives all four against the disk in a real browser:
  the menu shape and order, a copy that leaves the tab and the original file
  alone, a reload that brings the file back without writing to it, a rename that
  moves the file and follows it, a save after the rename landing on the new
  file, and a delete that removes the file and closes the tab.

## 2026.9.29 (Nothing unsaved is lost to a crash)

- **A crash, a killed browser tab, or an accidental close no longer takes your
  text with it.** Measured first, not assumed: Theia already asks before a tab
  with unsaved changes is closed, but the text lived only in memory — reloading
  a dirty `new 1` left no tab and no content at all. A copy of every document
  with unsaved changes is now written to the browser's own IndexedDB a few
  seconds after you stop typing, and the next launch brings those documents
  back, marked dirty so `Ctrl+S` is what keeps them.
- **Saving or discarding clears the copy.** What you deliberately threw away
  does not reappear the next morning, and what you saved does not come back as a
  duplicate.
- **Recovery never overwrites a file that moved on.** A file whose disk mtime is
  newer than the copy is left alone and the copy is dropped; a document with no
  file behind it, like an untitled buffer, is always recoverable, because there
  is no disk version that could supersede it.
- **Bounded by design.** A document over 2 MB is skipped rather than stored, the
  total across all documents is capped at 8 MB with the oldest copy evicted
  first, and a copy of a document that has since grown past the limit is
  dropped rather than left behind stale.
- **Two settings, both documented:** `notepadia.backup.enabled` (on by default)
  and `notepadia.backup.intervalSeconds` (5). Turning the feature off stops new
  copies without deleting the ones already taken.
- **The storage is the page's own.** IndexedDB in the browser rather than
  Theia 1.75's `StorageService`, which is localStorage: a small synchronous
  string store, the wrong shape for document text, and writing a large buffer
  synchronously on the main thread is exactly the jank a backup feature must
  not add. Nothing leaves the browser, and no other user can read it.
- New `src/common/backup.ts` holds the policy as pure functions — record
  validation, UTF-8 size limits, what to do on capture, whether a backup is
  worth restoring, and which copies to evict — with 54 unit tests over it. Two
  of those rules were wrong in the first draft and are worth naming: untitled
  buffers were being discarded because the comparison used the snapshot time
  instead of the file's mtime, and "this widget is clean" was treated as "this
  text is saved", which let an empty tab restored for the same URI delete
  another session's unsaved work. Clearing a backup now needs evidence — the
  text on screen is the text that was stored, or it is what is on disk.
- Recovery runs from Theia's `onDidInitializeLayout` hook, not `onStart`. A tab
  opened before the tab bar is initialized is one the layout then overwrites, so
  the second launch after a recovery would restore the buffer and immediately
  lose the tab again.
- The `backup` e2e suite covers the whole loop in a real browser: nothing is
  written while typing, a copy appears once typing pauses, the text and the
  dirty mark come back after a reload, a recovered buffer stays protected
  against a second crash, saving clears the copy while a saved file is never
  offered back, and Theia's own beforeunload prompt still guards the reload.
- `e2e/toolbar.cjs` now answers the beforeunload prompt before reloading. It
  never had to: nothing was dirty at that point. Now that recovery leaves a
  recovered buffer dirty on purpose, puppeteer's unanswered prompt hung the
  navigation until it timed out.

## 2026.9.28 (Shortcuts that survive a browser)

- **The chords a browser claims no longer cost you the feature.** `Ctrl+N`,
  `Ctrl+W`, `Ctrl+Shift+W` and `Ctrl+O` are intercepted by the browser before
  the page ever sees them, so a web Notepad++ was quietly missing New, Close,
  Close All and Open From This Computer on the keyboard. Each now has an
  alternate the browser leaves alone: **`Ctrl+Alt+N`**, **`Ctrl+F4`** (the same
  chord Notepad++ itself uses for Close), **`Ctrl+Alt+Shift+W`** and
  **`Ctrl+Alt+O`**. Nothing was taken away — the original four chords stay bound
  and keep working in the desktop app, where no browser is in the way, and every
  command is in a menu whether or not any chord reaches it.
- **`Ctrl+=` / `Ctrl+-` / `Ctrl+0` zoom the text, not the window.** These are
  Zoom In / Zoom Out / Reset Zoom in Notepad++ and page zoom in every browser,
  and pressing them with a document open used to grow the whole page. The
  division is by focus: with the editor focused the text grows and the page
  does not; with the menubar, tab bar or file tree focused the browser keeps
  its own page zoom, because that is what was asked for. `Alt` is never treated
  as a zoom chord, since `Ctrl+Alt` is `AltGr` on Windows layouts.
- **`Settings ▸ Shortcut Mapper` is now in the menu**, so every registered
  chord can be listed and rebound from the UI rather than only discovered by
  trying them.
- **Documented what is actually reserved, and what was verified.** The user
  guide gains a table of the browser-claimed chords, the Notepad++ meaning, and
  the alternate to use. It also states the limit honestly: Puppeteer injects
  keys over the DevTools protocol, which bypasses browser accelerator handling,
  so the automated tests cover the alternates and the editor/page zoom split
  rather than pretending to measure the browser's accelerator table.
- New `src/common/zoom-chords.ts` decides which keys are editor zoom chords as
  a pure function, with unit tests covering both spellings of Zoom In, Meta on
  macOS, the `AltGr` exclusion and the chords it must leave alone. The keydown
  listener could not be unit tested: Theia `preventDefault`s on the same node
  in the same phase for every chord it handles, so a listener under test could
  only ever observe Theia's answer.
- The `menus-shortcuts` e2e suite covers `Ctrl+Alt+N`, `Ctrl+F4`,
  `Ctrl+Alt+Shift+W` (including the dirty-document prompt), the `Ctrl+Alt+O`
  file picker, the Shortcut Mapper entry, and editor text growing and resetting
  while `devicePixelRatio` stays put.

## 2026.9.27 (Files on your own computer)

- **Open and save files on the disk you are sitting at.** A Notepad++ user
  reads `File ▸ Open` and `File ▸ Save` as "my own disk". Notepadia is served
  by another machine, so those commands only ever touched the *server's*
  workspace and a remote user had no way at all to read a file off their
  laptop or get one back. Three new File menu entries, with names that say
  which storage they use:
  - `Open From This Computer...` reads one or more files from
    your disk into new tabs.
  - `Save To This Computer...` writes the current tab to your disk and leaves
    the tab alone.
  - `Upload to Workspace...` copies a file from your disk into the server
    workspace, where the Files tree, Find in Files and the rest of the
    workspace-aware features can see it.
- **A tab opened from your disk is really backed by your disk.** On Chromium
  the picked `FileSystemFileHandle` is remembered per tab, so ordinary Ctrl+S
  writes straight back to the same file instead of falling through to Theia's
  Save As dialog. Every other tab — workspace files, `new 1`, anything without
  a handle — keeps Theia's own save behaviour untouched. The tab is titled
  with the real file name rather than `new N`, and a second copy of the same
  name opens as `notes (2).txt`.
- **Firefox and Safari degrade cleanly.** Without the File System Access API
  the open route becomes a hidden `<input type="file" multiple>` and the save
  route becomes a Blob download, so the round trip still works. The API is also
  feature-detected at call time, so an insecure context (`http://` without
  localhost) falls back instead of failing.
- **A cancelled picker is not an error.** Dismissing the dialog does nothing
  at all. A refused write permission produces a message that names the file
  that was not saved.
- **The dead `Upload Files...` / `Download` File menu entries stay hidden, and
  are now replaced by working equivalents.** Both of Theia's commands are only
  enabled when a node is selected in the Files tree, so as File menu entries
  they could never run.
- New `src/common/local-files.ts` holds the name arithmetic (tab naming,
  dedupe, save-name suggestion) and the picker error triage as pure functions
  with unit tests. A new `local-files` e2e suite (26 suites total) drives the
  upload/download fallback end to end: a local file opens in a correctly named
  tab with the right content, `Save To This Computer...` fires a real download
  whose file lands on disk with the document text, Ctrl+S on a handle-less tab
  does not silently download, and `Upload to Workspace...` writes the file into
  the server workspace.

## 2026.9.27 (Notepad++ tabbed Find dialog)

- **One modeless Find dialog, four Notepad++ tabs**: `Ctrl+F`, `Ctrl+H`,
  `Ctrl+Shift+F` and `Ctrl+M` all open a single floating dialog with **Find**,
  **Replace**, **Find in Files** and **Mark** tabs, replacing Monaco's inline
  find widget and Theia's separate search-in-workspace entry points. The
  dialog is not modal, so the document stays editable underneath, and `Escape`
  closes it from the editor, the menu bar or anywhere else in the workbench.
- **Find and Replace**: `Find Next`, `Count`, `Find All in Current Document`
  (which selects every hit, as Notepad++ does) and `Find All in All Opened
  Documents`; `Replace`, `Replace All` and `Replace All in All Opened
  Documents`, all of which are ordinary undoable edits. `Replace All` targets
  the *current* document rather than whichever editor happens to be first in
  the list. The Find tab prefills the word under the caret and reports
  `2 of 4` / `4 results on current document` in its status line.
- **Find in Files**: `Filters` and `Directory` narrow the workspace search
  (the directory is resolved against the workspace root and searched including
  its sub-folders), `In hidden folders` includes dot-folders, and
  `Find All` / `Replace All` drive the existing search-in-workspace backend —
  `Replace All` runs the search and then replaces across its results. The
  search mode is translated onto the backend's own flags, so Regular
  expression and Match case work here too.
- **Mark**: the tab carries `Mark All`, `Clear All Marks`,
  `Select and Find Next`, the five Notepad++ mark styles and a
  `Purge for each search` option that now controls purging on its own (Mark All
  used to purge unconditionally). The same three actions stay available under
  a restored `Search ▸ Mark` submenu, which opens the dialog on its Mark tab
  and runs the action.
- **Honest controls**: `. matches newline` is shown disabled with a tooltip
  explaining that the editor's search engine matches within a single line,
  and `In all sub-folders` is shown checked-and-disabled because a Directory
  search always includes sub-folders — neither is a checkbox that silently
  does nothing.
- New `NotepadiaFindState` shares the find options (mode, case, whole word,
  backward, wrap, in-selection) between the dialog and the search-mark engine,
  and `src/common/find-options.ts` holds the pure search-mode translation with
  unit tests. A new `find-dialog` e2e suite (25 suites total) covers the tabs,
  counting, wrap-around, in-selection stepping, regex mode, Replace All, undo,
  persistence, the mark styles, Escape, and F3/Shift+F3 continuation.

## 2026.9.25 (Notepad++ status bar parity + real INS/OVR overtype mode)

- **Live Notepad++ status bar fields**: the status bar now shows the
  document length and line count (`length : 1,234  lines : 56`), the caret
  position as `Ln : 3  Col : 12  Pos : 47` (1-based line/column with the
  0-based, thousands-grouped character offset) and the selection size as
  `Sel : 18 | 2` (characters | lines, summed across all cursors) — all three
  formatted exactly like Notepad++ and updated live from the model. The whole
  bar re-renders once per animation frame, so it stays responsive in large
  files.
- **Real INS/OVR overtype mode** (previously a hard-coded `INS` label): the
  `Insert` key — or a click on the mode indicator — toggles between insert
  and overtype. In OVR the caret becomes a block and typed characters
  replace the character under the cursor instead of inserting (typing at the
  end of a line continues to insert). Implemented with a capture-phase
  keydown interceptor on the editor that routes printable keystrokes through
  Monaco's `executeEdits`, so undo, selection and IME handling are
  unaffected. Uses `@theia/monaco-editor-core`'s `Range`, `Position`,
  `getValueLengthInRange` and `setPosition` APIs.
- New pure formatters `formatCaret`, `formatSelection` and `formatLength`
  (`src/common/status-fields.ts`) with unit tests, plus a `status-bar` e2e
  suite covering the length/selection/caret fields and the INS→OVR→INS
  overwrite behavior (24 suites total).

## 2026.9.24 (Notepad++ default behavior profile + persistent Document Map)

- **Notepad++ default behavior on a cold profile** (`theia.frontend.config.preferences`
  in both apps): word wrap off, 4-wide real tabs (`insertSpaces: false`,
  `detectIndentation: false`), no auto-closing brackets/quotes/surround, no
  suggestions while typing or on trigger characters, formatting off on
  paste/type, no trailing-whitespace trim, whitespace/control characters
  hidden, line numbers on, rulers empty, autosave off.
- **Notepadia's own preferences** now ship as a `PreferenceContribution`
  (`notepadia-preference-contribution.ts`), so `notepadia.toolbar.visible`,
  `notepadia.statusBar.visible`, `notepadia.tabBar.multiLine`,
  `notepadia.documentMap.visible`, `notepadia.session.restore` and
  `notepadia.search.extendedMode` are visible and editable in Settings.
- **Persistent Document Map**: the View > Document Map toggle now writes the
  `notepadia.documentMap.visible` preference (User scope) and mirrors it into
  `editor.minimap.enabled`, so the minimap state applies to every open editor
  and survives opening a second tab and a page reload (previously one editor's
  live settings were changed in place and lost).
- **Notepad++ untitled naming**: `File > New` (Ctrl+N) opens `new 1`, `new 2`,
  ... in plain text with no extension, through a `NotepadiaUntitledResourceResolver`
  rebinding the core `UntitledResourceResolver`.
- e2e: cold-profile default now asserts `Tabs: 4`; View-menu suite asserts the
  Document Map persists to a second editor tab and across a reload. The e2e
  runner uses a per-run `THEIA_CONFIG_DIR` so suites always start from a cold
  profile.

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