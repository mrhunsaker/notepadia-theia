# Development

## Setup

```bash
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
yarn verify
```

`yarn verify` runs `scripts/verify-environment.mjs`, which checks the Node
and Yarn versions and any other preconditions the CI expects.

## Day-to-day loop (browser target)

```bash
yarn watch       # compile the extension + browser app on change
yarn start       # serve the browser app (separate terminal)
```

Both are `yarn --cwd` wrappers; the underlying scripts live in
`applications/browser/package.json`.

## Builds

```bash
yarn build:extensions   # tsc-compile the `notepadia` extension
yarn build:browser      # rebuild + bundle the browser app
yarn build:electron     # rebuild native modules + bundle the Electron app (development)
yarn build:prod         # same as above in production mode (used before packaging)
yarn build              # build:extensions + build:browser
```

Native module handling: `theia rebuild:electron` (from the `rebuild` script)
rebuilds the Electron native addons (`node-pty`, `drivelist`, `keytar`,
`native-keymap`, `find-git-repositories`) against the Electron ABI.

!!! warning "Windows: node-pty must NOT be rebuilt from source"
    `node-pty` ships N-API prebuilds that are already compatible with
    Electron, and its `binding.gyp` hard-codes
    `SpectreMitigation: Spectre`. A from-source rebuild on a runner without
    the Spectre-mitigated MSVC libraries fails with **MSB8040**. CI rebuilds
    only the other native modules (`--modules=drivelist,keytar,
    native-keymap,find-git-repositories`).

## Versioning

Versions follow the date (`YYYY.M.D`, e.g. `2026.9.19`). Bump them with:

```bash
yarn bump:version            # uses today's UTC date (YYYY.M.D)
yarn bump:version 2026.9.19  # explicit version
```

`scripts/bump-version.mjs` updates the root and `applications/electron/package.json`
version fields and prints the change.

## Lint and unit tests

```bash
yarn lint
yarn test
```

## End-to-end tests

```bash
yarn test:e2e
```

Puppeteer suites live in `e2e/`. Theia's test harness launches the browser
app and drives the real UI, so keep the viewport tall enough (~640px+) for
menu hover/submenu interactions.

## CI workflows

| Workflow | When | Purpose |
| --- | --- | --- |
| `build.yml` | push / PR | Verify environment, install, build, upload browser artifacts |
| `e2e.yml` | push / PR | Lint, build, run puppeteer e2e suites |
| `release.yml` | tags `v*` / manual | Create draft release, build + publish installer artifacts per OS, publish release |
| `docs.yml` | push to `main` | Build and deploy the MkDocs site to GitHub Pages |

## Docs site

The site uses MkDocs Material. Preview locally:

```bash
pip install mkdocs-material
mkdocs serve
```

Source lives in `docs/`; `docs/ARCHITECTURE.md` was migrated to
`docs/architecture.md`.