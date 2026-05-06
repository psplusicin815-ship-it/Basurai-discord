#!/bin/sh
set -e

echo "Building API server..."
pnpm --filter @workspace/api-server run build

echo "Building Discord bot..."
pnpm --filter @workspace/discord-bot run build

echo "Build complete!"
