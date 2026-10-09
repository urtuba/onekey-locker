# Build context: the repository root (see docker-compose.yml).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/crypto/package.json packages/crypto/
COPY packages/api/package.json packages/api/
COPY packages/client/package.json packages/client/
RUN npm ci
COPY packages/crypto packages/crypto
COPY packages/api packages/api
RUN npm run build -w @onekey-locker/crypto && npm run build -w @onekey-locker/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json .npmrc ./
COPY packages/crypto/package.json packages/crypto/
COPY packages/api/package.json packages/api/
COPY packages/client/package.json packages/client/
RUN npm ci --omit=dev -w @onekey-locker/api
COPY --from=build /app/packages/crypto/dist packages/crypto/dist
COPY --from=build /app/packages/api/dist packages/api/dist
USER node
EXPOSE 3001
CMD ["node", "packages/api/dist/index.js"]
