# Stage 1: build the React client
# node:22-slim (Debian/glibc) ships working prebuilt binaries for esbuild and
# better-sqlite3; alpine/musl has none and would force a native compile.
FROM node:22-slim AS builder
WORKDIR /build/client

COPY dashboard/client/package*.json ./
RUN npm install

COPY dashboard/client/ ./
RUN npm run build

# Stage 2: production server
FROM node:22-slim
WORKDIR /app

COPY dashboard/package*.json ./
RUN npm install --omit=dev

COPY dashboard/server/ ./server/
COPY dashboard/scripts/ ./scripts/
COPY --from=builder /build/client/dist ./client/dist/

EXPOSE 4820
ENV NODE_ENV=production
ENV DASHBOARD_PORT=4820

CMD ["node", "server/index.js"]
