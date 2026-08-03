FROM node:22.13.1-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN npm install --global pnpm@10.15.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/charger-simulator/package.json apps/charger-simulator/package.json
COPY apps/mobile-driver/package.json apps/mobile-driver/package.json
COPY packages/admin-contracts packages/admin-contracts
COPY packages/database packages/database
COPY packages/design-tokens packages/design-tokens

RUN pnpm install --frozen-lockfile

COPY apps/admin-web apps/admin-web
RUN pnpm --filter @solis/admin-contracts build \
  && pnpm --filter @solis/design-tokens build \
  && pnpm --filter @solis/admin-web build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY apps/admin-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/admin-web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
  CMD wget --quiet --spider http://127.0.0.1:8080/healthz || exit 1
