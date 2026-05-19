FROM node:20-alpine
RUN npm install -g pnpm@10
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
CMD ["pnpm", "--filter", "@workspace/discord-bot", "run", "dev"]
