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
   `selectBindingByLocalContext` therefore prefers those defaults over a
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

## Desktop packaging

`applications/electron` builds the desktop app on the Electron target
(`@theia/electron` backend, `main: lib/backend/electron-main.js`) and packages
it with `electron-builder`:

- `yarn build:prod` produces the production frontend/backend bundles; this
  already runs `theia rebuild:electron` so native addons match Electron 42.
- `npx electron-builder --linux AppImage -p never` yields
  `dist/Notepadia-<version>-x86_64.AppImage`.
- `npx electron-builder --linux rpm -p never` yields
  `dist/Notepadia-<version>-x86_64.rpm`.
- `npx electron-builder --linux deb -p never` yields
  `dist/Notepadia-<version>-amd64.deb`. Linux metadata (category `Utility`,
  MIME types, artifact naming) lives in `electron-builder.yml`, and
  `package.json` must carry a `homepage` (RPM rejects a missing one).
- RPM/DEB go through electron-builder's bundled `fpm` (Ruby), which needs
  `libcrypt.so.1`. Hosts that lack it still build if the library is provided
  via `LD_LIBRARY_PATH` (e.g. a copy from a bundled runtime).
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
