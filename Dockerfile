FROM node:22-bookworm-slim

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @shortfactory/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@shortfactory/web", "start"]
