FROM node:20-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --workspace=server --include-workspace-root=false
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/src ./server/src
WORKDIR /workspace/server
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --omit=dev --workspace=server --include-workspace-root=false
COPY --from=build /workspace/server/dist ./server/dist
RUN mkdir -p uploads/books
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:5000/api/v1/health || exit 1
CMD ["node", "server/dist/index.js"]
