# One image recipe for the whole Exodus demo, with four stages.
# `docker compose up` (docker-compose.yml at the repo root) builds and runs it;
# docker-compose.prod.yml (the public deployment) also uses the proxy stage.
#
#   daml    installs dpm (the Daml SDK tool), builds the contracts (the DAR) and
#           the TypeScript codegen. There is no official Docker image for
#           Canton 3.5 (Docker Hub's canton-open-source stops at 2.x), so we
#           install dpm exactly like on a developer machine.
#   ledger  the Canton sandbox with our DAR (the same as `npm run ledger`).
#   app     Node.js 24 with the ledger client, the oracle bot, the API and the
#           built web app. Compose runs it several times with different commands
#           (setup, oracle, api, web).
#   proxy   nginx with the built web app, for docker-compose.prod.yml: HTTPS,
#           and /api and /v2 forwarded like `vite preview` does in the demo.
#
# "USYC" and "USDC" in Exodus are SIMULATED tokens, not issued by Circle.

# ---------------------------------------------------------------------------
# Stage 1: Daml SDK + contracts + codegen
# ---------------------------------------------------------------------------
FROM eclipse-temurin:17-jdk AS daml

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# The SDK version pinned in exodus-contract/multi-package.yaml.
ARG DAML_SDK_VERSION=3.5.11
RUN curl -sSL https://get.digitalasset.com/install/install.sh | sh -s "${DAML_SDK_VERSION}"
ENV PATH="/root/.dpm/bin:${PATH}"

WORKDIR /exodus/exodus-contract
COPY exodus-contract/ ./
# Builds main (the DAR the sandbox loads) and test.
RUN dpm build --all
# The TypeScript types of our templates, for @exodus/ledger (npm run codegen:daml).
RUN dpm codegen-js main/.daml/dist/exodus-contract-main-0.0.1.dar -o /exodus/generated/daml.js

# ---------------------------------------------------------------------------
# Stage 2: the Canton sandbox
# ---------------------------------------------------------------------------
FROM daml AS ledger

# The JSON Ledger API on 0.0.0.0 (by default it only listens on 127.0.0.1,
# which other containers cannot reach). In memory: it starts empty every time,
# and the setup service bootstraps it again.
EXPOSE 7575
CMD ["dpm", "sandbox", "--json-api-port", "7575", \
     "--dar", "main/.daml/dist/exodus-contract-main-0.0.1.dar", \
     "-C", "canton.participants.sandbox.http-ledger-api.address=0.0.0.0"]

# ---------------------------------------------------------------------------
# Stage 3: the Node.js apps (ledger client, oracle bot, API, web)
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS app

WORKDIR /exodus
COPY exodus-app/ exodus-app/
# The bootstrap script uploads the DAR from this path (see ledger/src/bootstrap.ts).
COPY --from=daml /exodus/exodus-contract/main/.daml/dist/exodus-contract-main-0.0.1.dar \
     exodus-contract/main/.daml/dist/exodus-contract-main-0.0.1.dar
# The codegen output is an npm workspace, so it must be there before `npm ci`.
COPY --from=daml /exodus/generated/daml.js exodus-app/generated/daml.js

WORKDIR /exodus/exodus-app
RUN npm ci
# The API is compiled by tsc (NestJS needs decorators); the web app by Vite.
# `prisma generate` reads DATABASE_URL from prisma.config.ts but never connects,
# so a placeholder is enough at build time; the real URL comes from compose.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build -w @exodus/api \
  && npm run build -w @exodus/web

# ---------------------------------------------------------------------------
# Stage 4: nginx for the public deployment (docker-compose.prod.yml)
# ---------------------------------------------------------------------------
FROM nginx:1.29-alpine AS proxy

# openssl makes the self-signed placeholder certificate (15-exodus-cert.envsh).
RUN apk add --no-cache openssl && rm /etc/nginx/conf.d/default.conf
COPY docker/nginx/exodus.conf.template /etc/nginx/templates/exodus.conf.template
COPY --chmod=755 docker/nginx/15-exodus-cert.envsh /docker-entrypoint.d/15-exodus-cert.envsh
COPY --from=app /exodus/exodus-app/web/dist /usr/share/nginx/html
