FROM node:26-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:26-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/static ./static
COPY --from=builder /app/drizzle ./drizzle

# Default for a plain `docker run`; docker-compose and fly.toml point this at
# its own mount.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node

EXPOSE 8080

CMD ["node", "dist/dropit/server/server.mjs"]
