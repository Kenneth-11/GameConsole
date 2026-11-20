FROM node:22-alpine AS build
WORKDIR /app
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache ca-certificates
ENV GAMESTATS_GO_HOST=gamestats-go \
    GAMECONSOLE_PROLOG_HOST=gameconsole-prolog \
    GAMESTATS_GO_TLS_NAME=gamestats-go \
    GAMECONSOLE_PROLOG_TLS_NAME=gameconsole-prolog
COPY deploy/aca/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O - http://127.0.0.1/healthz >/dev/null || exit 1
