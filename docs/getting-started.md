# Getting started

## Prerequisites

- Node.js >= 24 (development is pinned via `volta`).
- Yarn Classic 1.22.22 (older-style lockfile workspace monorepo).
- On Windows, a full Visual Studio toolchain with the *Desktop development
  with C++* workload for native module rebuilds.

## Install

```bash
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
yarn verify
```

## Run the browser app (development target)

```bash
yarn watch
```

in one terminal, and in another:

```bash
yarn start
```

The frontend is served at `http://localhost:3000`. No native rebuild is
needed per edit, which makes the browser target the fastest way to iterate.

!!! tip
    The test workspace ships `.theia/settings.json` with recommend
    `files.autoSave: "off"`, matching Notepad++'s "never auto-save"
    convention.

## Run the desktop app (unpackaged)

```bash
yarn --cwd applications/electron start
```

This launches Electron directly against the built sources
(`lib/backend/electron-main.js`).

## Tests

```bash
yarn lint            # eslint across all workspaces
yarn test            # unit tests
yarn test:e2e        # puppeteer end-to-end suites
```

See [Development](development.md) for the full workflow.

## Project layout

| Path | Purpose |
| --- | --- |
| `applications/browser` | Browser/development application |
| `applications/electron` | Electron application and packaging config |
| `extensions/notepadia` | Product extension (all Notepad++-style behavior) |
| `docs` | This documentation site (MkDocs) |
| `e2e` | Puppeteer end-to-end suites |
| `.github/workflows` | CI, e2e, release, and docs workflows |