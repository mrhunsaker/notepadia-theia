<!--
 Copyright 2026 Michael Ryan Hunsaker, M.Ed., Ph.D.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

# Security Policy

## Supported Versions

Only the latest release is actively supported with security fixes.

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| Older   | No        |

## Reporting a Vulnerability

**Please do not open a public GitHub Issue for security vulnerabilities.**

Report security issues privately via one of the following channels:

- **GitHub Private Security Advisory**: Use the
  [Security tab → Report a vulnerability](https://github.com/mrhunsaker/notepadia-theia/security/advisories/new)
  form in this repository.
- **Email**: Send details to `github@mail.hunsakerweb.com` with the subject line
  `[notepadia SECURITY] <short description>`.

### What to include

A useful report includes:

1. A description of the vulnerability and its potential impact.
2. Steps to reproduce or a minimal proof-of-concept.
3. The version(s) affected.
4. Any suggested mitigations or patches, if known.

### Response timeline

| Milestone | Target |
|-----------|--------|
| Acknowledgement of report | 3 days |
| Initial assessment / triage | 7 days |
| Patch / advisory published | 30 days |

If a fix will take longer than 30 days we will notify you and agree on a
coordinated disclosure date.

## Scope

This project is a **desktop text editor** built on Eclipse Theia with an
Electron packaging layer. The security boundary is:

- **In scope**: vulnerabilities in the `notepadia` extension code
  (`extensions/notepadia/`), the browser/Electron application shells
  (`applications/browser`, `applications/electron`), the dependency chain, and
  the CI/build configuration.
- **Out of scope**: vulnerabilities in upstream Theia, Monaco, Electron, or the
  host operating system. Report upstream issues to the respective projects.

## Document Security

The editor is a general-purpose text editor; it does not render or execute the
document content it opens. File content is handled by editor/model layers in
Theia and Monaco — do not add shelling out to interpreters, or markdown/html
rendering that deserializes untrusted content, without a security review.

## Dependency Security

Dependencies are tracked in the `yarn.lock` at the repository root. To audit
the dependency tree for known vulnerabilities:

```bash
yarn audit --groups dependencies
```

The `@theia/*` packages are intentionally pinned to the 1.75.0 baseline;
baseline upgrades are coordinated by the maintainers and reviewed as a group.

## Acknowledgements

We follow the
[GitHub coordinated vulnerability disclosure guidelines](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/about-coordinated-disclosure-of-security-vulnerabilities).