# Screen-reader test plan

This is the manual half of Notepadia's accessibility verification. The automated
suite (`e2e/a11y.cjs`, run by `yarn test:e2e`) reads the accessibility tree, but a
tree read is not a screen reader: only a real reader proves that names, roles,
live regions and focus movement are **announced** in a usable order. This page is
the script a person follows to produce that evidence, and the checklist they
fill in while doing it.

There are two runs, for the two readers that matter:

| Run | Reader | Platform | Build |
| --- | --- | --- | --- |
| **A** | [Orca](https://wiki.gnome.org/Projects/Orca) | Linux desktop | browser build at `http://127.0.0.1:3100` |
| **B** | [NVDA](https://www.nvaccess.org/) | Windows | packaged Electron build |

Run A is the one to do first: it is the browser target the maintainer uses, and
it needs no packaging. Run B needs a Windows machine and an installed build; the
*Test Builds (screen-reader evaluation)* GitHub Action produces that build
unsigned, from the Actions tab (`Workflow ▸ Test Builds… ▸ Run workflow`).

Whichever run you do, **record the exact announcement text**, not a summary. A
finding is only actionable if it names what the reader said.

## What counts as a defect

Listen for these specifically, because they are the failure shapes a tree read
cannot catch:

- **Silence.** A control, a state change or a result that the reader never
  announces.
- **Raw markup.** The reader speaks an attribute name, `[object HTMLDivElement]`,
  a codicon token like `$(bracket)`, or unrendered text.
- **A lost place.** After an action the reader reads from the top of the window
  instead of staying near what changed.
- **A wall of text.** A group read as one run-on string with no way to move
  through its parts.
- **A repeated or stale announcement.** The same thing read twice, or a count
  that does not match the visible one.
- **An unnamed control.** "Button", "edit", "checkbox" with no name.
- **A focus jump with no announcement.** Focus moves but the reader does not say
  where it went.

## Setup

### Run A — Orca on Linux (browser)

Use the harness script, which starts Orca with every announcement logged, opens
the app in Chrome for Testing with accessibility enabled, and then writes a
cleaned transcript of the announcements when you finish:

```bash
# 1. Build and serve the app on the port the plan uses.
yarn build:extensions && yarn build:browser
E2E_PORT=3100 yarn --cwd applications/browser start   # or: yarn start for :3000

# 2. Install orca and a speech backend, once.
sudo apt-get install -y orca speech-dispatcher

# 3. Start the session; the app window opens focused on the app's URL.
./scripts/orca-session.sh
#    ..., or:
#      ./scripts/orca-session.sh --no-chrome       # app already open your side
```

**Important — why the `--debug` flag matters.** The harness always passes
`orca --debug --debug-file=…`. Without `--debug`, Orca's debug file never gets
`SPEECH OUTPUT:` lines, so you would transcribe from nothing. The transcript
(`/tmp/orca-speech-transcript.txt` after a run, or any prior log with the
`--extract-only` option) is what you paste into the record below.

Notes:

- **Orca speaks audibly during the run** through the system speech-dispatcher;
  that is expected on a screen-reader run. The transcripts are what you keep.
  (There is no silent mode: this distro's speech-dispatcher `dummy` output
  module cannot open a device — "Cannot open plugin server" — so a silent
  backend is not available.)
- **Only the app window may be open and focused.** Orca announces whichever
  window currently has focus (on Wayland, a background process cannot grab it),
  so a clean transcript means nothing else in the way. Alt+Tab the app window
  into focus before each action, and keep other windows closed or minimised.
- The harness opens the app in **Chrome for Testing** with
  `--force-renderer-accessibility`; a plain browser tab without that flag may
  not expose an accessible tree at all. For the same reason there is no
  Firefox variant of this build.
- Turn SST (Screen Reader Optimized) on in the app if you see a prompt; it
  makes Monaco stop swallowing key events. The setting lives in
  *Settings ▸ Preferences ▸ Editor ▸ Accessibility Support*.
- Drive the app **by keyboard only**. Put the mouse away for the duration.
- If speech is too fast to transcribe, slow Orca's rate in *Orca Preferences ▸
  Speech* before starting; the log still captures the text.

### Run B — NVDA on Windows (packaged build)

1. Download the `notepadia-test-windows` artifact from the latest *Test Builds*
   run and install it.
2. Start NVDA before launching Notepadia.
3. Open NVDA's **Speech Viewer** (*NVDA menu ▸ Tools ▸ Speech Viewer*) and keep
   it visible: it shows every announcement as text you can copy into the report.
4. Note the versions for the record: NVDA, Windows, and **Notepadia** (*Help ▸
   About*).

## The checklist

Work top to bottom. In each table, **Action** is what you do, **Expect** is what
the reader should announce. Tick **OK**, or write the actual announcement under
**Heard** when it differs. Every "Expect" cell is a claim this plan exists to
check, so a mismatch is a finding even if it seems minor.

**NOTE THE PRIMARY FAILURE IS i CANNOT ACCESS THE CONTENTS OF THE MENU BAR AND THE RTABS OTHER THAN FIND WITH THE CIND MENU. IF I USE A MOUSE THESE SELCT CORRECTLY.** 
### 1. The keyboard ring

The ring is one Tab pass through the workbench. Tab to each stop in order and
record the first announcement at each.

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 1.1 | Tab into the window | The menu bar is announced as a menu bar, not "group" | ☐X | |
| 1.2 | Right arrow across the menu bar | Each of File, Edit, Search, … is named as you pass | ☐X | |
| 1.3 | Tab to the toolbar | The toolbar is announced, with the focused button's name | ☐X | |
| 1.4 | Left/Right across every toolbar button | Each button's name, or `disabled` but still present | ☐X | |
| 1.5 | Tab to the document tabs | The tab strip and the current tab are announced | ☐X | |
| 1.6 | Left/Right across the tabs | Each open document's name | ☐X | |
| 1.7 | Tab into the editor | "Editor content" (or the document), role code, not a bare edit box | ☐X | |
| 1.8 | Press Tab alone in the editor | Nothing moves focus; a tab is inserted (Notepad++ behaviour) | ☐X | |
| 1.9 | Press Escape, then Tab | Focus leaves the editor and the next stop is announced | ☐X | |
| 1.10 | Tab to the status bar | One stop whose name is not a codicon or an object | ☐X | |
| 1.11 | Read the status bar | The line/column/selection/length/encoding/EOL fields are intelligible, and you can hear them more than once without re-reading the whole window | ☐X | |
| 1.12 | Shift+Tab back through every stop | The same stops, in reverse, still named | ☐X | |

### 2. Menus

> **Orca-specific limitation (recorded 2026-10-12).** Orca 48.0 could not enter
> or open the menu bar (rows 2.1–2.6 below). The keyboard path itself is
> correct: `e2e/a11y.cjs` focuses a menu-bar item and asserts that **Down Arrow**
> and **Enter** each open the top-level menu — the same claim `accessibility.md`
> makes — and NVDA passed this section on the packaged Windows build. The
> failures are therefore treated as Orca's own menubar handling, not an app
> defect. The rows stay for the next Orca run so the limitation is re-measured
> rather than assumed.

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 2.1 | Open each top-level menu | Its name, then the first item | ☐ FAIL|SPACE, ENTER DO NOT ACTIVATE, DOWN ARROW MOVES TO TOOLBAR |
| 2.2 | Arrow through a menu with submenus | Each item named; a submenu says it has one | ☐ FAIL, CANNOT ACCESS| |
| 2.3 | Open *Edit ▸ Line Operations* | The submenu items named, not "blank" | ☐ FAIL, CANNOT ACCESS| |
| 2.4 | Open *Edit ▸ Insert ▸ Date & Time* | The nested items named | ☐ FAIL, CANNOT ACCESS| |
| 2.5 | Move across a menu separator | The reader does not stop on the separator | ☐ FAIL, CANNOT ACCESS| |
| 2.6 | Escape out of a menu | Focus returns to where it was, announced | ☐ FAIL, CANNOT ACCESS| |

### 3. The Find dialog (Ctrl+F, modeless)

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 3.1 | Ctrl+F with the editor focused | The dialog is announced as "Find and Replace" and focus lands in the term field | ☐x | |
| 3.2 | Tab through the Find tab | Each field has its label (Find what, …); each checkbox is named and reports checked/unchecked | ☐x | |
| 3.3 | Type a term, press Enter | The hit is selected and the result status is announced (e.g. the match count) | ☐ x| |
| 3.4 | Press Count | The count is announced | ☐ | |
| 3.5 | Press Find All in Current Document | The number of matches is announced and the Search Results window carries them | ☐x | |
| 3.6 | Open each of the Replace, Find in Files, Mark tabs | Each tab's controls are named; the tab itself announces selected | ☐ FAIL, CANNOT ACCESS| |
| 3.7 | On the Mark tab, run Bookmark line | The mark count is announced | ☐ FAIL, CANNOT ACCESS| |
| 3.8 | Escape / Close from the dialog | The dialog closes and focus returns to the editor, announced | ☐ X| |

### 4. Panels and the secondary surfaces

Open each through its menu (or key), then read it and interact.

| # | Surface | How to open | Expect | OK | Heard |
| - | ------- | ----------- | ------ | -- | ----- |
| 4.1 | Search Results | F7 (after a Find All) | Named as a tree; each hit group and line is reachable and named; stepping with F4 announces the result | ☐x | |
| 4.2 | Incremental Search | Ctrl+Alt+I | Named bar; typing announces a match count; a no-match term is announced as no match, not silence | ☐X | |
| 4.3 | Function List | View ▸ Function List | Named tree of functions; moving announces each; the filter is named | ☐ X| |
| 4.4 | Document Map | View ▸ Document Map | Named, and does not steal focus from the editor | ☐X| |
| 4.5 | Document List | View ▸ Document List | Named list; each open document announced | ☐ X| |
| 4.6 | Character Panel | View ▸ Character Panel | Named panel; a character's details are announced when chosen | ☐X | |
| 4.7 | Clipboard History | Edit ▸ Clipboard History | Named list of the last copies; each entry is intelligible | ☐X | |
| 4.8 | Summary | View ▸ Summary… | The dialog title, then each statistic (lines, words, chars, selection) is read | ☐X | |
| 4.9 | Column Editor | Edit ▸ Line Operations ▸ Column Editor… | Each field is named (Color/type, Text to insert, …, Leading zeros); the Insert button is named | ☐X | |
| 4.10 | Run | Run ▸ Run… | The Command to run and Save as fields are named; Run/Save/Cancel named | ☐ X| |
| 4.11 | Windows | Window ▸ Windows… | Each open document is announced with its Name, Path and Type; Activate/Save/Close/Sort named | ☐X | |
| 4.12 | Date & Time (customized) | Edit ▸ Insert ▸ Date & Time (customized)… | The format field is named "Date & time format"; Insert/Cancel named | ☐ X |
| 4.13 | Go To Line | Search ▸ Go To Line… | The line field is named; the result caret move is announced | ☐ X| |
| 4.14 | About | Help ▸ About (or the Notepad++ About entry) | The dialog title and its text are read once | ☐ X| |

### 5. Editing feedback (browser and desktop)

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 5.1 | Toggle Insert with the Insert key | The status bar changes to OVR and the change is announced | ☐X | |
| 5.2 | Set a document Read-Only | The status bar reads Read-Only and it is announced | ☐X| |
| 5.3 | Change the encoding | The new encoding is announced | ☐ X| |
| 5.4 | Convert line endings | The new EOL is announced | ☐X | |
| 5.5 | Save a document | The dirty indicator clears; no spurious "saved" prompt | ☐X | |
| 5.6 | Switch documents | The newly active tab and its document are announced | ☐X | |

### 6. Native file dialogs (Run B only)

Electron uses the operating system's Open/Save dialogs; NVDA must read them as it
reads any system dialog.

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 6.1 | File ▸ Open from Computer | The native Open dialog opens **in the user's home folder**, and NVDA reads the file list | ☐ X| |
| 6.2 | File ▸ Save To This Computer… | The native Save dialog opens in the home folder | ☐X | |
| 6.3 | File ▸ Upload to Workspace… | Its picker opens in the home folder | ☐X | |
| 6.4 | Cancel each dialog | Focus returns to the editor, announced | ☐X | |

## Recording the result

- **Pass:** every row ticked, and the version line filled in with the reader,
  platform and app build.
- **Finding:** the row number, the exact announcement (paste from the
  `/tmp/orca-speech-transcript.txt` the harness produced, or NVDA Speech
  Viewer), what you expected, and the steps. File it as an issue and
  label it `accessibility` and the reader's name.
- When a finding is fixed in source, it gains a guard in `e2e/a11y.cjs` so the
  accessibility-tree shape it depended on cannot silently return, and this plan's
  row stays in the checklist for the next run.

### Version record

Fill this in for each run and copy the confirmed result into
[Accessibility](accessibility.md).

Both runs are **pending**: they need a dedicated multi-system pass (a full
keyboard walk with a real reader, plus a Windows machine for Run B). Until one is
completed and this table is filled in, treat screen-reader support as
"structurally correct, unconfirmed in practice".

| Run | Reader and version | OS | App build | Date | Result |
| --- | ------------------ | -- | --------- | ---- | ------ |
| A | Orca 48.0 | Linux (GNOME / Wayland) | browser @ `3100` | — | **NOTE THE PRIMARY FAILURE IS i CANNOT ACCESS THE CONTENTS OF THE MENU BAR AND THE RTABS OTHER THAN FIND WITH THE CIND MENU. IF I USE A MOUSE THESE SELCT CORRECTLY.**  cat /tmp/orca-speech-transcript.txt
'Screen reader on.'
'Finished loading np-trust-ws - Notepadia.'
'tab'
'File.'
'opens menu'
'Focus mode'
'tab'
'New button.'
'New (Ctrl+Alt+N)'
'left shift'
'File.'
'opens menu'
'Edit.'
'opens menu'
'Search.'
'opens menu'
'Selection.'
'opens menu'
'View.'
'opens menu'
'Encoding.'
'opens menu'
'Go.'
'opens menu'
'Language.'
'opens menu'
'Macros.'
'opens menu'
'Run.'
'opens menu'
'Window.'
'opens menu'
'Settings.'
'opens menu'
'Help.'
'opens menu'
'tab'
'New button.'
'New (Ctrl+Alt+N)'
'Open from Computer button.'
'Save button.'
'Save (Ctrl+S)'
'Save All button.'
'Save All (Ctrl+Shift+S)'
'Close button.'
'Close (Ctrl+F4)'
'Close All button.'
'Close All (Ctrl+Alt+Shift+W)'
'Print button grayed.'
'Cut button.'
'Cut (Ctrl+X)'
'Copy button.'
'Copy (Ctrl+C)'
'Paste button.'
'Paste (Ctrl+V)'
'Undo button.'
'Undo (Ctrl+Z)'
'Redo button.'
'Redo (Ctrl+Y)'
'Find... button.'
'Find... (Ctrl+F)'
'Replace... button.'
'Replace... (Ctrl+H)'
'Find Next button grayed.'
'Find Previous button grayed.'
'Zoom In button grayed.'
'Zoom In (Ctrl+=)'
'Zoom Out button grayed.'
'Zoom Out (Ctrl+-)'
'Restore Default Zoom button grayed.'
'Word Wrap toggle button pressed.'
'Word Wrap (Alt+Z)'
'Show All Characters toggle button not pressed grayed.'
'Document Map toggle button not pressed grayed.'
'Folder as Workspace toggle button not pressed.'
'Function List toggle button not pressed.'
'Start Recording toggle button not pressed grayed.'
'Stop Recording button grayed.'
'Play Recording button grayed.'
'New button.'
'New (Ctrl+Alt+N)'
'Open from Computer button.'
'File Upload - np-trust-ws - Notepadia — WORK — Mozilla Firefox frame'
'np-trust-ws - Notepadia — WORK — Mozilla Firefox frame'
'Open from Computer button.'
'Focus mode'
'Browse mode'
'menu'
'NewCtrl+Alt+N.'
'Focus mode'
'Open from ComputerCtrl+Alt+O.'
'Open from Workspace...'
'Upload to Workspace...'
'Open Folder as Workspace...Ctrl+Alt+O.'
'Open from Computer button.'
'Browse mode'
'Navigate Up One Directory.'
'Open button.'
'np-trust-ws - Notepadia document web'
'np-trust-ws - Notepadia page tab.'
'Finished loading Notepadia.'
'notepadia-theia-1.75.0 - Notepadia'
'tab'
'File.'
'opens menu'
'Focus mode'
'tab'
'New button.'
'New (Ctrl+Alt+N)'
'tab'
'Status bar Plain Text Ln : 1 Col : 1 Pos : 0 Sel : 0 | 0 length : 0 lines : 0 UTF-8 LF Spaces: 4 INS'
'Browse mode'
'tab'
'notepadia-theia-1.75.0 - Notepadia page tab.'
'tab'
'Open a new tab (Ctrl+T) button.'
'opens popup'
'tab'
'Sidebars button.'
'Show sidebar (Alt+Ctrl+Z)'
'tab'
'View site information button.'
'tab'
'Search with Google or enter address editable combo box Search with Google or enter address.'
'opens popup'
'tab'
'tab'
'Bookmark this page (Ctrl+D) button.'
'tab'
'VPN button.'
'tab'
'File.'
'opens menu'
'Focus mode'
'tab'
'New button.'
'New (Ctrl+Alt+N)'
'tab'
'Status bar Plain Text Ln : 1 Col : 1 Pos : 0 Sel : 0 | 0 length : 0 lines : 0 UTF-8 LF Spaces: 4 INS'
'Browse mode'
'caps lock'
'left shift'
'New button.'
'New (Ctrl+Alt+N)'
'Focus mode'
'notepadia-theia-1.75.0 - Notepadia document web'
'Browse mode'
'menu'
'Search.'
'Focus mode'
'Folder as Workspace.'
'New button.'
'New (Ctrl+Alt+N)'
'tab'
'More Actions... button.'
'Browse mode'
'tab'
'tab'
'tab'
'More Actions... button.'
''
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0.'
'NOTEPADIA-THEIA-1.75.0.'
'More Actions... button.'
'Collapse All button.'
'Refresh Explorer button.'
'New Folder... button.'
'New File... button.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/.github.'
''
'clickable.'
'.github.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/.idea.'
''
'clickable.'
'.idea.'
'tab'
'Status bar Plain Text Ln : 1 Col : 1 Pos : 0 Sel : 0 | 0 length : 0 lines : 0 UTF-8 LF Spaces: 4 INS'
'tab'
'notepadia-theia-1.75.0 - Notepadia page tab.'
'caps lock'
'left shift'
'Browser tabs tool bar.'
'Plain Text Ln : 1 Col : 1 Pos : 0 Sel : 0 | 0 length : 0 lines : 0 UTF-8 LF Spaces: 4 INS'
'New File... button.'
'tab'
'left shift'
'New File... button.'
'New Folder... button.'
'Refresh Explorer button.'
'Collapse All button.'
'More Actions... button.'
'More Actions... button.'
'tab'
'tab'
'tab'
'More Actions... button.'
'tab'
'Collapse All button.'
'tab'
'Refresh Explorer button.'
'tab'
'New Folder... button.'
'tab'
'New File... button.'
'tab'
'tab'
''
'clickable.'
'.idea.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/.vscode.'
''
'clickable.'
'.vscode.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/.yarn.'
''
'clickable.'
'.yarn.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/applications.'
''
'clickable.'
'applications.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/docs.'
''
'clickable.'
'docs.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/e2e.'
''
'clickable.'
'e2e.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/e2e-artifacts.'
''
'clickable.'
'e2e-artifacts.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/extensions.'
''
'clickable.'
'extensions.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/node_modules.'
''
'clickable.'
'node_modules.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/prompt.'
''
'clickable.'
'prompt.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/scripts.'
''
'clickable.'
'scripts.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/site.'
''
'clickable.'
'site.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/.dockerignore.'
'.dockerignore.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/.gitignore.'
'.gitignore.'
''
'e'
'x'
'e'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/node_modules.'
''
'clickable.'
'node_modules.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/prompt.'
''
'clickable.'
'prompt.'
'/home/ryhunsaker/Documents/projects/notepadia-theia-1.75.0/scripts.'
''
'clickable.'
'scripts.'
'left control'
'n'
'WORK — Mozilla Firefox frame'
'Search with Google or enter address editable combo box Search with Google or enter address.'
'opens popup'
'notepadia-theia-1.75.0 - Notepadia — WORK — Mozilla Firefox frame'
'New button.'
'New (Ctrl+Alt+N)'
'Focus mode'
'Editor content editor.'
'opens popup'
'tab'
'tab'
'Main stage window.'
'WORK — Mozilla Firefox button.'
'notepadia-theia-1.75.0 – screen-reader-test-plan.md button.'
'● new 1 - notepadia-theia-1.75.0 - Notepadia — WORK — Mozilla Firefox frame'
'tab'
'new 1  page tab.'
'Focus mode'
'tab'
'Editor content editor     '
'opens popup'
'tab'
'tab'
'tab'
'tab'
'left control'
'left control'
'tab'
'tab'
'page tab.'
't'
'p'
'p'
'c'
'd'
'rust'
'ws'
'Editor content editor             '
'opens popup'
'● new 1 - notepadia-theia-1.75.0 - Notepadia page tab.'
'ho'
'e/ryhunsaker'
'D'
'cum'
'ts/pr'
'j'
'cts'
'ote'
'adia'
'heia'
'1.75.0'
'tool tip np-trust-ws - Notepadia 127.0.0.1'
'page tab.'
't'
'p'
'p'
'c'
'd'
'rust'
'ws'
'tab'
'File.'
'opens menu'
'tab'
'New button.'
'New (Ctrl+Alt+N)'
'tab'
'Status bar Plain Text Ln : 1 Col : 1 Pos : 0 Sel : 0 | 0 length : 0 lines : 0 UTF-8 LF Spaces: 4 INS'
'Browse mode'
'tab'
'np-trust-ws - Notepadia page tab.'
'tab'
'Open a new tab (Ctrl+T) button.'
'opens popup'
'left control'
'tab'
'● new 1 - notepadia-theia-1.75.0 - Notepadia page tab.'
'ho'
'Editor content editor             '
'opens popup'
'Focus mode'
'e/ryhunsaker'
'D'
'cum'
'ts/pr'
'j'
'cts'
'ote'
'adia'
'heia'
'1.75.0'
'tab'
'tab'
'page tab.'
't'
'p'
'p'
'c'
'd'
'rust'
'ws'
'tab'
'● new 1 - notepadia-theia-1.75.0 - Notepadia page tab.'
'ho'
'Editor content editor             '
'opens popup'
'e/ryhunsaker'
'D'
'cum'
'ts/pr'
'j'
'cts'
'ote'
'adia'
'heia'
'1.75.0'
'tab'
'tab'
'page tab.'
't'
'p'
'p'
'c'
'd'
'rust'
'ws'
'left control'
'tab'
'File.'
'opens menu'
'tab'
'New button.'
'New (Ctrl+Alt+N)'
'tab'
'Status bar Plain Text Ln : 1 Col : 1 Pos : 0 Sel : 0 | 0 length : 0 lines : 0 UTF-8 LF Spaces: 4 INS'
'Browse mode'
'tab'
'np-trust-ws - Notepadia page tab.'
'left shift'
'Browser tabs tool bar.'
'Plain Text Ln : 1 Col : 1 Pos : 0 Sel : 0 | 0 length : 0 lines : 0 UTF-8 LF Spaces: 4 INS'
'tab'
'np-trust-ws - Notepadia page tab.'
'tab'
'Open a new tab (Ctrl+T) button.'
'opens popup'
'tab'
'Sidebars button.'
'Show sidebar (Alt+Ctrl+Z)'
'tab'
'View site information button.'
'tab'
'Search with Google or enter address editable combo box Search with Google or enter address.'
'opens popup'
'tab'
'tab'
'Bookmark this page (Ctrl+D) button.'
'tab'
'VPN button.'
'tab'
'File.'
'opens menu'
'Focus mode'
'tab'
'New button.'
'New (Ctrl+Alt+N)'
'left shift'
'File.'
'opens menu'
'VPN button.'
'tab'
'File.'
'opens menu'
'Focus mode'
'tab'
'New button.'
'New (Ctrl+Alt+N)'
'left shift'
'File.'
'opens menu'
'Open from Computer button.'
'tab'
'Status bar Plain Text Ln : 1 Col : 1 Pos : 0 Sel : 0 | 0 length : 0 lines : 0 UTF-8 LF Spaces: 4 INS'
'Browse mode'
'left shift'
'New button.'
'New (Ctrl+Alt+N)'
'Focus mode'
'File.'
'opens menu'
'Open from Computer button.'
'left shift'
'New button.'
'New (Ctrl+Alt+N)'
'left shift'
'File.'
'opens menu'
'Edit.'
'opens menu'
'File.'
'opens menu'
'Open from Computer button.'
'left shift'
'New button.'
'New (Ctrl+Alt+N)'
'left shift'
'File.'
'opens menu'
'space'
'Open from Computer button.'
'New button.'
'New (Ctrl+Alt+N)'
'Play Recording button grayed.'
'Stop Recording button grayed.'
'Start Recording toggle button not pressed grayed.'
'Folder as Workspace toggle button not pressed.'
'Show All Characters toggle button not pressed grayed.'
'Word Wrap toggle button pressed.'
'Word Wrap (Alt+Z)'
'Restore Default Zoom button grayed.'
'Zoom Out button grayed.'
'Zoom Out (Ctrl+-)'
'Find Previous button grayed.'
'left shift'
'File.'
'opens menu'
'Help.'
'opens menu'
'File.'
'opens menu'
'Help.'
'opens menu'
'File.'
'opens menu'
'Open from Computer button.'
'left control'
'tab'
'● new 1 - notepadia-theia-1.75.0 - Notepadia page tab.'
'Editor content editor             '
'opens popup'
'ho'
'e/ryhunsaker'
'D'
'cum'
'ts/pr'
'j'
'cts'
'ote'
'adia'
'heia'
'1.75.0'
'left control'
'left control'
'tab'
'tab'
'np-trust-ws - Notepadia page tab.'
't'
'p'
'Open from Computer button.'
'p'
'c'
'd'
'rust'
'ws'
'left shift'
'File.'
'opens menu'
'return'
'Open from Computer button.'
'left shift'
'File.'
'opens menu'
'space'
'Open from Computer button.'
'z'
'q'
'left shift'
'File.'
'opens menu'
'Open from Computer button.'
'left shift'
'File.'
'opens menu'
'left alt'
'File menu collapsed.'
'f'
'New Tab.'
'Ctrl+T.'
'escape'
'File.'
'opens menu'
'Focus mode'
'escape'
'escape'
'tab'
'Find Previous button grayed.'
'left control'
'tab'
'● new 1 - notepadia-theia-1.75.0 - Notepadia page tab.'
'ho'
'Editor content editor             '
'opens popup'
'e/ryhunsaker'
'D'
'cum'
'ts/pr'
'j'
'cts'
'ote'
'adia'
'heia'
'1.75.0'
'left shift'
'left shift'
'left control'
'left control'
'tab'
'tab'
'np-trust-ws - Notepadia page tab.'
't'
'Find Previous button grayed.'
'p'
'p'
'c'
'd'
'rust'
'ws'
'left shift'
'File.'
'opens menu'
'Open from Computer button.'
'left shift'
'File.'
'opens menu'
'Edit.'
'opens menu'
'Open from Computer button.'
'left shift'
'Edit.'
'opens menu'
'Search.'
'opens menu'
'Open from Computer button.'
'left shift'
'Search.'
'opens menu'
'Selection.'
'opens menu'
'return'
'Open from Computer button.'
'left shift'
'Selection.'
'opens menu'
'space'
'Open from Computer button.'
'escape'
'left control'
'f'
'tool tip ● new 1 - notepadia-theia-1.75.0 - Notepadia 127.0.0.1'
'Editor content editor         '
'opens popup'
'● new 1 - notepadia-theia-1.75.0 - Notepadia page tab.'
'ho'
'e/ryhunsaker'
'D'
'cum'
'ts/pr'
'j'
'cts'
'ote'
'adia'
'heia'
'1.75.0'
'Browse mode'
'Editor content editor # Notepadi.'
'opens popup'
'Focus mode'
'Browse mode'
'Editor content editor # Notepadia - browser application image.
'opens popup'
'Focus mode'
'a - browser application image.
'ENV PUPPETEER_SKIP_DOWNLOAD=true
'left control'
'left control'
'f'
'f'
'Find what editable combo box Find what.'
'opens popup'
'tab'
'tab'
'Options panel'
'Backward direction check box not checked.'
'Browse mode'
'tab'
'Match whole word only check box not checked.'
'tab'
'Match case check box not checked.'
'tab'
'Wrap around check box checked.'
'tab'
'In selection check box not checked.'
'tab'
'Search Mode panel'
'Normal selected radio button.'
'tab'
'Find Next button.'
'tab'
'Count button.'
'tab'
'Find All in Current Document button.'
'tab'
'Find All in All Opened Documents button.'
'tab'
'Close button.'
'tab'
'Dockerfile - notepadia-theia-1.75.0 - Notepadia page tab.'
'tab'
'Open a new tab (Ctrl+T) button.'
'opens popup'
'left shift'
'Dockerfile - notepadia-theia-1.75.0 - Notepadia page tab.'
'np-trust-ws - Notepadia page tab.'
'left shift'
'Browser tabs tool bar.'
'Plain Text Ln : 1 Col : 1 Pos : 0 Sel : 0 | 0 length : 0 lines : 0 UTF-8 LF Spaces: 4 INS'
'Find Previous button grayed.'
'Focus mode'
'left control'
'tab'
'Dockerfile - notepadia-theia-1.75.0 - Notepadia page tab.'
'ho'
'e/ryhunsaker'
'D'
'cum'
'ts/pr'
'j'
'cts'
'ote'
'adia'
'heia'
'1.75.0'
'left shift'
'Find what editable combo box Find what.'
'opens popup'
'left shift'
'left shift'
'Close button.'
'Browse mode'
'Find page tab.'
'Focus mode'
'tab'
'Close button.'
'Browse mode'
'left shift'
'Find page tab.'
'Focus mode'
'tab'
'Close button.'
'Browse mode'
'tab'
'Find what editable combo box Find what.'
'opens popup'
'Focus mode'
'tab'
'tab'
'Options panel'
'Backward direction check box not checked.'
'Browse mode'
'tab'
'Match whole word only check box not checked.'
'tab'
'Match case check box not checked.'
'tab'
'Wrap around check box checked.'
'tab'
'In selection check box not checked.'
'tab'
'Search Mode panel'
'Normal selected radio button.'
'tab'
'Find Next button.'
'tab'
'Count button.'
'tab'
'Find All in Current Document button.'
'tab'
'Find All in All Opened Documents button.'
'tab'
'Close button.'
'tab'
'Dockerfile - notepadia-theia-1.75.0 - Notepadia page tab.'
'tab'
'Open a new tab (Ctrl+T) button.'
'opens popup'
'space'
'Search with Google or enter address editable combo box Search with Google or enter address.'
'opens popup'
'tool tip Dockerfile - notepadia-theia-1.75.0 - Notepadia 127.0.0.1'
'page tab.'
'tool tip np-trust-ws - Notepadia 127.0.0.1'
'Mark page tab.'
'Focus mode'
'Find what editable combo box Find what.'
'opens popup'
'tab'
'tab'
'Marking style panel'
'Style 1 selected radio button.'
'Browse mode'
'tab'
'Purge for each search check box not checked.'
'tab'
'Options panel'
'Backward direction check box not checked.'
'tab'
'Match whole word only check box not checked.'
'tab'
'Match case check box not checked.'
'tab'
'Wrap around check box checked.'
'tab'
'In selection check box not checked.'
'tab'
'Search Mode panel'
'Normal selected radio button.'
'tab'
'Mark All button.'
'tab'
'Clear All Marks button.'
'tab'
'Select and Find Next button.'
'tab'
'Dockerfile - notepadia-theia-1.75.0 - Notepadia page tab.'
'tab'
'Open a new tab (Ctrl+T) button.'
'opens popup'
'tab'
'Sidebars button.'
'Show sidebar (Alt+Ctrl+Z)'
'Main stage window.'
'WORK — Mozilla Firefox button.'
'notepadia-theia-1.75.0 – screen-reader-test-plan.md button.'
'WORK — Mozilla Firefox button.'
'WORK — Mozilla Firefox frame'
'Search with Google or enter address editable combo box Search with Google or enter address.'
'opens popup'
'Main stage window.'
'notepadia-theia-1.75.0 – screen-reader-test-plan.md button.'
'Dockerfile - notepadia-theia-1.75.0 - Notepadia — WORK — Mozilla Firefox frame'
'Sidebars button.'
'Show sidebar (Alt+Ctrl+Z)'
'Find what editable combo box Find what.'
'opens popup'
'Focus mode'
'Find page tab.'
'Find what editable combo box Find what.'
'opens popup'
'Text unselected.'
'left shift'
'left shift'
'C'
'C'
'O'
'O'
'P'
'P'
'left shift'
'left shift'
'A'
'A'
'backspace'
'backspace'
'd'
'backspace'
'backspace'
'e'
'backspace'
'backspace'
'n'
'backspace'
'backspace'
'w'
'backspace'
'backspace'
'o'
'backspace'
'backspace'
'h'
'backspace'
'backspace'
'c'
'backspace'
'backspace'
'left shift'
'left shift'
'C'
'C'
'O'
'O'
'P'
'P'
'left shift'
'left shift'
'Y'
'Y'
'return'
'return'
'1 of 4'
'F7'
'F7'
'F7'
'F7'
'F7'
'F7'
'return'
'return'
'2 of 4'
'menu'
'COPY.'
'Find what editable combo box Find what.'
'opens popup'
'Focus mode'
'menu'
'COPY.'
'return'
'return'
'Find what editable combo box Find what.'
'opens popup'
'Focus mode'
'F4'
'F4'
'F4'
'F4'
'F7'
'F7'
'F4'
'F4'
'Dockerfile - notepadia-theia-1.75.0 - Notepadia document web'
'Browse mode'
'Editor content editor         pkg-config \
'opens popup'
'Focus mode'
'F7'
'F7'
'F4'
'F4'
'Find what editable combo box Find what.'
'opens popup'
'return'
'return'
'1 of 4'
'F4'
'F4'
'F7'
'F7'
'tool tip New Tab about:newtab'
'Browse mode'
'menu'
'Toolbar check menu item checked.'
'Focus mode'
'Command Palette...Ctrl+Shift+P.'
'Open View...'
'Document List.'
'Editor content editor         make \
'opens popup'
'Dockerfile - notepadia-theia-1.75.0 - Notepadia — WORK — Mozilla Firefox frame'
'Editor content editor         make \
'opens popup'
'Focus mode'
'left alt'
'left alt'
's'
's' |
| B | NVDA | Windows | packaged `v…` | — | Everything passed EXCEPT accessing the tabs inside the find dialog with NVDA. |
