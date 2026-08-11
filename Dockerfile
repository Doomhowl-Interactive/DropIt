FROM node:26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache --virtual .build-deps \
	build-base \
	python3

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:26-alpine

WORKDIR /app

RUN apk add --no-cache --virtual .runtime-deps \
		libstdc++

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build-deps \
		build-base \
		python3 \
	&& npm ci --omit=dev \
	&& npm cache clean --force \
	&& apk del .build-deps

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/static ./static
COPY --from=builder /app/drizzle ./drizzle

# Defaults for a plain `docker run`; docker-compose and fly.toml point these at
# their own mounts.
RUN mkdir -p /app/uploads /app/data && chown -R node:node /app

USER node

EXPOSE 8080

CMD ["node", "dist/dropit/server/server.mjs"]
