# Releases & updates

## How users get updates

The desktop app embeds `electron-updater` and checks the project's GitHub
Releases for a newer version:

- on startup (a few seconds after launch), and
- on demand via `Help ▸ Check for Updates...`.

When an update is available it downloads in the background (progress is
reported), and once complete the app prompts to **Restart** and install.
Updates require a stable internet connection and a published release that
contains the update manifest.

!!! warning "Windows installer constraint"
    Updates apply only when the app was installed into the **default**
    directory — hence the installer does not allow a custom install
    location.

## Versioning

Notepadia uses **date-based versions** of the form `YYYY.M.D`
(e.g. `2026.9.19`, which sorts as a valid semver and is always greater than
the previous release). Bump the version with:

```bash
yarn bump:version            # uses today's UTC date (YYYY.M.D)
yarn bump:version 2026.9.19  # explicit version
```

`scripts/bump-version.mjs` updates both the root and
`applications/electron/package.json` files. Commit the result before tagging.

## Releasing a new version

1. Bump the version(s) as above. The release tag (e.g. `v2026.9.19`) is the
   source of truth; CI writes it into `applications/electron/package.json`
   before packaging.
2. Push a version tag:

   ```bash
   git tag v2026.9.19
   git push origin v2026.9.19
   ```

3. [`.github/workflows/release.yml`](https://github.com/mrhunsaker/notepadia-theia/blob/main/.github/workflows/release.yml)
   runs in three phases:

   1. **prepare** — computes the version and creates a **draft** GitHub
      Release for the tag.
   2. **build & publish** — on three runners in parallel, each uploading
      its artifacts plus the update manifest (`latest.yml`, `latest-mac.yml`
      or `latest-linux.yml`) into the draft release
      (`--publish always`, `GH_TOKEN` = `GITHUB_TOKEN`):

      - `windows-2022` → `--win` (NSIS + portable)
      - `ubuntu-22.04` → `--linux` (AppImage + rpm + deb)
      - `macos-15` → `--mac` (dmg + zip), **unsigned**
        (`CSC_IDENTITY_AUTO_DISCOVERY=false`; no signing certificate is
        configured yet).

   3. **finalize** — publishes the draft release as soon as all three build
      jobs succeed.

   The draft is created up front so the parallel jobs never race to create
   the release, and it is published automatically at the end; no manual
   step is required.

4. Installed apps on the previous version are then offered the update (only
   if the new version is **greater**, semver-wise). Note: electron-updater
   only resolves **published** releases, never drafts — which is why the
   workflow publishes at the end.

## Release workflow details

- Trigger: `push` of tags matching `v[0-9]+.[0-9]+.[0-9]+*`, or manual
  `workflow_dispatch` with a `version` input.
- Permissions: `contents: write` (create release + upload assets).
- Draft release is created once by the `prepare` job with
  `gh release create --draft`; the build jobs only ever upload into it.
- Native rebuild step excludes `node-pty` to avoid the MSB8040 Spectre
  failure (it uses N-API prebuilds compatible with Electron anyway).
- `yarn package:win / package:linux / package:mac` exist for **local**
  testing but always use `--publish never`; only CI publishes.

## Update manifests

`electron-builder` writes the per-platform update manifest **only during a
publish build**:

| Manifest | Serves |
| --- | --- |
| `latest.yml` | Windows NSIS `*exe` delta/full updates |
| `latest-mac.yml` | macOS zip updates |
| `latest-linux.yml` | Linux AppImage/deb/rpm updates |

These files (plus `.blockmap` files and the installers) are uploaded to the
release by the corresponding matrix job. The app discovers them through the
GitHub provider configured in `electron-builder.yml`.