# Notepadia architecture

## Principle

Notepadia reproduces the Notepad++ user experience without reproducing the
Notepad++ internal implementation.

## Applications

- `applications/browser` — the primary development target. A Theia browser
  application whose Node backend serves the frontend at `http://localhost:3000`.
  No native rebuild is required per edit; iterate with `yarn watch` + `yarn start`.
- `applications/electron` — the native desktop packaging target (Electron +
  Electron Builder). Used only when producing distributables (AppImage/RPM/DEB
  on Linux, NSIS/portable on Windows, DMG on macOS).

Both load the same `notepadia` extension; product logic lives there.

Theia owns:

- editor lifecycle
- Monaco integration
- filesystem
- workspaces
- navigator
- command registry
- keybindings
- menus
- preferences
- search

Notepadia owns:

- product menus and shortcuts
- Notepad++-specific editing behavior
- encoding UX
- EOL UX
- session/recent-file UX
- status bar presentation
- product branding
- desktop packaging choices

## Dependency rule

Do not depend directly on private Theia implementation modules unless the
public Theia API does not provide the required behavior and the dependency is
documented with a migration note.

## Encoding boundary

Future encoding support should live behind:

```ts
interface DocumentEncodingService {
  detect(data: Uint8Array): DocumentEncoding;
  decode(data: Uint8Array, encoding: DocumentEncoding): string;
  encode(text: string, encoding: DocumentEncoding): Uint8Array;
}
```

The editor should work with normalized text; the persistence layer preserves
the selected encoding and EOL convention.

## Testing

At minimum:

- command tests
- encoding round-trip tests
- EOL preservation tests
- session restore tests
- search/replace tests
- Electron smoke test
- Windows packaging smoke test
