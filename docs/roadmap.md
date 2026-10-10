<!--
 Copyright 2026 Michael Ryan Hunsaker, M.Ed., Ph.D.
 SPDX-License-Identifier: Apache-2.0
-->
# Roadmap and project status

This page is the single place that tracks where Notepadia is going and what is
left. The authoritative task list lives in `pair_programming_prompt.json` at the
repository root; this page is the human-readable summary.

## Where the project is now

The Notepad++-experience program is **feature-complete**. Every workstream below
(A–F and the verification tasks G1–G3 and G5) is done; the only open task is
**G4 — first published release and updater proof**, reduced to a single missing
piece: a real installed build upgrading itself through
`Help ▸ Check for Updates...`.

The first *tagged* release is **2026.10.10** (previously releases were built by
a manual `workflow_dispatch`). Tagging is now the normal release path; see
[Releases & updates](releases.md).

## Milestone history

| Milestone | Theme |
| --- | --- |
| M1–M8 | Editor core: search/replace, encoding, EOL, recent files and session restore, bookmarks and line operations, language support, Notepad++ menus and shortcuts. |
| M9 | Linux Electron packaging (AppImage/rpm/deb). |
| M10–M16 | CI e2e + ESLint, JSON/PowerShell languages, replace-in-files, matching bracket, document list panel, spaces-vs-tabs, product icons. |
| M17 | Windows packaging, file associations, and file-open routing. |
| M18 | macOS packaging and signing (installers build **unsigned** in CI; signing/notarization pending an Apple Developer ID). |
| M19 | Automatic updates (electron-updater). |
| M20 | CI release workflow (GitHub Actions). |
| M21 | Documentation site (MkDocs on GitHub Pages). |
| M22 | macOS release-workflow verification (unsigned builds; signing pending an Apple Developer ID). |
| M23 | Macros, Column Editor, Blank Operations, Split Lines / Remove Consecutive Duplicate Lines, Search Mark / Select-and-Find-Next, and the Document Map. |
| M24 | Unit tests for extracted logic, wired into `yarn test`. |
| M25 | Escape-search mode, named sessions, character panel, and print. |
| M26 | Notepad++ visual identity: Notepadia Classic light/dark themes, shell-chrome reduction, the toolbar, and tab-bar fidelity. |
| M27 | Notepad++ default behavior profile and Notepad++-styled untitled documents. |
| M28 | Notepad++ tabbed Find dialog (Find / Replace / Find in Files / Mark) plus the `Search ▸ Mark` submenu. |
| M29 | Search Results window (`F7`, `F4`/`Shift+F4`) with live-region announcements. |
| M30 | Incremental search bar (`Ctrl+Alt+I`) with wrap-around and per-session caret restoration. |

## Current program: the A–G workstreams

The v8 plan regrouped the remaining recognizability, search, menu-completeness,
browser-correctness, panel, accessibility and release work into seven
workstreams. All are complete except G4.

| Workstream | Scope | Status |
| --- | --- | --- |
| **A — Visual identity and shell chrome** | Notepadia Classic themes + stylesheet layer, VS Code chrome stripped, toolbar, tab-bar fidelity, status bar parity, default behavior profile | Complete |
| **B — Find/Replace/Mark dialog** | Extended search mode, the tabbed Find dialog, Search Results window (`F7`), incremental search | Complete |
| **C — Menu completeness** | File / Edit / View / Window / Run menu gaps closed | Complete |
| **D — Browser-target correctness** | Local file open & save, browser-reserved keybindings, unsaved-work protection and crash recovery, named sessions, print/preview, deployment story, "one verb, one target" | Complete |
| **E — Docked panels** | Function List, Character Panel, Folder as Workspace presentation | Complete |
| **F — Accessibility pass** | Keyboard, screen reader and contrast verification | Complete |
| **G — Verification and inherited release debt** | Test suite growth + visual baseline (G1), documentation truth pass (G2), macOS release workflow verification (G3), first published release and updater proof (G4), Electron parity check (G5) | G1–G3, G5 done; **G4 open** |

## Definition of done

The program was accepted against these conditions, all of which now hold except
the G4 updater proof:

- A Notepad++ user recognizes the application before reading any menu: light
  chrome, white editor, icon toolbar, floppy-icon tabs, Notepad++ status bar.
- `Ctrl+F` opens one tabbed Find dialog with Notepad++'s controls and
  semantics, not Monaco's inline widget.
- Every Notepad++ menubar entry is present in Notepad++'s order, or its absence
  is documented as a deliberate deviation.
- A remote browser user can open a file from their own computer, edit it and
  save it back.
- Every control labeled `Open` opens the user's own computer; the server
  workspace is reachable only under a label that names it.
- The whole application is operable by keyboard with no serious or critical axe
  violations.
- Every feature has an e2e suite; every pure module has unit tests; a styling
  regression fails CI.
- README, docs and CHANGELOG describe only what the code actually does.
- The Electron build has parity, the macOS release leg is verified, and the
  updater has upgraded a real installation. *(parity and macOS done; updater
  upgrade still to be demonstrated)*

## What remains

| Task | Why it is still open |
| --- | --- |
| **G4 — updater proof** | `electron-updater` resolves only *published* releases. The updater code, the update manifests and a published release now exist; the one thing not yet demonstrated end to end is an **installed** older build discovering and installing a newer published build via `Help ▸ Check for Updates...`. |

Out-of-scope items (plugin ecosystem, full Style Configurator, the full
Notepad++ language catalog, User Defined Languages, broad code-page support,
multi-instance, Project Panels 1/2/3, and macOS code signing until the Apple
credentials exist) are enumerated in [differences.md](differences.md).

## Versioning

Product versions are **date-based UTC values** (`YYYY.M.D`), generated at build
time by `scripts/set-build-version.mjs`; the repository stays at `0.0.0` and the
release tag is `vYYYY.M.D`. See [Releases & updates](releases.md) for the full
flow.
