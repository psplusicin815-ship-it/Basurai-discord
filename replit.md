# Discord Assistant (BasurAi)

AI destekli Discord botu — Gemini ile sohbet, moderasyon, oyunlar, ses kanalı, hoşgeldin mesajları, reaction roller ve web paneli.

## Run & Operate

- `PORT=5000 pnpm --filter @workspace/api-server run dev` — API sunucusu (port 5000)
- `pnpm --filter @workspace/discord-bot run dev` — Discord botu
- `pnpm run typecheck` — tüm paketleri typecheck et
- `pnpm run build` — typecheck + build
- `pnpm --filter @workspace/api-spec run codegen` — OpenAPI'dan hook ve Zod şemaları üret
- `pnpm --filter @workspace/db run push` — DB şema değişikliklerini uygula (dev)
- Gerekli gizli değerler: `DISCORD_TOKEN`, `DATABASE_URL`, `AI_INTEGRATIONS_GEMINI_*`, `AI_INTEGRATIONS_OPENAI_*`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Discord: discord.js v14, @discordjs/voice
- AI: Google Gemini (chat, görsel), OpenAI (oyunlar, automod)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (OpenAPI spec'ten)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/discord-bot/src/` — bot kaynak kodu
  - `index.ts` — Discord client, event handler'lar
  - `ai.ts` — Gemini AI entegrasyonu, action parsing
  - `actions.ts` — Discord eylemlerini çalıştırır (ban, kick, kanal yönetimi vb.)
  - `commands.ts` — Slash komutları
  - `automod.ts` — AI destekli otomatik moderasyon
  - `games.ts` — Sayı tahmin, kelime zinciri, trivia oyunları
  - `voice.ts` — Ses kanalı + TTS
  - `search.ts` — Web arama (Google News, DuckDuckGo, Wikipedia)
  - `image.ts` — Gemini ile görsel üretimi
  - `events/welcome.ts` — Hoşgeldin mesajları ve oto-rol
  - `events/reaction-roles.ts` — Reaction rol sistemi
  - `guild-sync.ts` — Sunucu kanal/rol önbelleği
- `artifacts/api-server/src/` — Express API
  - `routes/bot/` — bot istatistikleri, loglar, guild yönetimi
- `artifacts/bot-panel/` — React web paneli (henüz kurulmadı)
- `lib/db/src/schema/` — Drizzle şemaları: bot_logs, guild_settings, reaction_roles, guild_cache

## Architecture decisions

- Bot Gemini ile mesajları analiz eder ve JSON action listesi döndürür; her eylem ayrı fonksiyonla çalıştırılır
- AutoMod OpenAI ile kural ihlallerini tespit eder, in-memory önbellek ile spam önlenir
- Guild kanal/rol önbelleği başlangıçta DB'ye yazılır; web paneli bu önbellekten okur
- Reaction roller DB'de `messageId=null` olarak bekler; bot başlarken mesajları gönderir ve ID'yi günceller

## Product

- AI sohbet (Gemini 2.5 Flash), görsel üretimi, web arama
- Sunucu yönetimi: ban/kick/mute, kanal/rol işlemleri, etkinlik
- AutoMod: AI destekli mesaj denetimi (ban/kick/warn/delete)
- Eğlence: 8-top, zar, yazı-tura, kelime zinciri, sayı oyunu, trivia, roast/compliment
- Ses kanalı: Türkçe TTS ile sesli yanıt
- Hoşgeldin sistemi ve reaction rol sistemi
- Web paneli (bot-panel) üzerinden ayar yönetimi

## User preferences

- Türkçe konuşan kullanıcı
- Bot adı: BasurAi

## Gotchas

- `pnpm --filter @workspace/db run push` şema değişikliklerinden önce çalıştırılmalı
- `DISCORD_TOKEN` Replit Secrets'ta saklanmalı, dosyalara yazılmamalı
- Native paketler (`@discordjs/opus`, `sodium-native`) `pnpm approve-builds` gerektirir

## Pointers

- See the `pnpm-workspace` skill for workspace structure
