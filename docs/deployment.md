# Deployment

Notepadia is a web app first: `yarn start` on your own machine is a legitimate
deployment, and the same build is what the Docker image runs. Before handing
the URL to anyone else, read the *sharing caveat* below, because it changes
the security and privacy story of everything after it.

## The one sentence that comes first

**Theia 1.75's browser backend has no built-in per-user isolation.** Every
visitor who can reach the server shares *one* filesystem and *one* set of
preferences. There is no authentication, no per-user home directory, no
per-user settings, and no per-user undo history. If you cannot accept that,
deploy one instance per user (["Per-user instances"](#per-user-instances)),
and never tell a group of users they have private files on a shared server.

## Three deployment shapes

### 1. Single user, localhost (the default)

```sh
yarn install
yarn build
yarn start            # http://localhost:3000
```

`yarn start` binds the browser app to `localhost`. This is the shape the
guide and the e2e suites assume. Everything works, including the
browser-only features that need a secure context, because localhost *is* a
secure context.

### 2. Single user, on a LAN

```sh
yarn build
yarn --cwd applications/browser theia start --hostname 0.0.0.0 --port 3000
```

or, in Docker (below), bind the container's port to an interface of your
choice. Browsing on your LAN server-directs you to
`http://<host>:3000`. Decide who can reach the port:

- The **File System Access API** (Open / Save to your own computer) and the
  **async clipboard** (Copy to Clipboard) are only offered to *secure
  contexts* (`https:`, or `http://localhost`). Served over plain `http` on a
  LAN, those features silently degrade to their fallbacks (a hidden file
  input / a Blob download for local files; `execCommand` for the clipboard) -
  the app keeps working, but the richer path is gone. For the full feature
  set you want TLS, so skip to the [reverse proxy](#a-reverse-proxy-and-tls)
  section - that is also what `docker-compose.yml` gives you out of the box.
- If you reach your own machine over LAN with `http`, treat it as the
  single-user shape: do not put it on the public internet.

### 3. A small group (the unsafe default, made explicit)

Expose a shared instance to several people and you have, by default:

- one workspace directory (everything anyone opens or saves through the app),
- one shared preferences store (what one person changes in Settings, everyone
  sees on reload),
- no isolation between sessions and no audit trail.

The *only* honest ways to run this are described under
[Per-user instances](#per-user-instances). Everything else is a shared
whiteboard, not a private workspace.

## Docker

The repository ships a `Dockerfile` and a `docker-compose.yml`.

### The image

- Built on `node:24` (the version the project targets) as a **non-root** user.
- Builds the same browser application the CI does (`yarn install` then
  `yarn build`), so the image is the current build, not a stale snapshot.
- Exposes port `3000`; the container runs `theia start
  --app-target=browser --hostname 0.0.0.0 --port 3000 /workspace`, opening
  the workspace you mount at `/workspace`.

```sh
docker build -t notepadia .
docker run -d --name notepadia \
  -p 127.0.0.1:3000:3000 \
  -v notepadia-workspace:/workspace \
  notepadia
# open http://localhost:3000
```

Bind to `127.0.0.1` (above) for a single user, or leave the port reachable
for the LAN shape.

### docker-compose.yml

`docker-compose up -d` stands up Notepadia **plus a Caddy reverse proxy that
terminates TLS**[^tls] with a self-signed certificate. That gives every
browser the secure context the browser-only features need, even on a LAN
without a public domain. Two things to edit before first use:

1. The site name - change `notes.example.org` in `Caddyfile` to a hostname
   every visitor resolves, or keep the default and tell people to accept the
   self-signed certificate once.
2. Whether the shared workspace is what you actually want.

```
┌──────────┐  443 https   ┌───────┐   3000 http   ┌───────────┐
│ Browser  │ ───────────▶ │ Caddy │ ───────────── ▶│ Notepadia │
└──────────┘              └───────┘   internal     └───────┬───┘
                                                          │ /workspace
                                                          ▼
                                                 named volume (or a bind)
```

After `docker compose up -d`, visit `https://<your-host>`.

### Persistence

The workspace is a named volume `notepadia-workspace`; nothing in the
container image is written by the app (preferences live under
`THEIA_CONFIG_DIR=/app/notepadia-config`, inside the container). To move a
deployment, back up the volume; to point the app at a directory you already
manage, replace the volume with a bind mount:

```yaml
    volumes:
      - ./data/workspace:/workspace
```

Make sure the directory is writable by the container's non-root user
(uid `10001` in the image; `chown 10001:10001 ./data/workspace` once).

### Per-user instances

Real isolation is one container per user, behind a proxy that
authenticates and routes by login:

```yaml
services:
  alice:
    build: .
    volumes: [ "alice-workspace:/workspace" ]
    expose: [ "3000" ]
  bob:
    build: .
    volumes: [ "bob-workspace:/workspace" ]
    expose: [ "3000" ]
  caddy:
    image: caddy:2-alpine
    volumes: [ "./Caddyfile:/etc/caddy/Caddyfile:ro", "caddy-data:/data", "caddy-config:/config" ]
    ports: [ "80:80", "443:443" ]
```

with a Caddyfile that authenticates and forwards by path/header

```caddyfile
notes.example.org {
    @alice path /alice/*
    reverse_proxy @alice alice:3000
    @bob path /bob/*
    reverse_proxy @bob bob:3000
    basicauth {
        alice  <bcrypt-hash>
        bob    <bcrypt-hash>
    }
}
```

(Theia 1.75 offers nothing like the Theia Cloud / Cluster session routing;
authenticating before the app is the only supported seam, and it must be done
at the proxy, never "in" the app.)

**Resource note, measured on the real build (2026-10-08, Node 24, Theia
1.75):** the backend process idles at ~**140 MiB** RSS with no visitors, and
each connected browser frontend adds roughly **20-30 MiB** of backend memory -
the first connection is the expensive one (138 -> ~161 MiB at one client; a
second and third client add only ~1-3 MiB each). V8 does not return freed
heap to the OS, so that stays committed after users disconnect. The browser
side is the much larger cost (a Chromium tab's page process alone typically
runs in the hundreds of MiB), so plan memory per concurrent user around the
browser's appetite, not the backend's. Use this as a floor: for N concurrent
users, budget at least `300 + (N * 150)` MiB across the machine and watch the
backend RSS before trusting the arithmetic.

[^tls]: The shipped `Caddyfile` uses `tls internal`, so Caddy acts as its own
CA, issues a self-signed leaf for the configured site name, and serves it with
no internet connection or public DNS required.

## The testing that keeps this build honest

`yarn smoke` (`scripts/smoke-browser.mjs`) boots the built browser app on a
scratch workspace and asserts the index page renders - it is the same check
CI runs against the Docker image in `.github/workflows/docker.yml`: build the
image, run it against a throwaway volume, and `curl` the served index for the
`Notepadia` page. If the image ever stops producing a servable app, that job
fails with the logs attached.