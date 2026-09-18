<!--
 Copyright 2026 Michael Ryan Hunsaker, M.Ed., Ph.D.
 SPDX-License-Identifier: Apache-2.0
-->

# Contributing to Notepadia

Thank you for your interest in contributing. This document explains how to get
started, what is expected from contributors, and how the review process works.

## Code of Conduct

All participants are expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Respectful, professional communication
is required in all project spaces (issues, pull requests, discussions, and
commit messages).

## Security Issues

**Do not open public Issues for security vulnerabilities.** See
[SECURITY.md](SECURITY.md) for the private reporting process.

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 24+ | Runtime (Node 26 supported) |
| [Yarn Classic](https://classic.yarnpkg.com/) | 1.x | Package manager |
| Python | 3.x | Native builds for Theia/Electron |
| Git | Any | Version control |

### Fork and Clone

```bash
# 1. Fork on GitHub, then:
git clone https://github.com/<your-username>/notepadia-theia.git
cd notepadia-theia

# 2. Add the upstream remote
git remote add upstream https://github.com/mrhunsaker/notepadia-theia.git
```

### Install Dependencies

```bash
yarn verify   # checks the environment (Node/Yarn/Python/toolchain)
yarn          # installs all workspace dependencies
yarn build    # compiles the notepadia extension and the browser application
```

The first install/build takes a while because Theia ships native
Node/Electron dependencies.

---

## Workflow

### Branch Naming

Use short, descriptive kebab-case names:

```plaintext
feat/document-list-panel
fix/matching-bracket-empty-file
docs/update-readme
test/bookmark-menu
```

### Making Changes

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. Make focused, atomic commits. Each commit should compile and pass lint.

3. Before opening a pull request, run the validation suite:

   ```bash
   # Lint (ESLint over extensions/notepadia/src)
   yarn lint

   # Type check + build (extension and browser application)
   yarn build

   # End-to-end suites (headless Chromium, ~11 suites)
   yarn test:e2e
   ```

4. If lint checks fail, fix them and re-run `yarn lint`.

5. Update [README.md](README.md) when you change observable behavior or add
   new features.

6. Open a pull request against `main` with a clear description of what changed
   and why.

### Pull Request Checklist

Before marking a PR ready for review:

- [ ] `yarn lint` passes locally
- [ ] `yarn build` succeeds (extension + browser application)
- [ ] Affected e2e suites pass (`yarn test:e2e`); new behavior is covered
- [ ] Documentation is updated if the change is user-visible
- [ ] Version is **not** bumped in the PR — maintainers handle releases

---

## Project Conventions

### Language and Runtime

- TypeScript (strict mode) with Node's CommonJS module resolution, on the
  ES2022 target.
- Product extensions live in `extensions/notepadia/src/browser` and contribute
  through Theia's `CommandContribution`, `MenuContribution`,
  `KeybindingContribution` and `FrontendApplicationContribution` interfaces.
- Monaco-level behavior (e.g. conditional keybindings, editor actions) is
  bridged from the `notepadia` extension via the shared command registry; see
  `notepadia-editor-keybinding-contribution.ts`.

### Linting

Handled by **ESLint** (flat config) at `extensions/notepadia/eslint.config.mjs`,
using `@eslint/js` + `typescript-eslint`:

```bash
yarn lint                 # eslint "src/**/*.ts"
yarn --cwd extensions/notepadia lint
```

Notable overrides in the flat config:

- `@typescript-eslint/no-explicit-any` is relaxed (Monaco/Theia typings).
- `@typescript-eslint/no-namespace` is relaxed (used for `NotepadiaCommands`).
- Unused variables warn; ignore intentionally-omitted args with `^_`.

### JSDoc

Add JSDoc to public classes and methods that are not self-explanatory:

```typescript
/**
 * Registers a Monaco-level keybinding that forwards to a Theia command.
 *
 * Monaco runs its own keybinding service, so shortcut parity requires the
 * binding to be registered here as well as via Theia's KeybindingRegistry.
 */
protected add(
    frontendCommandId: string,
    monacoKeybinding: number,
    when?: string
): void
```

### Dependencies

- Runtime dependencies go in `extensions/notepadia/package.json`.
- Keep the `@theia/*` package line pinned to the 1.75.0 baseline used by
  `applications/*`; do not mix versions.
- Avoid adding dependencies without discussion; keep the footprint small.

### Theia Version Line

The repository intentionally pins Eclipse Theia to a single stable line
(1.75.0). Do not bump individual `@theia/*` packages in contributor PRs; a
baseline upgrade is coordinated by the maintainers.

### Versioning

The repository stays pinned to `0.0.0`; product versions are **date-based**
(`YYYY.M.D`, e.g. `2026.9.19`) and **generated at build/package time** by
`scripts/set-build-version.mjs` rather than committed. Releases are cut by
maintainers, who push the matching `vYYYY.M.D` tag; CI builds and publishes the
release.

Do **not** bump the version in contributor PRs. Maintainers handle releases.

---

## Style Details

See [STYLE.md](STYLE.md) for detailed naming conventions, file structure, and
coding patterns used in this codebase.

---

## Commit Messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```plaintext
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Examples:

```plaintext
feat(editor): add matching bracket navigation (Ctrl+Shift+E)
fix(search): register bracket config before jumpToBracket is invoked
docs(readme): align badges with the notepadia-theia repository
test(bookmarks): add coverage for the bookmark menu
```

---

## Releasing (Maintainers Only)

1. Update [CHANGELOG.md](CHANGELOG.md) with the release notes.
2. Bump the version in `package.json` and the application/extensions manifests.
3. Run `yarn build:all` and `yarn package:preview` to validate the packaging.
4. Tag the commit: `git tag v0.1.1 && git push origin v0.1.1`
5. Build the release artifacts (`yarn package`) and create a GitHub release
   from the tag.