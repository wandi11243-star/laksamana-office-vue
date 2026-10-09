# Build the static SPA, serve it with nginx. The API base is baked in at build and
# has no default, so an image can never silently talk to the wrong API:
#   docker build --build-arg NUXT_PUBLIC_API_BASE=https://api.laksamanamuda.id/api/v1 -t office .
# CI builds and publishes it to GHCR (.github/workflows/image.yml).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
ARG NUXT_PUBLIC_API_BASE
RUN test -n "$NUXT_PUBLIC_API_BASE" || { echo "NUXT_PUBLIC_API_BASE build-arg is required" >&2; exit 1; }
ENV NUXT_PUBLIC_API_BASE=$NUXT_PUBLIC_API_BASE
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/.output/public /usr/share/nginx/html
EXPOSE 80
