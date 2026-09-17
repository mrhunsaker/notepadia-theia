<!--
 Copyright 2026 Michael Ryan Hunsaker, M.Ed., Ph.D.
 SPDX-License-Identifier: Apache-2.0
-->

# Style Guide

This document describes the coding style and patterns used in this project.
Follow these conventions when contributing so that the codebase stays
consistent.

Automated enforcement is provided by **ESLint** (linting) and **TypeScript**
(compilation). The guidance here covers intent, patterns, and
project-specific decisions that go beyond what a linter can check.

---

## Language, Runtime and Typing

- The product code is **TypeScript** in strict mode, targeting **ES2022**
  with CommonJS module resolution (see `extensions/notepadia/tsconfig.json`).
- Use explicit types on public API; rely on inference only for locals when it
  reads clearly.
- Theia's shared `inversify` DI is used: mark contributions `@injectable()` and
  inject dependencies via `@inject(Service)` constructor parameters.
- A single type/`Record` for lookup tables is idiomatic here:

  ```typescript
  const ENCODING_LABELS: Record<string, string> = {
      utf8: 'UTF-8',
      utf8bom: 'UTF-8 BOM',
      utf16le: 'UTF-16 LE',
      utf16be: 'UTF-16 BE',
      windows1252: 'ANSI'
  };
  ```

---

## Formatting

| Setting | Value |
|---------|-------|
| Indentation | 4 spaces |
| Quoting | single quotes |
| Trailing commas | in multi-line objects/arrays/args |
| Semicolons | always |
| Line length | ~100 (informal; follow surrounding code) |

Run the linter:

```bash
yarn lint
```

---

## Linting (ESLint)

Enforced via the flat config at `extensions/notepadia/eslint.config.mjs`
(`@eslint/js` recommended + `typescript-eslint` recommended).

Project overrides:

| Rule | Setting | Notes |
|------|---------|-------|
| `@typescript-eslint/no-explicit-any` | off | Monaco/Theia typings make `any` hard to avoid |
| `@typescript-eslint/no-namespace` | off | `NotepadiaCommands` namespace holds command defs |
| `@typescript-eslint/no-unused-vars` | warn | ignore args named `^_` |

Do not use lint-disable comments to silence a check you could fix properly.

---

## Naming Conventions

| Construct | Convention | Example |
|-----------|------------|---------|
| File | `kebab-case` | `notepadia-menu-contribution.ts` |
| Class / interface | `PascalCase` | `NotepadiaMenuContribution` |
| Command namespace | `UPPER_SNAKE_CASE` | `NotepadiaCommands.MATCHING_BRACKET` |
| Function / method | `camelCase` | `setTabSize` |
| Variable | `camelCase` | `currentEditor` |
| Constant (module scope) | `UPPER_SNAKE_CASE` | `ENCODING_LABELS` |
| Protected member | `protected`/no leading underscore | `this.toDispose` |

Command IDs follow `notepadia.<noun>` (e.g. `notepadia.matchingBracket`).

---

## File and Module Structure

The `notepadia` extension keeps one contribution per file
(`extensions/notepadia/src/browser/`):

```
extensions/notepadia/src/browser/
├── notepadia-frontend-module.ts             # DI module wiring all contributions
├── notepadia-contribution.ts                # CommandContribution: command defs + handlers
├── notepadia-menu-contribution.ts           # MenuContribution: Notepad++-style menus/orders
├── notepadia-keybinding-contribution.ts     # KeybindingContribution: Theia keybindings
├── notepadia-editor-keybinding-contribution.ts # Monaco-level keybinding bridge
├── notepadia-language-contribution.ts       # language registrations + Monarch tokenizers
├── notepadia-status-bar-contribution.ts     # status bar widgets/updates
├── notepadia-encoding-contribution.ts       # encoding conversion/re-save
├── notepadia-eol-contribution.ts            # EOL conversion/re-save
├── notepadia-bookmark-contribution.ts       # bookmark toggle/navigate
├── notepadia-recent-files-contribution.ts   # recent files menu
└── notepadia-drop-contribution.ts           # drag-and-drop open behavior
```

Rules:

- One responsibility per contribution class; wire it together in the command
  handlers, not in the contribution constructors.
- Keep Theia keybindings and Monaco keybindings in their own files — they are
  separate registries with separate lifecycle.
- Do not add top-level modules/files without discussion.

---

## Contribution Pattern

All product behavior hangs off Theia's contribution interfaces:

```typescript
@injectable()
export class NotepadiaContribution implements CommandContribution {
    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(NotepadiaCommands.MATCHING_BRACKET, {
            isEnabled: () => !!this.currentEditor,
            execute: () => this.triggerMonacoAction('editor.action.jumpToBracket')
        });
    }
}
```

For editor actions exposed as commands, prefer delegating to a Monaco action
id via `triggerMonacoAction` rather than reimplementing editor behavior.

---

## Imports

Order and group imports as follows (ESLint does not enforce this yet; keep it
consistent by hand):

1. Theia (`@theia/*`)
2. Monaco / vendor (`monaco-editor` from `@theia/monaco`)
3. Local relative (`.`, `./notepadia-...`)

```typescript
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { inject, injectable } from '@theia/core/shared/inversify';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { notepadiaLanguageName } from './notepadia-language-contribution';
```

---

## Comments and JSDoc

- Public classes/methods that are not self-explanatory get a
  **JSDoc** block (`/** ... */`).
- Inline comments explain **why**, not **what**. Avoid restating the code.
- Keep TODO comments short and actionable; link to an issue when possible.

```typescript
// Good
// Monaco runs its own keybinding service, so shortcut parity requires the
// binding to be registered with Monaco as well as Theia's KeybindingRegistry.

// Bad
// add the keybinding
```

Do not add comments unless they carry information the code does not.

---

## Testing

- Behavior is verified by **Puppeteer end-to-end tests** in `e2e/`
  (`node e2e/run.cjs` via `yarn test:e2e`). New product behavior should add
  assertions to the suite that covers that menu/area (e.g. `e2e/search.cjs`
  for Search-menu features, `e2e/bookmarks.cjs` for bookmarks).
- Each suite boots the app against a seeded workspace; assert observable
  behavior (menu items, keybinding effects, editor state), not internals.
- A suite fails the run if any assertion throws; keep assertions self-describing
  with a message and the observed value.
- Run a single suite against a running app:
  `E2E_URL=http://localhost:3000 node e2e/search.cjs`.