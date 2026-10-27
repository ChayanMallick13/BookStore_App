FROM node:20-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --workspace=client --include-workspace-root=false
COPY client ./client
WORKDIR /workspace/client
RUN npm run build

FROM nginx:alpine
ENV API_PROXY_URL=http://server:5000
COPY client/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/client/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ || exit 1
