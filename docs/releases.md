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

Release versions are **date-based** (`YYYY.M.D`, e.g. `2026.9.19`, which sorts
as a valid semver and is always greater than the previous release).

The repository itself stays at **`0.0.0`** — the version is **generated and
injected at build time**, never committed:

- `scripts/set-build-version.mjs` computes the version from the current UTC date
  (or takes an explicit `VERSION`), validates `YYYY.M.D`, and writes it into a
  given `package.json`.
- Local packaging (`yarn package:win`, `package:linux`, `package:mac`) runs
  `scripts/package-electron.mjs`: it injects the build version into a staging
  copy of `applications/electron/package.json`, packages with electron-builder,
  and **restores the checked-in file**, so the Git working tree is never left
  dirty.
- CI reads the version from the release tag (`vYYYY.M.D` → `YYYY.M.D`) and
  injects it into the disposable checkout before packaging.

There is no version-bump script and no version-bump commit to make.

## Releasing a new version

1. The version comes from the tag name, so there is nothing to bump or commit.
   Push the tag:

   ```bash
   git tag v2026.9.19
   git push origin v2026.9.19
   ```

   (A manual run via `workflow_dispatch` without a tag uses the `version`
   input, or today's UTC date if no input is given.)

2. [`.github/workflows/release.yml`](https://github.com/mrhunsaker/notepadia-theia/blob/main/.github/workflows/release.yml)
   runs in three phases:

   1. **prepare** — computes the version (from the tag) and creates a
      **draft** GitHub Release for the tag.
   2. **build & publish** — on three runners in parallel, each uploading
      its artifacts plus the update manifest (`latest.yml`, `latest-mac.yml`
      or `latest-linux.yml`) into the draft release
      (`--publish always`, `GH_TOKEN` = `GITHUB_TOKEN`):

      - `windows-2022` → `--win` (NSIS + portable)
      - `ubuntu-22.04` → `--linux` (AppImage + rpm + deb)
      - `macos-15` → `--mac` (dmg + zip), unsigned unless the Apple
        signing secrets are configured (see
        [macOS signing & notarization](#macos-signing-notarization)).

   3. **finalize** — publishes the draft release as soon as all three build
      jobs succeed.

   The draft is created up front so the parallel jobs never race to create
   the release, and it is published automatically at the end; no manual
   step is required.

3. Installed apps on the previous version are then offered the update (only
   if the new version is **greater**, semver-wise). Note: electron-updater
   only resolves **published** releases, never drafts — which is why the
   workflow publishes at the end.

## Release workflow details

- Trigger: `push` of tags matching `v[0-9]*`, or manual `workflow_dispatch`
  with a `version` input.
- Permissions: `contents: write` (create release + upload assets).
- Draft release is created once by the `prepare` job with
  `gh release create --draft`; the build jobs only ever upload into it.
- Native rebuild step excludes `node-pty` to avoid the MSB8040 Spectre
  failure (it uses N-API prebuilds compatible with Electron anyway).
- `yarn package:win / package:linux / package:mac` exist for **local**
  testing but always use `--publish never`; only CI publishes.
- Every artifact also gets a SHA-256 checksum (`*.sha256`), uploaded beside
  the installer to the release and as a workflow attachment.

## macOS signing & notarization

macOS builds are **unsigned by default** — the project has no Apple Developer
ID credentials. Enabling signing/notarization is configuration-only, no
workflow code changes are required.

Add these repository **Secrets** (`Settings ▸ Secrets and variables ▸ Actions`):

| Secret | Value |
| --- | --- |
| `CSC_LINK` | Base64-encoded Developer ID Application `.p12` (export from Keychain: right-click certificate → *Export…* → `<cert>.p12`, then `base64 -i com.your.id.p12`). |
| `CSC_KEY_PASSWORD` | The `<cert>.p12` password. |
| `APPLE_ID` | Your Apple Developer account email. |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password generated under Apple ID ▸ Sign-In & Security. |
| `APPLE_TEAM_ID` | Your Developer team ID (Apple Developer portal, Membership). |

CI then behaves as follows:

- `CSC_IDENTITY_AUTO_DISCOVERY` is `true` on the macOS job exactly when
  `CSC_LINK` is set, and `false` otherwise (Windows/Linux stay unsigned).
- With `CSC_LINK` set, electron-builder signs the app with the Developer ID
  certificate.
- With `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID` set,
  electron-builder additionally **notarizes** and staples the artifacts
  (`mac.notarize: true`).
- The workflow's macOS verification step then hard-asserts
  `codesign --verify --deep --strict` and Gatekeeper `spctl -a -vv` in
  addition to the plist/DMG checks it always runs.

The hardened runtime and entitlements are already configured and the signing
assertions activate automatically — nothing else to change in the repo.

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