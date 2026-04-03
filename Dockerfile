FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build:web

FROM nginx:alpine
COPY --from=build /app/release/app/dist/renderer/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
