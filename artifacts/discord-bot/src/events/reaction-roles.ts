import {
  MessageReaction,
  User,
  PartialMessageReaction,
  PartialUser,
  Guild,
  TextChannel,
} from "discord.js";
import { db, reactionRolesTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";

type Reaction = MessageReaction | PartialMessageReaction;
type ReactionUser = User | PartialUser;

function normalizeEmoji(emoji: string | null | undefined): string {
  if (!emoji) return "";
  return emoji.trim();
}

export async function handleReactionAdd(
  reaction: Reaction,
  user: ReactionUser
): Promise<void> {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch().catch(() => null);
    const { message, emoji } = reaction;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const messageId = message.id;
    const emojiStr = normalizeEmoji(emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name);

    const rules = await db
      .select()
      .from(reactionRolesTable)
      .where(eq(reactionRolesTable.guildId, guildId));

    for (const rule of rules) {
      if (rule.messageId !== messageId) continue;
      const ruleEmoji = normalizeEmoji(rule.emoji);
      if (ruleEmoji !== emojiStr && rule.emoji !== emoji.name) continue;

      const guild = message.guild as Guild;
      const member = guild.members.cache.get(user.id) ?? await guild.members.fetch(user.id).catch(() => null);
      if (!member) continue;

      const role = guild.roles.cache.get(rule.roleId);
      if (!role) continue;

      await member.roles.add(role, "Reaction Role").catch(() => null);
      console.log(`✅ Reaction rol verildi: ${user.tag ?? user.id} → ${role.name}`);

      const dm = await user.createDM().catch(() => null);
      if (dm) {
        await dm.send(`✅ **${guild.name}** sunucusunda **${role.name}** rolünü aldın!`).catch(() => null);
      }
    }
  } catch (err) {
    console.error("handleReactionAdd hatası:", err);
  }
}

export async function handleReactionRemove(
  reaction: Reaction,
  user: ReactionUser
): Promise<void> {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch().catch(() => null);
    const { message, emoji } = reaction;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const messageId = message.id;
    const emojiStr = normalizeEmoji(emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name);

    const rules = await db
      .select()
      .from(reactionRolesTable)
      .where(eq(reactionRolesTable.guildId, guildId));

    for (const rule of rules) {
      if (rule.messageId !== messageId) continue;
      const ruleEmoji = normalizeEmoji(rule.emoji);
      if (ruleEmoji !== emojiStr && rule.emoji !== emoji.name) continue;

      const guild = message.guild as Guild;
      const member = guild.members.cache.get(user.id) ?? await guild.members.fetch(user.id).catch(() => null);
      if (!member) continue;

      const role = guild.roles.cache.get(rule.roleId);
      if (!role) continue;

      await member.roles.remove(role, "Reaction Role kaldırıldı").catch(() => null);
      console.log(`✅ Reaction rol kaldırıldı: ${user.tag ?? user.id} → ${role.name}`);
    }
  } catch (err) {
    console.error("handleReactionRemove hatası:", err);
  }
}

// When bot starts, send pending reaction-role messages and update messageIds
export async function deployPendingReactionRoles(
  client: import("discord.js").Client
): Promise<void> {
  try {
    const pending = await db
      .select()
      .from(reactionRolesTable)
      .where(isNull(reactionRolesTable.messageId));

    for (const rule of pending) {
      const guild = client.guilds.cache.get(rule.guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(rule.channelId) as TextChannel | undefined;
      if (!channel || !channel.isTextBased()) continue;

      try {
        const msg = await (channel as TextChannel).send(rule.messageContent);
        await msg.react(rule.emoji).catch(() => null);

        await db
          .update(reactionRolesTable)
          .set({ messageId: msg.id })
          .where(eq(reactionRolesTable.id, rule.id));

        console.log(`✅ Reaction role mesajı gönderildi: ${rule.emoji} → ${role_name_placeholder(rule.roleName)}`);
      } catch (e) {
        console.error(`Reaction role mesajı gönderilemedi (id=${rule.id}):`, e);
      }
    }
  } catch (err) {
    console.error("deployPendingReactionRoles hatası:", err);
  }
}

function role_name_placeholder(name: string | null): string {
  return name ?? "rol";
}
