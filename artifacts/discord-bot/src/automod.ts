import { Guild, GuildMember, TextChannel } from "discord.js";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export type AutomodAction = "ban" | "kick" | "warn" | "delete";

export interface AutomodConfig {
  enabled: boolean;
  action: AutomodAction;
  logChannelId?: string;
  rules: string[];
}

const guildAutomod = new Map<string, AutomodConfig>();

export function enableAutomod(guildId: string, config: Partial<AutomodConfig> = {}) {
  guildAutomod.set(guildId, {
    enabled: true,
    action: config.action ?? "ban",
    logChannelId: config.logChannelId,
    rules: config.rules ?? ["küfür", "hakaret", "ırkçılık", "spam"],
  });
}

export function disableAutomod(guildId: string) {
  const existing = guildAutomod.get(guildId);
  if (existing) existing.enabled = false;
}

export function getAutomodConfig(guildId: string): AutomodConfig | undefined {
  return guildAutomod.get(guildId);
}

export function setAutomodLogChannel(guildId: string, channelId: string) {
  const config = guildAutomod.get(guildId);
  if (config) config.logChannelId = channelId;
}

const violationCache = new Map<string, number>();

async function isViolation(content: string, rules: string[]): Promise<{ isViolation: boolean; reason: string }> {
  const rulesText = rules.join(", ");
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: `Discord mesaj denetleyicisisin. Mesajın şu kuralları ihlal edip etmediğini belirle: ${rulesText}. Sadece JSON döndür: {"isViolation": true/false, "reason": "neden"}. Kesin emin olmadıkça false döndür.`,
      },
      { role: "user", content: `Mesaj: "${content}"` },
    ],
    max_tokens: 60,
    temperature: 0,
  });

  try {
    const text = completion.choices[0]?.message?.content?.trim() || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    /* ignore */
  }
  return { isViolation: false, reason: "" };
}

export async function checkAutomod(
  guild: Guild,
  member: GuildMember,
  content: string,
  messageChannel: TextChannel,
  deleteMsg: () => Promise<void>
): Promise<void> {
  const config = guildAutomod.get(guild.id);
  if (!config || !config.enabled) return;
  if (member.permissions.has(BigInt(8))) return;

  const key = `${guild.id}:${member.id}`;
  const now = Date.now();
  const last = violationCache.get(key) ?? 0;
  if (now - last < 3000) return;
  violationCache.set(key, now);

  const result = await isViolation(content, config.rules).catch(() => ({ isViolation: false, reason: "" }));
  if (!result.isViolation) return;

  const logChannel = config.logChannelId
    ? (guild.channels.cache.get(config.logChannelId) as TextChannel | undefined)
    : (guild.channels.cache.find(
        (c) => c.name.includes("log") || c.name.includes("mod")
      ) as TextChannel | undefined);

  try {
    await deleteMsg();
  } catch { /* ignore */ }

  const actionMsg = config.action === "ban"
    ? `🔨 **${member.displayName}** sunucudan **banlandı**!`
    : config.action === "kick"
    ? `👢 **${member.displayName}** sunucudan **atıldı**!`
    : config.action === "warn"
    ? `⚠️ **${member.displayName}** **uyarıldı**!`
    : `🗑️ **${member.displayName}** mesajı silindi.`;

  const logText = `🛡️ **AutoMod** | ${actionMsg}\n📝 **Sebep:** ${result.reason}\n💬 **Mesaj:** \`${content.substring(0, 100)}\``;

  if (logChannel) {
    await logChannel.send(logText).catch(() => null);
  }

  await messageChannel.send(`${actionMsg}\n**Sebep:** ${result.reason}`).catch(() => null);

  if (config.action === "ban" && member.bannable) {
    await member.ban({ reason: result.reason }).catch(() => null);
  } else if (config.action === "kick" && member.kickable) {
    await member.kick(result.reason).catch(() => null);
  } else if (config.action === "warn") {
    await member.send(`⚠️ **Uyarı** | ${guild.name}\n**Sebep:** ${result.reason}`).catch(() => null);
  }
}
