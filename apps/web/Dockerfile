# syntax=docker/dockerfile:1

# Build from the workspace root. This lets npm install the lockfile exactly once
# while retaining the workspace topology expected by the Next.js build.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY reference-core/package.json ./reference-core/package.json
RUN npm ci

FROM dependencies AS builder
COPY . .
# The public directory is optional in Next.js, but creating it keeps the explicit
# runtime copy below valid when an application has no public assets yet.
RUN mkdir -p apps/web/public
RUN npm run build --workspace=@veridian/web

# Next's standalone output includes only the traced server and runtime dependencies.
# Static and public assets are added explicitly, as required by standalone deployments.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nextjs \
    && useradd --system --uid 1001 --gid nextjs nextjs

COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
