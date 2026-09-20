# syntax=docker/dockerfile:1

# Build from the repository root so npm can resolve the workspace dependency shared
# by the API and the supplied reference core.
FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY reference-core/package.json ./reference-core/package.json
RUN npm ci

# This target deliberately retains development tools such as tsx. Compose uses it
# only for the short-lived, non-root migration/seed container.
FROM dependencies AS migration
COPY --chown=node:node . .
USER node
CMD ["npm", "run", "db:bootstrap"]

FROM dependencies AS builder
COPY . .
RUN npm run build --workspace=@veridian/api

# Keep runtime dependencies separate from the build toolchain. The API bundle leaves
# package imports external, so the workspace reference-core is copied into the final
# image alongside production node_modules.
FROM base AS production-dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY reference-core/package.json ./reference-core/package.json
RUN npm ci --omit=dev

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/reference-core ./reference-core
COPY --from=builder --chown=node:node /app/data ./data

USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
