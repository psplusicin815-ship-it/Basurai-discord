const API_URL = import.meta.env.VITE_API_URL || "";
const SESSION_KEY = "basurai_session";

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionId(id: string) {
  localStorage.setItem(SESSION_KEY, id);
}

export function clearSessionId() {
  localStorage.removeItem(SESSION_KEY);
}

export function loginUrl(): string {
  const redirect = encodeURIComponent(window.location.href);
  return `${API_URL}/api/auth/login?redirect=${encodeURIComponent("/dashboard")}`;
}

export async function fetchMe() {
  const sid = getSessionId();
  if (!sid) return null;
  const res = await fetch(`${API_URL}/api/auth/me?session_id=${sid}`);
  if (!res.ok) { clearSessionId(); return null; }
  return res.json();
}

export async function fetchMyGuilds() {
  const sid = getSessionId();
  if (!sid) return null;
  const res = await fetch(`${API_URL}/api/auth/guilds?session_id=${sid}`);
  if (!res.ok) { clearSessionId(); return null; }
  return res.json();
}

export async function logout() {
  const sid = getSessionId();
  if (sid) {
    await fetch(`${API_URL}/api/auth/logout?session_id=${sid}`).catch(() => {});
    clearSessionId();
  }
}

export async function fetchGuildCache(guildId: string) {
  const res = await fetch(`${API_URL}/api/bot/guild/${guildId}/cache`);
  if (!res.ok) throw new Error("Sunucu önbelleği alınamadı");
  return res.json();
}

export async function fetchGuildSettings(guildId: string) {
  const res = await fetch(`${API_URL}/api/bot/guild/${guildId}/settings`);
  if (!res.ok) throw new Error("Ayarlar alınamadı");
  return res.json();
}

export async function saveGuildSettings(guildId: string, data: object) {
  const res = await fetch(`${API_URL}/api/bot/guild/${guildId}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Ayarlar kaydedilemedi");
  return res.json();
}
