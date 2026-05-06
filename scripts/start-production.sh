#!/bin/sh
set -e

# Discord botunu arka planda başlat
node --enable-source-maps artifacts/discord-bot/dist/index.mjs &
BOT_PID=$!

# API sunucusunu ön planda çalıştır (ana process)
node --enable-source-maps artifacts/api-server/dist/index.mjs

# API sunucusu kapanırsa botu da durdur
kill $BOT_PID 2>/dev/null || true
