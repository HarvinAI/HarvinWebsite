# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for Next.js 16 (App Router) on Cloud Run.
# Requires `output: 'standalone'` in next.config.ts so the runner stage can
# copy a minimal self-contained server.
#
# Build:  gcloud builds submit --tag <region>-docker.pkg.dev/<project>/<repo>/web:<tag>
# Deploy: gcloud run deploy harvinai-web --image <same tag> --region <region>

# ── deps stage ───────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── build stage ──────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runtime stage ────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Headless Chromium runtime deps (puppeteer + @sparticuz/chromium).
# Without these the scanner crashes on launch.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libnss3 libatk-bridge2.0-0 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
      libasound2 libdrm2 libxshmfence1 libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root for Cloud Run best practice
RUN groupadd -r nodejs && useradd -r -g nodejs -d /app nextjs && chown -R nextjs:nodejs /app
USER nextjs

# Standalone output: server.js + minimal node_modules + .next/
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

EXPOSE 8080
CMD ["node", "server.js"]
