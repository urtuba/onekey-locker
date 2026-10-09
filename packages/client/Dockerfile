# Build context: the repository root (see docker-compose.yml).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/crypto/package.json packages/crypto/
COPY packages/api/package.json packages/api/
COPY packages/client/package.json packages/client/
RUN npm ci
COPY packages/crypto packages/crypto
COPY packages/client packages/client
RUN npm run build -w @onekey-locker/crypto && npm run build -w @onekey-locker/client

FROM nginx:alpine
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/client/dist /usr/share/nginx/html
EXPOSE 80
