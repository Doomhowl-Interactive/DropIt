FROM golang:1.26-alpine AS builder


WORKDIR /app

RUN apk add --no-cache git gcc musl-dev bash

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ENV CGO_ENABLED=1
ENV GIN_MODE=release

RUN go build -o app ./cmd/server

FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/app .
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/static ./static
COPY --from=builder /app/.env ./

RUN mkdir -p /app/uploads

RUN adduser -D appuser
USER appuser

ENV GIN_MODE=release

EXPOSE 8000

CMD ["./app"]