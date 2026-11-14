FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "--import", "tsx", "src/index.ts"]
