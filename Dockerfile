FROM node:24-alpine
WORKDIR /app
COPY server.mjs ./server.mjs
COPY public ./public
COPY migrations ./migrations
RUN mkdir -p /data && chown -R node:node /app /data
ENV NODE_ENV=production DB_PATH=/data/shinkanavi.sqlite PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
