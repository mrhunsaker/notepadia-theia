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

```bash
# 1. Build and serve the app on the port the plan uses.
yarn build:extensions && yarn build:browser
E2E_PORT=3100 yarn --cwd applications/browser start   # or: yarn start for :3000

# 2. Install orca and a speech backend, once.
sudo apt-get install -y orca speech-dispatcher

# 3. Start Orca with speech logging so the announcements are saved as text.
#    Orca writes to the file given by --debug-file; the file is appended to.
orca --debug-file=/tmp/orca-speech.log &
```

Notes:

- Turn SST (Screen Reader Optimized) on in the app if you see a prompt; it makes
  Monaco stop swallowing key events. The setting lives in
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

### 1. The keyboard ring

The ring is one Tab pass through the workbench. Tab to each stop in order and
record the first announcement at each.

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 1.1 | Tab into the window | The menu bar is announced as a menu bar, not "group" | ☐ | |
| 1.2 | Right arrow across the menu bar | Each of File, Edit, Search, … is named as you pass | ☐ | |
| 1.3 | Tab to the toolbar | The toolbar is announced, with the focused button's name | ☐ | |
| 1.4 | Left/Right across every toolbar button | Each button's name, or `disabled` but still present | ☐ | |
| 1.5 | Tab to the document tabs | The tab strip and the current tab are announced | ☐ | |
| 1.6 | Left/Right across the tabs | Each open document's name | ☐ | |
| 1.7 | Tab into the editor | "Editor content" (or the document), role code, not a bare edit box | ☐ | |
| 1.8 | Press Tab alone in the editor | Nothing moves focus; a tab is inserted (Notepad++ behaviour) | ☐ | |
| 1.9 | Press Escape, then Tab | Focus leaves the editor and the next stop is announced | ☐ | |
| 1.10 | Tab to the status bar | One stop whose name is not a codicon or an object | ☐ | |
| 1.11 | Read the status bar | The line/column/selection/length/encoding/EOL fields are intelligible, and you can hear them more than once without re-reading the whole window | ☐ | |
| 1.12 | Shift+Tab back through every stop | The same stops, in reverse, still named | ☐ | |

### 2. Menus

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 2.1 | Open each top-level menu | Its name, then the first item | ☐ | |
| 2.2 | Arrow through a menu with submenus | Each item named; a submenu says it has one | ☐ | |
| 2.3 | Open *Edit ▸ Line Operations* | The submenu items named, not "blank" | ☐ | |
| 2.4 | Open *Edit ▸ Insert ▸ Date & Time* | The nested items named | ☐ | |
| 2.5 | Move across a menu separator | The reader does not stop on the separator | ☐ | |
| 2.6 | Escape out of a menu | Focus returns to where it was, announced | ☐ | |

### 3. The Find dialog (Ctrl+F, modeless)

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 3.1 | Ctrl+F with the editor focused | The dialog is announced as "Find and Replace" and focus lands in the term field | ☐ | |
| 3.2 | Tab through the Find tab | Each field has its label (Find what, …); each checkbox is named and reports checked/unchecked | ☐ | |
| 3.3 | Type a term, press Enter | The hit is selected and the result status is announced (e.g. the match count) | ☐ | |
| 3.4 | Press Count | The count is announced | ☐ | |
| 3.5 | Press Find All in Current Document | The number of matches is announced and the Search Results window carries them | ☐ | |
| 3.6 | Open each of the Replace, Find in Files, Mark tabs | Each tab's controls are named; the tab itself announces selected | ☐ | |
| 3.7 | On the Mark tab, run Bookmark line | The mark count is announced | ☐ | |
| 3.8 | Escape / Close from the dialog | The dialog closes and focus returns to the editor, announced | ☐ | |

### 4. Panels and the secondary surfaces

Open each through its menu (or key), then read it and interact.

| # | Surface | How to open | Expect | OK | Heard |
| - | ------- | ----------- | ------ | -- | ----- |
| 4.1 | Search Results | F7 (after a Find All) | Named as a tree; each hit group and line is reachable and named; stepping with F4 announces the result | ☐ | |
| 4.2 | Incremental Search | Ctrl+Alt+I | Named bar; typing announces a match count; a no-match term is announced as no match, not silence | ☐ | |
| 4.3 | Function List | View ▸ Function List | Named tree of functions; moving announces each; the filter is named | ☐ | |
| 4.4 | Document Map | View ▸ Document Map | Named, and does not steal focus from the editor | ☐ | |
| 4.5 | Document List | View ▸ Document List | Named list; each open document announced | ☐ | |
| 4.6 | Character Panel | View ▸ Character Panel | Named panel; a character's details are announced when chosen | ☐ | |
| 4.7 | Clipboard History | Edit ▸ Clipboard History | Named list of the last copies; each entry is intelligible | ☐ | |
| 4.8 | Summary | View ▸ Summary… | The dialog title, then each statistic (lines, words, chars, selection) is read | ☐ | |
| 4.9 | Column Editor | Edit ▸ Line Operations ▸ Column Editor… | Each field is named (Color/type, Text to insert, …, Leading zeros); the Insert button is named | ☐ | |
| 4.10 | Run | Run ▸ Run… | The Command to run and Save as fields are named; Run/Save/Cancel named | ☐ | |
| 4.11 | Windows | Window ▸ Windows… | Each open document is announced with its Name, Path and Type; Activate/Save/Close/Sort named | ☐ | |
| 4.12 | Date & Time (customized) | Edit ▸ Insert ▸ Date & Time (customized)… | The format field is named "Date & time format"; Insert/Cancel named | ☐ | |
| 4.13 | Go To Line | Search ▸ Go To Line… | The line field is named; the result caret move is announced | ☐ | |
| 4.14 | About | Help ▸ About (or the Notepad++ About entry) | The dialog title and its text are read once | ☐ | |

### 5. Editing feedback (browser and desktop)

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 5.1 | Toggle Insert with the Insert key | The status bar changes to OVR and the change is announced | ☐ | |
| 5.2 | Set a document Read-Only | The status bar reads Read-Only and it is announced | ☐ | |
| 5.3 | Change the encoding | The new encoding is announced | ☐ | |
| 5.4 | Convert line endings | The new EOL is announced | ☐ | |
| 5.5 | Save a document | The dirty indicator clears; no spurious "saved" prompt | ☐ | |
| 5.6 | Switch documents | The newly active tab and its document are announced | ☐ | |

### 6. Native file dialogs (Run B only)

Electron uses the operating system's Open/Save dialogs; NVDA must read them as it
reads any system dialog.

| # | Action | Expect | OK | Heard |
| - | ------ | ------ | -- | ----- |
| 6.1 | File ▸ Open from Computer | The native Open dialog opens **in the user's home folder**, and NVDA reads the file list | ☐ | |
| 6.2 | File ▸ Save To This Computer… | The native Save dialog opens in the home folder | ☐ | |
| 6.3 | File ▸ Upload to Workspace… | Its picker opens in the home folder | ☐ | |
| 6.4 | Cancel each dialog | Focus returns to the editor, announced | ☐ | |

## Recording the result

- **Pass:** every row ticked, and the version line filled in with the reader,
  platform and app build.
- **Finding:** the row number, the exact announcement (paste from the Orca log or
  NVDA Speech Viewer), what you expected, and the steps. File it as an issue and
  label it `accessibility` and the reader's name.
- When a finding is fixed in source, it gains a guard in `e2e/a11y.cjs` so the
  accessibility-tree shape it depended on cannot silently return, and this plan's
  row stays in the checklist for the next run.

### Version record

Fill this in for each run and copy the confirmed result into
[Accessibility](accessibility.md).

| Run | Reader and version | OS | App build | Date | Result |
| --- | ------------------ | -- | --------- | ---- | ------ |
| A | e.g. Orca 46.0 | e.g. Ubuntu 24.04 | browser @ `3100`, commit … | | |
| B | e.g. NVDA 2025.1 | e.g. Windows 11 24H2 | packaged `v…` | | |
