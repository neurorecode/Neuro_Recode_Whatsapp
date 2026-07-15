# ---- build ----
FROM node:22-slim AS build
# openssl/ca-certificates are required by Prisma's engines (node:slim omits them).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# workspace manifests first for better layer caching
COPY pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false

# sources
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm --filter @nrw/db generate \
  && pnpm --filter @nrw/shared build \
  && pnpm --filter @nrw/db build \
  && pnpm --filter @nrw/api build

# ---- runtime ----
FROM node:22-slim AS runtime
# Prisma's query + schema engines need libssl/openssl at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
WORKDIR /app
EXPOSE 4000
# Sync the schema (scaffold uses db push; switch to `prisma migrate deploy`
# once migration files exist) then boot the API. The prisma CLI bin lives in the
# db package's node_modules (pnpm does not hoist it to the repo root).
CMD ["sh", "-c", "packages/db/node_modules/.bin/prisma db push --schema=packages/db/prisma/schema.prisma --skip-generate && node apps/api/dist/main.js"]
