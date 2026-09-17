<!--
 Copyright 2026 Michael Ryan Hunsaker, M.Ed., Ph.D.
 SPDX-License-Identifier: Apache-2.0
-->

# Governance & Code Quality Enforcement

This document explains how the Notepadia project enforces code quality,
expected behavior, and governance through multiple layers.

## Enforcement Strategy

### Layer 1: Local Development (Pre-Commit Checks)

**When**: Run manually before committing
**Tools**: ESLint + TypeScript build + e2e suites
**Enforcement Level**: Blocks commit if issues found

#### How it works:

1. Verify the environment and lint the `notepadia` extension:

   ```bash
   yarn verify
   yarn lint
   ```

2. Compile the extension and the browser application:

   ```bash
   yarn build
   ```

3. For behavior changes, run the affected e2e suites:

   ```bash
   yarn test:e2e
   ```

4. If all checks pass, commit your changes.

#### Expected workflow:

```bash
# Make changes
# ...

# Run lint checks
yarn lint

# Build (type checks compile)
yarn build

# Stage and commit
git add .
git commit -m "feat(editor): add matching bracket navigation"
# Checks passed → commit succeeds
```

---

### Layer 2: CI/CD on Every Push/PR (GitHub Actions)

**When**: Automatically when code is pushed or PR is created
**Enforcement Level**: Blocks merge if required checks fail

#### Required checks (block merge):

- `Build Notepadia` workflow (`.github/workflows/build.yml`): verifies the
  environment, installs, builds the extension and browser application,
  uploads the browser app artifacts.
- `Notepadia E2E` workflow (`.github/workflows/e2e.yml`): lints, builds, and
  runs the 11 Puppeteer e2e suites; uploads artifacts on failure.

---

### Layer 3: Documentation & Standards

**When**: Developer reads before contributing
**Files**: Governance and style guides
**Enforcement Level**: Documented expectations

#### Key files:

| File | Purpose | Audience |
|------|---------|----------|
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards | All contributors |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute | Developers |
| [STYLE.md](STYLE.md) | Code conventions | Developers |
| [SECURITY.md](SECURITY.md) | Security practices | Security-aware users |
| [CHANGELOG.md](CHANGELOG.md) | Changelog | All |

---

## Enforcement Summary

| Layer | Tool | Timing | Strictness | Bypass Possible? |
|-------|------|--------|------------|------------------|
| **Local** | ESLint + tsc | Before commit | Blocks | `git commit --no-verify` (not recommended) |
| **CI/CD** | GitHub Actions (build + e2e) | On push/PR | Blocks merge | PR approval override (requires maintainer) |
| **Docs** | STYLE.md / CONTRIBUTING.md | Before contributing | Expected | N/A |

---

## Getting Started as a Contributor

### First Time Setup

```bash
# Clone the repo
git clone https://github.com/mrhunsaker/notepadia-theia.git
cd notepadia-theia

# Verify environment and install dependencies
yarn verify
yarn

# Verify setup
yarn lint    # Should pass with no errors
yarn build   # Should compile cleanly
```

### Normal Contribution Workflow

```bash
# Create feature branch
git checkout -b feat/my-feature

# Make changes
# ... edit files ...

# Run lint + build checks
yarn lint
yarn build

# Stage and commit
git add .
git commit -m "feat(scope): description"
# → Commit succeeds if checks pass

# Push to GitHub
git push origin feat/my-feature

# Create Pull Request on GitHub
# CI/CD checks run automatically (build + e2e)
# → If all pass, ready for review and merge
```

### If Lint Checks Fail

```bash
# Lint found issues. Fix them and re-run:
yarn lint

# Or fix the specific file:
yarn --cwd extensions/notepadia eslint "src/**/*.ts"

# Try committing again
git add .
git commit -m "feat(scope): description"
# ✅ This time it should pass
```

---

## Verification

To verify enforcement is working:

### Test lint check (local)

```bash
# Introduce a lint error (e.g., an unused import) in a browser contribution
# file, then:
yarn lint
# → Should report the unused import as a warning/error

# Revert the change
yarn lint
# → Clean again
```

### Test build check (local)

```bash
# Introduce a type error in a TypeScript file, then:
yarn build
# → tsc should fail the build

# Revert the change
```

### Test CI checks (on GitHub)

```bash
# Make a PR with lint errors
# → CI workflows run automatically
# → Check the Actions tab to see results
```

---

## References

- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute
- [STYLE.md](STYLE.md) — Code conventions
- [SECURITY.md](SECURITY.md) — Security practices
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Community standards
- [ESLint documentation](https://eslint.org/docs/latest/)
- [Keep a Changelog](https://keepachangelog.com/)