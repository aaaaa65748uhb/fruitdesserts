# SUPERIL production image (Next.js standalone server + Prisma migrations).
#   docker build -t superil .
#   docker compose up -d        (app + PostgreSQL with a persistent volume, see docker-compose.yml)
# The full Debian image is used because it already contains openssl/libssl and CA certificates, which the
# Prisma query engine needs – no package downloads are required at build time.
# Base image is overridable, e.g. --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm
ARG NODE_IMAGE=node:22-bookworm

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=1
RUN npm run build
# Self-contained Prisma CLI (same version as the app) used only to run migrations at start-up.
RUN mkdir /migrator && cd /migrator && npm init -y >/dev/null \
  && npm install --no-audit --no-fund "prisma@$(node -p "require('/app/node_modules/prisma/package.json').version")"

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
RUN groupadd -r superil && useradd -r -g superil superil
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/data/barcode-map.json ./data/barcode-map.json
COPY --from=build /migrator /migrator
USER superil
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node /migrator/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && node server.js"]
