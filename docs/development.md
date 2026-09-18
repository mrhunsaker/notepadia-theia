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

The repository stays pinned to **`0.0.0`** and is never bumped in Git. The
**build version** is generated from the current UTC date (`YYYY.M.D`, e.g.
`2026.9.19`) and injected at build/package time:

```bash
yarn build:version                                  # prints today's build version
node scripts/set-build-version.mjs package.json 2026.9.19   # inject an explicit version
```

`scripts/set-build-version.mjs` validates `YYYY.M.D` and writes the given
version into a `package.json` file. Packaging always uses the generated version
**without dirtying the working tree**:

- Local desktop builds (`yarn package:win`, `package:linux`, `package:mac`, or
  `yarn --cwd applications/electron package`) run
  `scripts/package-electron.mjs`, which temporarily injects the version into
  `applications/electron/package.json`, runs electron-builder, and restores the
  file afterwards.
- CI computes the version in the `prepare` job (from the release tag) and
  injects it the same way into the disposable checkout.

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