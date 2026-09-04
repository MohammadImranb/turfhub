# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: deps - install production dependencies only
# ---------------------------------------------------------------------------
# Alpine is ~50MB against ~1.1GB for the full node image. The app is pure
# JavaScript with no native build steps, so the smaller base is safe here.
FROM node:22-alpine AS deps

WORKDIR /app

# Copy ONLY the manifests first. Docker caches each instruction as a layer and
# reuses it while the inputs are unchanged, so editing app.js does not
# reinstall node_modules - the expensive step stays cached.
COPY package.json package-lock.json ./

# npm ci, not npm install:
#   - installs exactly what package-lock.json pins, so builds are reproducible
#   - fails loudly if the lockfile and package.json disagree
#   - wipes node_modules first, so no stale state
# --omit=dev leaves out jest/supertest, which the runtime image never needs.
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 2: runtime - the image that actually ships
# ---------------------------------------------------------------------------
# Starting FROM a fresh base means npm's cache and any build tooling from
# stage 1 are left behind. Only what we explicitly COPY makes it in.
FROM node:22-alpine AS runtime

# Some npm packages read this; it also switches Express into production mode
# (cached view templates, terse error pages) and turns on our secure cookie.
ENV NODE_ENV=production

WORKDIR /app

# The node:alpine images already ship an unprivileged "node" user (uid 1000).
# Containers run as root by default, which means a container escape lands the
# attacker as root on the host. Dropping privileges costs nothing here.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node

# Documentation only - EXPOSE does not publish anything. The port still has to
# be mapped at run time with -p, or by compose/kubernetes.
EXPOSE 3000

# Ask the app whether it is actually serving, not merely whether the process
# exists. A Node process can be alive while the event loop is wedged.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form (JSON array), not shell form. Shell form wraps the process in
# /bin/sh, which swallows SIGTERM - the container then ignores "docker stop"
# and gets SIGKILLed after 10s. Exec form makes node PID 1 and signal-aware.
CMD ["node", "app.js"]
