# Differences from Notepad++

This document lists the deliberate deviations from Notepad++. Nothing here is
an omission by accident; the design traded the full Notepad++ feature set for
a browser-compatible, minimal implementation built on Theia/Monaco.

## Platform and architecture

| Difference | Rationale |
| --- | --- |
| **No standalone multi-instance** | The browser app runs in a single tab and the desktop app runs one instance; workspace is shared, not per-instance. |
| **Shared server/workspace model** | When served, the workspace is the directory on the server; `Open from Computer` / `Save To This Computer...` / `Upload to Workspace...` are the explicit bridges between local disk and the server workspace. |
| **Browser-first target** | Some accelerators the browser claims can never reach the page - alternate chords are provided and the desktop build behaves like Notepad++ for those chords. |
| **Built on Theia + Monaco 1.75** | No fork of the editor engine; we adapt the UI and commands to match Notepad++'s UX. |

## UI and chrome

| Difference | Rationale |
| --- | --- |
| **No activity bar, no right-hand panel (default), no breadcrumbs** | Shell chrome is reduced to Notepad++'s shape (menu, toolbar, editor area, status bar, folder/workspace panel, function list). |
| **No Style Configurator** | Visual theming is limited to Notepadia Classic light/dark themes via CSS. No custom style schemes editor. |
| **No Document List "Move To Another View" context quirks** | Only two panes are supported; `Clone to Other View` / `Move to Other View` are offered, with synchronized scrolling. |
| **No separate multi-root Project Panels 1-3** | Only `Folder as Workspace` is implemented (a single tree). |
| **Document Map is preference-backed** | Mirrors `editor.minimap.enabled` and persists per profile; the code keeps it in sync across all editors. |
| **Tab icons** | Red/blue floppy for saved/dirty, padlock for read-only; matches Notepad++'s visual language rather than VS Code's dot. |
| **Show Wrap Symbol not offered** | Monaco 1.75 has no wrapping-indicator option the UI can bind. `Show All Characters` remains available from the toolbar and `View ▸ Show Symbol`. |

## Search, Find, Incremental Search

| Difference | Rationale |
| --- | --- |
| **`. matches newline` is disabled** | The editor's search engine matches within a single line. The checkbox is shown disabled with an explanation rather than silently doing nothing. |
| **Find-in-Files results header** | The workspace search backend reports the matches it found but never how many files it looked at; the header stops at `in N files` (no `of N searched`). |
| **Incremental Search bar** | Live per-keystroke jumping from caret with wrap-around, Highlight all, red `no match` announced via aria-live, and Escape restores caret until a jump is accepted - this matches Notepad++'s behavior while adapting to Monaco. |
| **Search Results window behavior** | F4/Shift+F4 walk hits with wrap-around, starting from caret when nothing is focused. A polite live region announces new counts when groups are added. |

## Languages, Function List, Mark

| Difference | Rationale |
| --- | --- |
| **Curated language set (not all Monaco languages)** | 21 common languages with lightweight Monarch tokenizers to keep startup small and to match the Language menu Notepad++ shows. |
| **Function List is regex-based** | Built by matching each language's declaration syntax, not by parsing the file. Declarations the patterns miss will not be listed. |
| **Mark styles** | Five styles via marker decorations; `Purge for each search` and the `Select and Find Next` flow follow Notepad++. |

## Commands and filesystem

| Difference | Rationale |
| --- | --- |
| **Session files are explicit (`Save Session... / Load Session...`)** | Sessions save open tabs, order, active tab, caret positions and bookmarks to a named file; no automatic session autosave beyond Theia's core where applicable. |
| **Print is an in-browser print window** | A browser cannot print arbitrary local files the way a desktop app can; a dedicated print window renders the document as plain text with line numbers and a file-name header, then invokes `window.print()`. |
| **Rename restricts to relative path inside workspace** | Refuses `..` and absolute paths - "Rename" should not be a cross-workspace move. |
| **Save a Copy As leaves the tab on the original** | Preserves the open document's identity; the next `Ctrl+S` still goes to the original file. |
| **Crash recovery is IndexedDB-backed (browser)** | Theia 1.75's `StorageService` is localStorage-only (small synchronous string store). Unsaved changes are persisted to IndexedDB a few seconds after typing stops, restored on next launch, marked dirty, and oversized copies are dropped. This never writes to the server. |
| **Macros are in-memory only** | Macro recordings do not survive restart. No "Manage macros" persistence to disk beyond the session. |
| **Run... browser limitation** | In the browser, only `http://`/`https://` commands open in a new tab; starting a program requires the desktop build and `notepadia.run.allowProcessLaunch` preference (off by default). |

## Browser-specific chords

| Difference | Rationale |
| --- | --- |
| **Browser-safe alternates for claimed chords** | `Ctrl+N`, `Ctrl+W`, `Ctrl+Shift+W`, `Ctrl+O`, `F5`, `Ctrl+F5` are trapped by the browser. We provide `Ctrl+Alt+N`, `Ctrl+F4`, `Ctrl+Alt+Shift+W`, `Ctrl+Alt+O`, `Ctrl+Alt+D`, `Ctrl+Alt+Shift+D`. In the desktop app, the original chords work. |
| **Editor zoom wins on editor focus** | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` zoom the editor text when the editor has focus, leaving page zoom to the browser elsewhere. |
| **File System Access API constraints** | Ctrl+S write-back to the same local file only works in Chromium with a secure context and a kept file handle. Firefox/Safari fall back to Save As/download. |

## Encoding and line endings

| Difference | Rationale |
| --- | --- |
| **Only LF/CRLF offered in EOL conversion UI** | Monaco's line model splits on `\n`; classic CR cannot be a separator inside the editor. CR files are detected and shown as `CR` in the status bar. |
| **UTF-8 BOM encoding patch** | Upstream `utf8bom` gets collapsed to `utf8` at write time, so the BOM is patched after write to survive round-trips. |

## Miscellaneous

| Difference | Rationale |
| --- | --- |
| **Column Editor** | `Edit ▸ Line Operations ▸ Column Editor...` inserts text, sequential numbers or cycled repeated text down the selected lines, including rectangular blocks. It is a dialog, like Notepad++. **Column Mode** (`Alt+C`) converts the current selection to a rectangular block directly, with no dialog. |
| **Extended search escapes** | Implements Notepad++'s escapes (`\n`, `\r`, `\t`, `\0`, `\\`, `\xHH`, `\oOOO`, `\dDDD`, `\bBBBBBBBB`); unrecognised escapes pass through literally, as in Notepad++. |
| **Notepad++ plugins are not supported** | No plugin host; the feature set is fixed to what the `notepadia` extension provides. |
| **Style/formatting off by default** | Deliberate to match a "plain text" Notepad++ behavior profile (no suggestions, no auto-format, no auto-closing). |
| **No multi-select drag of arbitrary blocks in all cases** | We rely on Monaco's `Alt+drag` for rectangular selection; `Alt+C` converts the current selection to a block. Some edge cases differ slightly from Notepad++. |

If something looks like an omission, check this page first. Bug reports that
are really expectation mismatches are far easier to close once this list is
acknowledged.