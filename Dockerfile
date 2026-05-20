FROM node:20-alpine
RUN npm install -g pnpm@10
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
CMD sh -c "pnpm --filter @workspace/db run push && pnpm --filter @workspace/discord-bot run dev"
