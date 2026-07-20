FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
ENV PUBLIC_DIR=/app/public
ENV DATA_FILE=/data/sync.json

COPY server/server.js /app/server.js
COPY . /app/public

EXPOSE 8787
CMD ["node", "/app/server.js"]
