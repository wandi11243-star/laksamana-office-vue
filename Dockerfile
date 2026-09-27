# Build the static SPA, serve it with nginx. The API base is baked in at build:
#   docker build --build-arg NUXT_PUBLIC_API_BASE=https://api.laksamanamuda.id/api/v1 -t office .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NUXT_PUBLIC_API_BASE=https://dev-api.laksamanamuda.id/api/v1
ENV NUXT_PUBLIC_API_BASE=$NUXT_PUBLIC_API_BASE
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/.output/public /usr/share/nginx/html
EXPOSE 80
