# Notepadia - browser application image.
#
# Builds the same `yarn build` the CI produces and runs it as a non-root user.
# See docs/deployment.md for the sharing caveat and the per-user options.

FROM node:24-bookworm-slim

# Native build prerequisites mirroring .github/workflows/e2e.yml and build.yml.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        pkg-config \
        libx11-dev \
        libxkbfile-dev \
        libsecret-1-dev \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first (layer caching), then the source.
COPY package.json yarn.lock .npmrc .yarnrc lerna.json ./
COPY applications applications
COPY extensions extensions
COPY scripts scripts
RUN corepack enable && corepack prepare yarn@1.22.22 --activate \
    && yarn install --frozen-lockfile

# Compile the extension and the browser bundle.
RUN yarn build:extensions && yarn --cwd applications/browser build

# Non-root runtime user with a fixed uid so mounted volumes can be chowned
# once and reused across rebuilds. Theia writes preferences/state here (per
# container - deliberately not the shared workspace volume).
ENV THEIA_CONFIG_DIR=/app/notepadia-config
RUN groupadd --system app && useradd --system --uid 10001 --gid app app \
    && mkdir -p /workspace /home/app /app/notepadia-config \
    && chown -R app:app /workspace /home/app /app/notepadia-config

USER app

# The workspace every visitor shares; mount a volume here (see compose file).
VOLUME ["/workspace"]

EXPOSE 3000

WORKDIR /app/applications/browser

CMD ["/app/node_modules/.bin/theia", "start", "--app-target=browser", \
     "--hostname", "0.0.0.0", "--port", "3000", "/workspace"]