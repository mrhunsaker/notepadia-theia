# Notepadia architecture

## Principle

Notepadia reproduces the Notepad++ user experience without reproducing the
Notepad++ internal implementation.

## Applications

- `applications/browser` — the primary development target. A Theia browser
  application whose Node backend serves the frontend at `http://localhost:3000`.
  No native rebuild is required per edit; iterate with `yarn watch` + `yarn start`.
- `applications/electron` — the native desktop packaging target (Electron +
  Electron Builder). Used only when producing distributables (AppImage/RPM/DEB
  on Linux, NSIS/portable on Windows, DMG on macOS).

Both load the same `notepadia` extension; product logic lives there.

Theia owns:

- editor lifecycle
- Monaco integration
- filesystem
- workspaces
- navigator
- command registry
- keybindings
- menus
- preferences
- search

Notepadia owns:

- product menus and shortcuts
- Notepad++-specific editing behavior
- encoding UX
- EOL UX
- session/recent-file UX
- status bar presentation
- product branding
- desktop packaging choices
- automatic updates

## Dependency rule

Do not depend directly on private Theia implementation modules unless the
public Theia API does not provide the required behavior and the dependency is
documented with a migration note.

## Notepad++ editing essentials (P1)

### Menus and commands

`NotepadiaContribution`, `NotepadiaMenuContribution`,
`NotepadiaKeybindingContribution`, and `NotepadiaEditorKeybindingContribution`
in `extensions/notepadia/src/browser/` implement the Notepad++-style surface:

- top-level menus `Search`, `Encoding`, `Language`, `Settings` plus Notepad++
  sections inside `File` (New / Open / Save / Save As / Save All / Close /
  Close All / Close All But Active) and `Edit` (Indent / Unindent / Duplicate
  Current Line / Delete Current Line / Move Current Line Up+Down / Join Lines /
  comment line, a `Line Operations` submenu, and a `Convert Case` submenu).
- editor actions are executed through
  `control.trigger('notepadia', 'editor.action.*', null)` on the current
  Monaco editor, so text manipulation reuses Monaco's hardened editing code
  paths instead of bespoke string rewriting.
- `Search` menu: Find / Find Next / Find Previous / Replace / Find in Files
  (the working command id for the latter is `search-in-workspace.open`).

### Keybindings and the editor input path

Editor chords can arrive through two different input implementations:

- **textarea path (classic)** — DOM keydown events fire and Theia's own
  keybinding registry intercepts them at document capture. Notepadia bindings
  are registered via `KeybindingContribution` and work as usual.
- **native EditContext path** — contemporary Chromium supports the native
  `EditContext` API and Monaco opts into it **by default** (`editor.editContext`
  monaco option defaults to `true`). That path never dispatches DOM keydown
  events, so Theia's keybinding layer cannot see editor chords. Monaco-level
  `StandaloneKeybindingService.addDynamicKeybinding(...)` bindings cover it.

Decisions taken for P1:

1. `NotepadiaEditorKeybindingContribution` forces every editor back onto the
   classic textarea input with `control.updateOptions({ editContext: false })`
   as each editor becomes current. The textarea path makes the Theia-level
   bindings deterministic across browsers (prerequisite for the two chords
   below). The Monaco dynamic-keybinding bridge is kept as a fallback for any
   input path where Monaco dispatches first; it intentionally cannot
   double-fire because Theia stops DOM propagation whenever it matches.
2. Monaco's default editor keybindings are mirrored into Theia's own
   keybinding registry by `MonacoKeybindingContribution` (from
   `@theia/monaco`), with an `editorTextFocus` `when` clause. Choosing
   `selectBindingByLocalContext` therefore prefers those defaults over an
   identical-scope binding with no `when`. To win the two colliding chords,
   the Ctrl+D (duplicate line vs. Monaco `addSelectionToNextFindMatch`) and
   Ctrl+L (delete line vs. Monaco `expandLineSelection`) bindings are
   registered with the same `editorTextFocus` `when`; since they are also
   registered later (higher priority), the keybinding tree selects them first
   while the chords stay free outside the editor.
3. Theia defaults checked rather than replaced: Monaco's find widget is kept
   (F3 / Shift+F3 map to Find Next / Find Previous).

### Unsaved-change close confirmation and OS drag-and-drop

- `NotepadiaCommands.CLOSE` (`notepadia.close`) wraps Theia's close-tab with a
  Save / Don't Save / Cancel dialog when the current editor is dirty, and the
  File > Close menu item points at it. `CLOSE_ALL` does the same and offers
  Save All. A `closeInProgress` guard prevents re-entrancy.
- Theia's browser app does not open OS-dropped files. `NotepadiaDropContribution`
  catches window-level drops that no other component handled and offers the
  built-in "Upload Files..." flow (`file.upload`) so dropped files can be
  copied into the workspace.
- Notepad++ never auto-saves. The stock Theia default is autosave on window
  change, so a companion workspace setting `files.autoSave: "off"` is
  recommended (shipped in the test workspace at `.theia/settings.json`).

### Encoding conversion

`NotepadiaEncodingContribution` gives the Encoding menu Notepad++-style
entries, all backed by Theia's iconv-lite pipeline rather than a new codec:

- `Encode in UTF-8`, `Encode in UTF-8 BOM`, `Encode in UTF-16 LE`,
  `Encode in UTF-16 BE`, `Convert to ANSI (Windows 1252)` call
  `editor.setEncoding(id, EncodingMode.Encode)`, which saves the buffer with
  that encoding (`EncodingMode.Decode` is used by `Reload as UTF-8`).
- `Change File Encoding...` links the built-in quick-pick (reopen/save with any
  supported encoding, including the ISO-8859 family).
- The status bar shows the current encoding and EOL of the active editor and is
  clickable to change encoding.
- BOM handling: Theia's `EncodingService` (iconv-lite) detects/emits UTF-16 LE,
  UTF-16 BE and UTF-8 BOMs. UTF-16 conversions therefore round-trip as-is.

Known pipeline limitation and workaround: when *writing*, `EncodingRegistry`
collapses `utf8bom` to `utf8` before the BOM decision is made, so a UTF-8 BOM
encode writes plain UTF-8. `ensureUtf8Bom()` in the encoding contribution
patches the file bytes with the `EF BB BF` prefix right after such an encode,
keeping the editor model's `utf8bom` content encoding intact (a subsequent read
detects the BOM again). Revisit once upstream `getEncodingForResource` stops
returning the iconv name.

### EOL conversion

`NotepadiaEolContribution` adds Notepad++-style line-ending conversion:
`Edit ▸ EOL Conversion ▸ Convert to Unix Format (LF)` and `Convert to Windows
Format (CRLF)` transform the buffer with Monaco's `ITextModel.setEOL`
(undoable on the model), and `Change Line Endings...` (also reachable by
clicking the EOL entry in the status bar) offers the same targets in a
quick-pick.

- Only LF and CRLF are offered. Monaco's line model splits exclusively on
  `\n`, so classic CR cannot be represented as a line separator inside the
  editor; CR files are still detected and shown as `CR` in the status bar.
- The status bar EOL/encoding entries refresh on both encoding changes and
  content changes, so conversions update live.
- Theia's built-in `EditorCommands.CONFIG_EOL`
  (`textEditor.commands.configEol`) is a command stub without a handler in
  this version, hence the dedicated commands above.

### Recent Files

`NotepadiaRecentFilesContribution` tracks opened editors (most recent first,
deduplicated, capped at 15) and renders them under `File ▸ Recent Files` with a
`Clear Recent Files` entry:

- The submenu is only present while the list is non-empty and is rebuilt on
  every open/clear; commands `notepadia.recent.N` and their menu actions are
  registered/disposed dynamically, so the menu never shows stale entries.
- History survives (re-)loads via `StorageService` (localStorage,
  key `notepadia.recentFiles`). Clicking an entry reopens the file and bumps it
  to the top.
- Theia 1.75 has no recent-files support, hence the custom implementation.

### Bookmarks

`NotepadiaBookmarkContribution` implements Notepad++-style bookmarks:

- `Ctrl+F2` toggles a bookmark on the current line, `F2`/`Shift+F2` jump to the
  next/previous bookmark (wrapping within the file), and `Edit ▸ Bookmarks ▸
  Clear All Bookmarks` empties the current file's set.
- Bookmarks are per-model (keyed by URI, sorted line numbers), session-scoped
  (Notepad++ keeps them per-session too) and rendered in the line-number gutter
  via a Monaco decoration collection (`linesDecorationsClassName`) with a CSS
  glyph injected at startup.
- One decoration collection is cached per editor (IEditorDecorationsCollection)
  and reused via `.set()`, so toggling updates in place instead of stacking
  decorations; a fresh collection is created when an editor hosting the same
  model becomes active.
- Monaco 1.108 removed `setModelDecorations`, hence `createDecorationsCollection`.

Note: menu-hovering must stay within the window — the Bookmarks entry sits at
the bottom of the Edit menu, so puppeteer suites need a viewport taller than
the menu (>= ~640px) for hover/submenu interactions.

### Search Results window (F7)

- `NotepadiaSearchResultsWidget` is a `ReactWidget` on
  `WidgetManager.getOrCreate` with id `notepadia.searchResults`, added to the
  shell's bottom area on first use. `NotepadiaSearchResultsContribution` binds
  F7 / F4 / Shift+F4, registers the four commands and puts them in
  `menubar ▸ 3_search`; the toolbar and command handlers call back into the same
  singleton, so F7 works before the panel has ever been opened.
- Producers are the dialog's two Find All buttons and Find in Files' Find All.
  `NotepadiaSearchDialogWidget` owns a `SearchInWorkspaceService` binding (the
  only user of that DI binding in the extension) so the dialog publishes to the
  window rather than calling it directly, which keeps widget construction in the
  binding container.
- Document hits come from Monaco's own search, so positions are converted with
  `monacoToTheiaPosition`. Workspace hits come from
  `SearchInWorkspaceService.searchWithCallback`, which reports matches but never
  how many files it read, so those headers stop at `in N files`.
- `Replace All` is deliberately not a producer: it runs on Theia's
  `search-in-workspace` service, whose replace path is separate from the search
  callback, and results would appear after the edits rather than drive them.
- The tree keeps one cursor, so F4 / Shift+F4 step through a flat list of
  visible hits and wrap; with no row chosen it starts from the editor's caret.

### Incremental Search (Ctrl+Alt+I)

`NotepadiaIncrementalSearchWidget` is a `ReactWidget` on `WidgetManager` id
`notepadia.incrementalSearch`, created through a `WidgetFactory` binding and
docked into the shell's bottom area on first use, mirroring the Search Results
window. `NotepadiaIncrementalSearchContribution` binds the toggle command, the
`ctrlcmd+alt+i` keybinding and the `Search ▸ Incremental Search` menu entry
(order `i.5`, between Matching Bracket and the Search Results entries).

- Every keystroke re-runs the search from the session anchor (the caret
  captured when the bar opened) with `findNextMatch`/`findPreviousMatch` and
  wrap; the term is resolved with the B2 `resolveSearch` helper and the mode
  from `NotepadiaSearchMarkContribution.searchMode()`, so mode and Match case
  come from the same shared sources the Find dialog uses, and the term is
  written back to `NotepadiaFindState`.
- `Enter` / `Shift+Enter` (and the **▲**/**▼** buttons) step by one occurrence
  and mark the session as accepted. `Escape` closes the bar and, unless a
  match was accepted, restores the anchor caret via the `initialSelection`
  captured on open.
- Highlight all is one `IEditorDecorationsCollection` reused with `.set()`
  (the same pattern as bookmarks and search-mark), styled by
  `notepadia-incremental-highlight`. A single `onKeyDown` on the container div
  owns the Escape / Enter handling, so Escape dismisses the bar no matter which
  control inside it has focus.
- A `no-match` class paints the field with
  `--theia-inputValidation-errorForeground`, and a `role="status"` region
  announces `no match` so the state is audible as well as visible.
- `ReactWidget` only renders on an update request once attached, and the
  shell's bottom-dock activation is asynchronous, so the widget forces an
  early render in `onAfterAttach` and the contribution's focus loop keeps
  requesting focus on the term field until it sticks - otherwise the first
  keystrokes would land in the editor.

### Language menu

`NotepadiaLanguageContribution` exposes Notepad++-style language handling (the
`Language` top-level menubar entry is both registered and populated by this one
contribution):

- **`Change Language Mode...`** wraps the built-in command
  (`textEditor.change.language`), which is otherwise hidden from palettes and
  menus by its own `isVisible` registration gate. It opens Monaco's own
  language quick-pick, which enumerates every registered language.
- **Curated language list** (JavaScript, TypeScript, HTML, CSS, Markdown, YAML,
  XML, Python, C, C++, C#, Java, PHP, Ruby, Go, Rust, Shell Script, SQL, Plain
  Text). Each entry is a menu action calling `editor.setLanguage(id)`, matching
  Notepad++'s `Language` menu.
- Because this build ships almost no registered languages (~`plaintext` and
  `jsonc` only), the contribution **registers the listed languages at startup**
  (`monaco.languages.register({ id, aliases, extensions })`) and attaches a
  lightweight Monarch tokenizer
  (`monaco.languages.setMonarchTokensProvider`) built from each entry's
  keyword/comment/string configuration. Registration is skipped for ids that
  already exist, so core languages are never overridden.
- The extra extensions give Monaco file-type auto-detection for free
  (`.js` → JavaScript, `.sh` → Shell Script, ...). `notepadiaLanguageName(id)`
  provides the friendly alias for the status bar.
- The status bar shows the friendly language name of the current editor and is
  clickable (opens the change-language quick-pick); it refreshes on
  `onLanguageChanged`, content changes, and encoding changes.

Enumeration caveat: Monaco's language service resolves a language by *id* only
once it is registered (TextMate grammars come from `@theia/textmate-grammars`,
which is not installed in this build). The built-in Monaco editor core ships no
`vs/language` data, so without a grammar package the Monarch tokenizers above
are the only real tokenization available; keyword/string/number tokens are
emitted (`mtk*` classes) but the stock theme only colors strings and numbers.

### Function List panel

- `NotepadiaFunctionListWidget` is a `ReactWidget` with id
  `notepadia.functionList`, created by `WidgetFactory` on first use and docked
  in the shell's **right** area by the shared `togglePanelWidget` helper
  (`Shell.addWidget(..., { area: 'right' })` then `activateWidget`), the same
  helper the Document List and Character Panel use. The contribution owns the
  `notepadia.functionList.toggle` command, its `isToggled` answer
  (`getAreaFor` + `isExpanded` + `widget.isVisible`) and the
  `View > Function List` item; the toolbar item calls the same command, so both
  paths toggle one singleton.
- Parsing lives in `common/function-list-rules.ts` and is deliberately *not* a
  parser: `parseFunctionList(text, languageId)` runs one regex per language over
  the text, skipping lines whose trimmed form starts with the language's comment
  prefix. A per-rule table maps language id to `{ kind, name, line }` regexes,
  and the table is bounded twice - `MAX_RULE_LINE_LENGTH` (500) drops absurdly
  long lines and `MAX_FUNCTION_ENTRIES` (5000) caps what one file can produce -
  so the editor's `onDidChangeContent` cannot be turned into a stall by a huge
  or generated file.
- The widget holds exactly one parser result for the model it is showing.
  `onCurrentEditorChanged` re-reads the editor and re-parses on every tab or
  split switch; content changes go through a 250 ms trailing debounce;
  `onDidChangeLanguage` re-parses because the rules are per language. Both the
  current editor and the language listener are disposed with the widget, and
  listeners are pushed off the model they belong to before a new one is attached
  so switching files cannot leak listeners into a closed editor.
- `bash` is accepted as an alias of this build's `shellscript` id, since the two
  spellings differ between Monaco language registrations.
- Rendering is a roving-`tabindex` ARIA `tree` with `treeitem` rows carrying
  `aria-level`, `aria-selected` and an `aria-activedescendant` on the tree.
  `ArrowUp` / `ArrowDown` / `Home` / `End` move the selection and `Enter` jumps
  to the selected row's line. A click and an `Enter` both call one `navigate`,
  which clamps the line to the model's length and uses `setPosition` +
  `revealPositionInCenterIfOutsideViewport` + `setSelection` on the control, so
  the caret lands on the declaration and the status bar agrees. Sorting
  (document order or A-Z) and the name filter are view state over the parsed
  entries, never a re-parse.

### Folder as Workspace panel

- There is no bespoke tree: the panel is Theia's File Navigator presented the
  way Notepad++ presents Folder as Workspace. The side panel header reads the
  hosting `ViewContainer`'s title, not the navigator widget's, so
  `NotepadiaShellContribution` retitles the container with id
  `explorer-view-container` to `Folder as Workspace`. Lumino's `title.changed`
  signal is used rather than a one-off assignment, so a later rename is
  corrected and the header re-renders; the label already matching makes the
  second pass a no-op, so the signal cannot loop.
- The container may be created on either side of this contribution's
  `onDidInitializeLayout`, so it is retitled both from
  `WidgetManager.onDidCreateWidget` (keyed on the container's factory id) and
  from `onDidInitializeLayout` via `getWidget`, whichever runs last.
- The tree is tightened in `style/notepadia-shell.css` behind the
  `body.notepadia-chrome` gate (20px rows, smaller expansion toggle, 12px
  segments). The built-in `none` icon theme is selected once on startup
  (`workbench.iconTheme`) so the names are plain, as they are in Notepad++, and
  only when the user has not already set the preference in any scope.
- `NotepadiaMenuContribution` trims the navigator's context menu in place with
  the existing `unregisterMenuAction` pattern, scoped to
  `NAVIGATOR_CONTEXT_MENU`: Open, New File, New Folder, Copy Path, Rename,
  Delete and Remove Folder stay; Open With, Copy/Paste, Copy Relative Path,
  Copy Download Link, Duplicate, Compare, Download/Upload and Collapse All go.
  A `Find in Files...` entry is registered in the menu's search group and opens
  the shared Find dialog on its Find in Files tab.
- The panel starts collapsed (`ApplicationShell.collapsePanel('left')` in
  `onDidInitializeLayout`), and `notepadia.view.toggleFolderWorkspace` answers
  `isToggled` from `shell.isExpanded('left')`, so the View item and the toolbar
  button are one state.

### Toolbar

`NotepadiaToolbarContribution` mounts the Notepad++ toolbar into the shell's
top area and `NotepadiaToolbarWidget` renders it as a 26px strip. Key
decisions:

- The widget is added in `onDidInitializeLayout` (not `onStart`) so the menu
  bar, which is added during the `onStart` phase, exists first.
- The declarative model lives in `notepadia-toolbar-items.ts`, which is
  deliberately **import-free** so the compiled module can be loaded from the
  Node-side unit tests; the tests cross-check every button's command id
  against the registered commands and fail the build if a button ever points
  at a command that does not exist.
- Theia 1.75 lays the top area out as a flex *row*, so a second widget would
  sit beside the menu bar. The stylesheet layer wraps the panel instead
  (`#theia-top-panel { flex-wrap: wrap }`, the toolbar at `flex: 0 0 100%`),
  putting the strip onto its own row below the menu bar.
- Lumino hard-sizes the top panel to its fit minimum (~the menu bar's 32px),
  which no CSS can grow, so a second row would sit behind the editor area and
  swallow clicks. The contribution raises the panel's box-layout **size
  basis** (`BoxPanel.setSizeBasis`, by exactly the 26px strip) and lowers it
  again when `View ▸ Toolbar` hides the toolbar, so the editor area shifts
  down below the strip.
- Accessibility: a single tab stop (roving tabindex, `nextFocusIndex` helpers
  unit-tested without a DOM), arrow + `Home`/`End` navigation, and
  `aria-pressed` only on buttons whose command reports a real toggled state
  (the `editor.wordWrap` preference gates the Word Wrap button because Theia's
  `toggleWordWrap` handler registers no `isToggled`).

## Automatic updates

The desktop app uses `electron-updater` fed by GitHub Releases
(`publish.provider: github` in `electron-builder.yml`).

- `extensions/notepadia/src/common/notepadia-updater-protocol.ts` defines the
  RPC path `/services/notepadia/updater`, the `NotepadiaUpdateStatus` model and
  the `NotepadiaUpdaterService` interface (RPC, proxied over the Electron IPC).
- `extensions/notepadia/src/electron-main/notepadia-updater.ts` implements the
  service in the electron-main process. It configures `autoUpdater`
  (`autoDownload: true`, `autoInstallOnAppQuit: true`) when
  `app.isPackaged`; otherwise it reports a `disabled` status. All
  `autoUpdater` events (checking, available, not-available, download-progress,
  downloaded, error) are forwarded to the connected frontend client.
- `extensions/notepadia/src/browser/notepadia-updater-contribution.ts` is the
  frontend half: it resolves the proxy from `ElectronIpcConnectionProvider`
  **only when `ElectronMainConnectionProvider` is bound** (i.e. in the Electron
  app, never in the browser app), auto-checks on start, exposes
  `Help ▸ Check for Updates...`, and prompts to restart once an update is
  downloaded.
- The electron-main module binds the service plus an
  `ElectronConnectionHandler` (`RpcConnectionHandler`) at `NotepadiaUpdaterPath`.

Upstream references: `@theia/core` `ElectronMainConnectionProvider` /
`ElectronConnectionHandler` / `ElectronMainApplicationContribution`, and the
`RpcServer` protocol from `@theia/core/lib/common/messaging/proxy-factory`.

## Desktop packaging

`applications/electron` builds the desktop app on the Electron target
(`@theia/electron` backend, `main: lib/backend/electron-main.js`) and packages
it with `electron-builder`:

- `yarn build:prod` produces the production frontend/backend bundles; this
  already runs `theia rebuild:electron` so native addons match Electron 42.
- Root helpers: `yarn package:win`, `yarn package:linux`, `yarn package:mac`
  each clean `dist`, rebuild the extension and the app, then run
  `electron-builder --publish never` for the given platform. `yarn package:preview`
  produces an unpacked `dist/win-unpacked` directory for quick inspection.
  Publishing itself is handled by CI (see [Releases & updates](releases.md)).
- NSIS target: assisted installer (`oneClick: false`) with a **fixed install
  directory** (`allowToChangeInstallationDirectory: false`): `electron-updater`
  can only apply updates for the default location.
- macOS builds are unsigned (`CSC_IDENTITY_AUTO_DISCOVERY=false`); a signing
  certificate is not configured yet.
- Linux metadata (category `Utility`, MIME types, artifact naming) lives in
  `electron-builder.yml`, and `package.json` must carry a `homepage` (RPM
  rejects a missing one). RPM/DEB go through electron-builder's bundled `fpm`
  (Ruby), which needs `libcrypt.so.1` on hosts without it.
- The packaged app ships the same `notepadia` extension as the browser app
  (verified by listing the `resources/app.asar` inside the extracted
  AppImage); product behavior is therefore identical between targets.
- Known packaging nitpicks (do not block): the default Electron icon is used
  (no brand icon shipped yet), and `desktopName`/window association is not set,
  so window-to-.desktop linking is generic until a dedicated icon/desktop
  name is configured.

## Testing

At minimum:

- command tests
- encoding round-trip tests
- EOL preservation tests
- session restore tests
- search/replace tests
- Electron smoke test
- Windows packaging smoke test