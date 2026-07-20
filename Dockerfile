FROM node:22.13.1-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN apt-get update && apt-get install --yes --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN npm install --global pnpm@10.15.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/mobile-driver/package.json apps/mobile-driver/package.json
COPY packages/database packages/database

RUN pnpm install --frozen-lockfile && pnpm rebuild argon2

COPY apps/backend apps/backend

RUN pnpm --filter @solis/database build && pnpm --filter @solis/backend build

EXPOSE 8000

CMD ["node", "apps/backend/dist/main.js"]
