<!--
 Copyright 2026 Michael Ryan Hunsaker, M.Ed., Ph.D.
 SPDX-License-Identifier: Apache-2.0
-->
# About Notepadia and its goals

## In one sentence

Notepadia is a keyboard-first text editor that reproduces the **Notepad++ user
experience** — its menus, shortcuts, editing behavior and window surface — on a
modern, cross-platform foundation (Eclipse Theia + Monaco), **without
reproducing Notepad++'s implementation**.

## What "reproduce the experience, not the implementation" means

Notepad++ is a native Win32 application written in C++ around the Scintilla
editor component. Notepadia is not.

A Notepad++ user should be able to open Notepadia and recognize it *before
reading a single menu*: the light chrome, the white editor, the icon toolbar,
the floppy-icon tabs and the Notepad++ status bar. They should then be able to
work by muscle memory, because the chords and the menu tree are the ones they
already know. What is **not** being reproduced is the layer underneath: the
Win32 API, Scintilla, the GPL source of Notepad++, or its plugin ABI.

Instead, the Notepad++ surface is mapped onto Theia's command, menu and
keybinding architecture and Monaco's editing engine. Where Notepad++'s
implementation cannot be reproduced in a browser (or is deliberately out of
scope), the deviation is written down in
[differences.md](differences.md) rather than left as a surprise.

## What Notepadia is not

- **Not a port or a fork of Notepad++.** No Notepad++ source is used. Notepadia
  is an independent implementation of a familiar experience and is not
  affiliated with or endorsed by the Notepad++ project.
- **Not a Scintilla client.** The editor engine is Monaco, reached through
  Theia.
- **Not a plugin host.** The Notepad++ plugin ecosystem and NppExec are out of
  scope; the extension model is Theia's VS Code-style extension model.
- **Not a byte-for-byte visual clone.** The palette is Notepad++'s *where it
  passes accessibility*, adjusted where it does not (see
  [accessibility.md](accessibility.md)).
- **Not a VS Code reskin.** Theia's default shell chrome (activity bar,
  right-hand panel, breadcrumbs, VS Code menus) is deliberately stripped.
- **Not a multi-instance application.** Theia is single-instance by design.
- **Not a full language catalog.** A curated set of languages ships, not the
  full ~80-language Notepad++ list.

## Goals

1. **Recognizability.** The shell, toolbar, tabs and status bar look like
   Notepad++ at a glance.
2. **Behavioral parity.** Menus carry Notepad++'s entries in Notepad++'s order;
   shortcuts do what a Notepad++ user expects; the Find/Replace/Mark dialog is
   Notepad++'s dialog, not Monaco's inline widget.
3. **Browser first, desktop packaged.** The browser application
   (`http://localhost:3000`) is the primary product and development target;
   Electron is the packaging path to a native desktop install, with parity for
   everything the browser build does.
4. **Accessible by construction.** The whole application is operable with the
   keyboard alone and exposes accessible names; a mouse-only control is a
   defect, and accessibility regressions are gated by automated checks.
5. **Honest documentation.** The README, this site and the CHANGELOG describe
   only what the code actually does.

## Design principles

- **Reproduce the experience, not the implementation.** Adapt Theia and Monaco;
  do not fork the editor or reimplement the filesystem.
- **Keep `@theia/*` pinned to the 1.75.0 line.** Never mix Theia versions and
  never add a standalone `monaco-editor` dependency — use
  `@theia/monaco-editor-core`.
- **Improve the browser target first.** Electron is touched for packaging, or
  when a feature genuinely needs the desktop runtime.
- **One stylesheet layer.** New visual styling goes into the extension's CSS
  layer and uses Theia color tokens registered by the Notepadia theme, not
  hard-coded hex values scattered through TypeScript.
- **One verb, one target.** Every control labeled *Open* opens the user's own
  computer; the server workspace is reachable only under a label that names it.
- **Keyboard and screen reader first.** New UI must be usable by keyboard alone
  and must carry an accessible name.
- **Deliberate deviations are documented.** Anything Notepad++ does that
  Notepadia does not is a decision recorded in
  [differences.md](differences.md).
- **Ship behavior with tests.** User-visible behavior gets a Puppeteer e2e
  suite; pure logic is extracted and unit-tested; a styling regression fails
  CI.

## The two targets: what agrees and what differs

The browser and desktop applications load the *same* `notepadia` extension, so
the menus, shortcuts and editing behavior are identical. The runtime is what
differs:

| Concern | Browser (`applications/browser`) | Desktop (`applications/electron`) |
| --- | --- | --- |
| Open / Save on your own computer | File System Access API where available, otherwise a file input / blob download | OS-native Open/Save dialogs (`useNativeElements`) |
| Print / Print Preview | A dedicated print window handed to the browser's own print dialog | The document prints itself in place (`window.print()` → native dialog) |
| Browser-reserved chords (`Ctrl+N`, `Ctrl+W`, `Ctrl+O`, `F5`, …) | Bound to browser-safe alternates | Still bound to the original chords |
| Automatic updates | n/a (always the served build) | `electron-updater` against GitHub Releases |

See [differences.md](differences.md) for the full list.

## Who it is for

Notepad++ users who want the same ergonomics in a browser tab or in a
cross-platform desktop install, and anyone who needs a fast, keyboard-driven
plain-text/source editor that behaves predictably without a plugin system. The
maintainer's domain is accessibility, which is why the keyboard and contrast
behavior is treated as a first-class requirement rather than an enhancement.

## Relationship to Notepad++ and to Theia

- **Notepad++** supplies the *interaction design* Notepadia emulates. No
  Notepad++ code is used, and Notepad++ is under the GPL while Notepadia is
  Apache-2.0.
- **Eclipse Theia** supplies the application platform (shell, filesystem,
  workspaces, commands, keybindings, menus, preferences, search).
- **Monaco** supplies the editor engine.

## How to read these docs

| Page | Answers |
| --- | --- |
| [Overview](index.md) | What the product is and its feature highlights |
| [Getting started](getting-started.md) | Build and run it |
| [User guide](usage.md) | The menu tree and every feature |
| [Differences from Notepad++](differences.md) | The deliberate deviations |
| [Accessibility](accessibility.md) | Keyboard, screen reader and contrast support |
| [Architecture](architecture.md) | How the code is put together |
| [Roadmap](roadmap.md) | Milestones, workstreams and what remains |
| [Development](development.md) | Day-to-day workflow |
| [Deployment](deployment.md) | Serving the browser app to other people |
| [Packaging](packaging.md) | Building the desktop installers |
| [Releases & updates](releases.md) | How new builds reach users |
