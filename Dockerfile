FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.14.0 --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install
COPY . .
RUN pnpm build && echo "=== dist contents ===" && find dist -type f | sort || (echo "ERROR: pnpm build failed" && exit 1)
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found — see above for actual output" && exit 1)

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
RUN corepack enable && corepack prepare pnpm@9.14.0 --activate
COPY --chown=nestjs:nodejs package.json pnpm-lock.yaml* ./
RUN pnpm install --prod
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
USER nestjs
EXPOSE 3000
CMD ["node", "dist/main"]
