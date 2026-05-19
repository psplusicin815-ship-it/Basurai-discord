import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CLIENT_ID = "1487520589722685551";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "http://localhost:8080/api/auth/callback";

// Basit in-memory session (üretim için yeterli)
const sessions: Map<string, { accessToken: string; expiresAt: number }> = new Map();

function randomToken(len = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let t = "";
  for (let i = 0; i < len; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

// GET /api/auth/login — Discord OAuth2'ye yönlendir
router.get("/login", (req, res) => {
  const redirectAfter = (req.query.redirect as string) || "/dashboard";
  const state = Buffer.from(JSON.stringify({ redirect: redirectAfter, nonce: randomToken(8) })).toString("base64url");
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

// GET /api/auth/callback — Discord'dan dönen code'u token'a çevir
router.get("/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  if (!code) {
    res.status(400).send("Kod eksik");
    return;
  }

  let redirectAfter = "/dashboard";
  try {
    if (state) {
      const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
      redirectAfter = parsed.redirect || "/dashboard";
    }
  } catch {}

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      res.status(400).send("Token alınamadı");
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string; expires_in: number };
    const sessionId = randomToken(48);
    sessions.set(sessionId, {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    });

    // Frontend'in beklediği origin'e cookie set et — InfinityFree veya Replit
    const origin = req.headers.origin || req.headers.referer || "";
    const frontendUrl = process.env.FRONTEND_URL || "";

    // Redirect: frontend'e session_id query param ile git
    const target = new URL(redirectAfter, frontendUrl || `http://${req.headers.host}`);
    target.searchParams.set("session_id", sessionId);
    res.redirect(target.toString());
  } catch (err) {
    console.error("Auth callback error:", err);
    res.status(500).send("Sunucu hatası");
  }
});

// GET /api/auth/me — mevcut kullanıcı bilgisi
router.get("/me", async (req, res) => {
  const sessionId = (req.query.session_id || req.headers["x-session-id"]) as string;
  if (!sessionId) { res.status(401).json({ error: "Oturum bulunamadı" }); return; }

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    res.status(401).json({ error: "Oturum süresi doldu" });
    return;
  }

  try {
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!userRes.ok) { res.status(401).json({ error: "Kullanıcı bilgisi alınamadı" }); return; }
    const user = await userRes.json();
    res.json(user);
  } catch {
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/auth/guilds — kullanıcının yönetici olduğu, botun da bulunduğu sunucular
router.get("/guilds", async (req, res) => {
  const sessionId = (req.query.session_id || req.headers["x-session-id"]) as string;
  if (!sessionId) { res.status(401).json({ error: "Oturum bulunamadı" }); return; }

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    res.status(401).json({ error: "Oturum süresi doldu" });
    return;
  }

  try {
    // Kullanıcının tüm sunucularını çek
    const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!guildsRes.ok) { res.status(401).json({ error: "Sunucu listesi alınamadı" }); return; }

    const userGuilds = await guildsRes.json() as Array<{
      id: string; name: string; icon: string | null; permissions: string;
    }>;

    // Kullanıcının ADMINISTRATOR (0x8) iznine sahip olduğu sunucular
    const ADMIN_PERM = BigInt(0x8);
    const adminGuilds = userGuilds.filter((g) => (BigInt(g.permissions) & ADMIN_PERM) === ADMIN_PERM);

    // Bot'un bulunduğu sunucu ID'lerini DB'den çek
    const { db } = await import("@workspace/db");
    const { guildCacheTable } = await import("@workspace/db");
    const botGuilds = await db.select({ guildId: guildCacheTable.guildId }).from(guildCacheTable);
    const botGuildIds = new Set(botGuilds.map((g) => g.guildId));

    // Kesişim: admin VE bot var
    const result = adminGuilds
      .filter((g) => botGuildIds.has(g.id))
      .map((g) => ({
        guildId: g.id,
        guildName: g.name,
        guildIcon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
          : null,
      }));

    res.json(result);
  } catch (err) {
    console.error("Guilds fetch error:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// GET /api/auth/logout
router.get("/logout", (req, res) => {
  const sessionId = (req.query.session_id || req.headers["x-session-id"]) as string;
  if (sessionId) sessions.delete(sessionId);
  res.json({ ok: true });
});

export default router;
