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

## Encoding boundary

Future encoding support should live behind:

```ts
interface DocumentEncodingService {
  detect(data: Uint8Array): DocumentEncoding;
  decode(data: Uint8Array, encoding: DocumentEncoding): string;
  encode(text: string, encoding: DocumentEncoding): Uint8Array;
}
```

The editor should work with normalized text; the persistence layer preserves
the selected encoding and EOL convention.

## Testing

At minimum:

- command tests
- encoding round-trip tests
- EOL preservation tests
- session restore tests
- search/replace tests
- Electron smoke test
- Windows packaging smoke test
