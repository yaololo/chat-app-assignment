FROM node:22.23.4-alpine

WORKDIR /workspace

COPY app/package.json app/package-lock.json ./app/
RUN cd app && npm ci
COPY app/ ./app/

COPY server/ ./server/
RUN cd app && npm run build

WORKDIR /workspace/server
RUN npm ci
RUN DATABASE_URL="postgresql://chat_app:build-only@localhost:5432/chat_app?schema=public" npm run db:generate

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npm run db:deploy && npm start"]
