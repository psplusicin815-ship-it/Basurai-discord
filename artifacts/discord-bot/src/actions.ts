import {
  Guild,
  GuildMember,
  ChannelType,
  PermissionFlagsBits,
  Colors,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  TextChannel,
  Message,
} from "discord.js";
import type { DiscordAction, SingleAction } from "./ai.js";
import { generateImage } from "./image.js";
import { enableAutomod, disableAutomod, getAutomodConfig } from "./automod.js";
import { pickPollChoice } from "./ai.js";
import { joinVoice, leaveVoice } from "./voice.js";

export type ActionResult =
  | { kind: "text"; content: string }
  | { kind: "image"; buffer: Buffer; caption: string };

export async function executeImageAction(prompt: string, replyText: string): Promise<ActionResult> {
  try {
    const buffer = await generateImage(prompt);
    return { kind: "image", buffer, caption: replyText };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "text", content: `❌ Görsel oluşturulamadı: ${msg}` };
  }
}

function resolveColor(colorStr?: string): number | undefined {
  if (!colorStr) return undefined;
  if (colorStr.startsWith("#")) {
    return parseInt(colorStr.slice(1), 16);
  }
  const namedColors: Record<string, number> = {
    kırmızı: Colors.Red,
    mavi: Colors.Blue,
    yeşil: Colors.Green,
    sarı: Colors.Yellow,
    turuncu: Colors.Orange,
    mor: Colors.Purple,
    altın: Colors.Gold,
    gümüş: Colors.LightGrey,
    siyah: Colors.DarkButNotBlack,
    beyaz: Colors.White,
  };
  return namedColors[colorStr.toLowerCase()];
}

function parseUserId(raw: string): string {
  const match = raw.match(/\d+/);
  return match ? match[0] : raw;
}

const EIGHT_BALL_ANSWERS = [
  "🎱 Kesinlikle evet!",
  "🎱 Görünüşe göre evet.",
  "🎱 Şüphesiz.",
  "🎱 Bence evet.",
  "🎱 Olasılıklar yüksek.",
  "🎱 Tahmin edemiyorum, tekrar sor.",
  "🎱 Şu an cevap vermeyi tercih etmiyorum.",
  "🎱 Sonra tekrar sor.",
  "🎱 Şu an bunu tahmin edemem.",
  "🎱 Düşünmeye devam et.",
  "🎱 Buna güvenme.",
  "🎱 Cevabım hayır.",
  "🎱 Kaynaklarım hayır diyor.",
  "🎱 Görünüşe göre iyi değil.",
  "🎱 Çok şüpheliyim.",
];

const QUOTES = [
  "\"Başarı, her gün tekrarlanan küçük çabaların toplamıdır.\" — Robert Collier",
  "\"Güçlü insanlar yardım istemez, yardım sunar.\" — Anonim",
  "\"Hayal ettiğin yere ulaşman için önce uyumayı bırakman gerekir.\" — Anonim",
  "\"Bugün zor gelen şey yarın normal olacak.\" — Anonim",
  "\"Başkalarının seni gördüğü gibi değil, kendin olmak istediğin gibi ol.\" — Anonim",
  "\"Düşerken öğrenirsin, kalkarken kazanırsın.\" — Anonim",
  "\"En büyük risk, hiçbir risk almamaktır.\" — Mark Zuckerberg",
];

const JOKES = [
  "Bir programcı markete gider: \"2 ekmek al, eğer domates varsa 6 tane al.\" Domates varmış, programcı 6 ekmek almış. 😂",
  "Neden programcılar karanlıktan korkmaz? Çünkü her şeyi açık kaynak! 😄",
  "Hacker bir kere bakkala girmiş: \"Para üstü istemiyorum\" demiş. Bakkal: \"Neden?\" Hacker: \"Çünkü ben cache temizlerim!\" 😂",
  "Neden iskeleti çağıran olmaz? Çünkü herkes onu BONE-ly bırakmış! 💀",
  "Ben yaptım oldu — Senior Developer mottom bu. Siz ne dersiniz? 😂",
];

export async function executeSingleAction(
  action: SingleAction,
  guild: Guild,
  executorMember: GuildMember,
  currentChannelId?: string,
  currentTextChannel?: TextChannel
): Promise<string> {
  try {
    switch (action.type) {
      case "chat":
        return action.reply;

      case "ban": {
        const userId = parseUserId(action.userId);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return `❌ Kullanıcı bulunamadı.`;
        if (!member.bannable) return `❌ Bu kullanıcıyı banlayamam (üst rol sahibi olabilir).`;
        await member.ban({ reason: action.reason || "Yönetici kararı" });
        return action.reply;
      }

      case "kick": {
        const userId = parseUserId(action.userId);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return `❌ Kullanıcı bulunamadı.`;
        if (!member.kickable) return `❌ Bu kullanıcıyı atamam (üst rol sahibi olabilir).`;
        await member.kick(action.reason || "Yönetici kararı");
        return action.reply;
      }

      case "create_channel": {
        const channelType = action.channelType === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
        let parentId: string | undefined;

        if (action.categoryName) {
          const category = guild.channels.cache.find(
            (c) => c.type === ChannelType.GuildCategory &&
              c.name.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, "").includes(
                action.categoryName!.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, "")
              )
          );
          if (category) parentId = category.id;
        }

        const channelName = action.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-ğüşıöçğüşöç]/gi, "");
        await guild.channels.create({
          name: channelName,
          type: channelType,
          parent: parentId,
          permissionOverwrites: [],
        });
        return action.reply;
      }

      case "delete_channel": {
        const ch = guild.channels.cache.find(
          (c) => c.name.toLowerCase() === action.name.toLowerCase().replace(/\s+/g, "-")
        );
        if (!ch) return `❌ "${action.name}" kanalı bulunamadı.`;
        await ch.delete();
        return action.reply;
      }

      case "delete_all_channels": {
        const channels = guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory);
        let deleted = 0;
        for (const [, ch] of channels) {
          try { await ch.delete(); deleted++; } catch { /* skip */ }
        }
        const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory);
        for (const [, cat] of categories) {
          try { await cat.delete(); } catch { /* skip */ }
        }
        return `${action.reply}\n✅ ${deleted} kanal silindi.`;
      }

      case "rename_channel": {
        const ch = guild.channels.cache.find(
          (c) => c.name.toLowerCase().includes(action.oldName.toLowerCase().replace(/\s+/g, "-"))
        );
        if (!ch) return `❌ "${action.oldName}" kanalı bulunamadı.`;
        await ch.setName(action.newName.toLowerCase().replace(/\s+/g, "-"));
        return action.reply;
      }

      case "lock_channel": {
        const lockCh = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildText && c.name.toLowerCase().includes(action.name.toLowerCase().replace(/\s+/g, "-"))
        ) as TextChannel | undefined;
        if (!lockCh) return `❌ "${action.name}" kanalı bulunamadı.`;
        await lockCh.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        return action.reply;
      }

      case "unlock_channel": {
        const unlockCh = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildText && c.name.toLowerCase().includes(action.name.toLowerCase().replace(/\s+/g, "-"))
        ) as TextChannel | undefined;
        if (!unlockCh) return `❌ "${action.name}" kanalı bulunamadı.`;
        await unlockCh.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        return action.reply;
      }

      case "create_category": {
        await guild.channels.create({ name: action.name, type: ChannelType.GuildCategory });
        return action.reply;
      }

      case "create_role": {
        await guild.roles.create({
          name: action.name,
          color: resolveColor(action.color),
          reason: "Bot tarafından oluşturuldu",
        });
        return action.reply;
      }

      case "delete_role": {
        const role = guild.roles.cache.find((r) => r.name.toLowerCase() === action.name.toLowerCase());
        if (!role) return `❌ "${action.name}" rolü bulunamadı.`;
        await role.delete();
        return action.reply;
      }

      case "delete_all_roles": {
        const roles = guild.roles.cache.filter(
          (r) => !r.managed && r.name !== "@everyone" && r.position < (guild.members.me?.roles.highest.position ?? 0)
        );
        let deleted = 0;
        for (const [, r] of roles) {
          try { await r.delete(); deleted++; } catch { /* skip */ }
        }
        return `${action.reply}\n✅ ${deleted} rol silindi.`;
      }

      case "rename_role": {
        const role = guild.roles.cache.find((r) => r.name.toLowerCase().includes(action.oldName.toLowerCase()));
        if (!role) return `❌ "${action.oldName}" rolü bulunamadı.`;
        await role.setName(action.newName);
        return action.reply;
      }

      case "assign_role": {
        const userId = parseUserId(action.userId);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return `❌ Kullanıcı bulunamadı.`;
        const role = guild.roles.cache.find((r) => r.name.toLowerCase() === action.roleName.toLowerCase());
        if (!role) return `❌ "${action.roleName}" rolü bulunamadı.`;
        await member.roles.add(role);
        return action.reply;
      }

      case "remove_role": {
        const userId = parseUserId(action.userId);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return `❌ Kullanıcı bulunamadı.`;
        const role = guild.roles.cache.find((r) => r.name.toLowerCase() === action.roleName.toLowerCase());
        if (!role) return `❌ "${action.roleName}" rolü bulunamadı.`;
        await member.roles.remove(role);
        return action.reply;
      }

      case "create_event": {
        const voiceChannel = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildVoice && c.name.toLowerCase().includes(action.channelName.toLowerCase())
        );
        if (!voiceChannel) return `❌ "${action.channelName}" ses kanalı bulunamadı.`;
        const startTime = new Date(action.startTime);
        if (isNaN(startTime.getTime())) return `❌ Geçersiz tarih formatı.`;
        const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);
        const event = await guild.scheduledEvents.create({
          name: action.name,
          description: action.description || "",
          scheduledStartTime: startTime,
          scheduledEndTime: endTime,
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: GuildScheduledEventEntityType.Voice,
          channel: voiceChannel.id,
        });
        return `${action.reply}\n🔗 Etkinlik linki: https://discord.com/events/${guild.id}/${event.id}`;
      }

      case "send_message": {
        let channel: TextChannel | undefined;
        if (action.channelId) {
          channel = guild.channels.cache.get(action.channelId) as TextChannel | undefined;
        }
        if (!channel) {
          channel = guild.channels.cache.find(
            (c) =>
              (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
              c.name.toLowerCase().includes(action.channelName.toLowerCase().replace(/\s+/g, "-"))
          ) as TextChannel | undefined;
        }
        if (!channel) return `❌ "${action.channelName}" kanalı bulunamadı.`;
        await channel.send(action.content);
        return action.reply;
      }

      case "add_reaction": {
        const ch = guild.channels.cache.find(
          (c) =>
            (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
            c.name.toLowerCase().includes(action.channelName.toLowerCase().replace(/\s+/g, "-"))
        ) as TextChannel | undefined;
        if (!ch) return `❌ "${action.channelName}" kanalı bulunamadı.`;
        const msgs = await ch.messages.fetch({ limit: 5 });
        const lastMsg = msgs.first();
        if (!lastMsg) return `❌ Kanalda tepki eklenecek mesaj bulunamadı.`;
        await lastMsg.react(action.emoji);
        return action.reply;
      }

      case "vote_poll": {
        const ch = guild.channels.cache.find(
          (c) =>
            (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
            c.name.toLowerCase().includes(action.channelName.toLowerCase().replace(/\s+/g, "-"))
        ) as TextChannel | undefined;
        if (!ch) return `❌ "${action.channelName}" kanalı bulunamadı.`;

        const msgs = await ch.messages.fetch({ limit: 15 });
        let pollMsg: Message | undefined;
        for (const [, m] of msgs) {
          if (m.reactions.cache.size > 0 || m.content.includes("?") || m.content.toLowerCase().includes("anket")) {
            pollMsg = m;
            break;
          }
        }

        if (!pollMsg) {
          const latest = msgs.first();
          if (!latest) return `❌ Oylanacak mesaj bulunamadı.`;
          pollMsg = latest;
        }

        const existingReactions = [...pollMsg.reactions.cache.keys()];
        if (existingReactions.length > 0) {
          const options = existingReactions.map((e) => {
            const reaction = pollMsg!.reactions.cache.get(e);
            return `${e} (${reaction?.count ?? 0} oy)`;
          });
          const chosen = await pickPollChoice(pollMsg.content, options);
          const emoji = chosen.trim().split(" ")[0];
          try {
            await pollMsg.react(emoji);
            return `${action.reply}\n✅ "${emoji}" seçeneğine oy verdim!\n**Mesaj:** ${pollMsg.content.substring(0, 100)}`;
          } catch {
            await pollMsg.react(existingReactions[0]);
            return `${action.reply}\n✅ İlk seçeneğe oy verdim.`;
          }
        }

        const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
        const yesNoEmojis = ["👍", "👎"];
        let chosenEmoji: string;

        if (pollMsg.content.toLowerCase().includes("evet") || pollMsg.content.toLowerCase().includes("hayır")) {
          const chosen = await pickPollChoice(pollMsg.content, ["👍 Evet", "👎 Hayır"]);
          chosenEmoji = chosen.includes("👎") ? "👎" : "👍";
        } else {
          chosenEmoji = "👍";
        }

        await pollMsg.react(chosenEmoji);
        return `${action.reply}\n✅ Oy verdim!\n**Mesaj:** ${pollMsg.content.substring(0, 100)}`;
      }

      case "setup_server": {
        const created: string[] = [];

        for (const cat of action.categories) {
          const category = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory });
          created.push(`📁 ${cat.name}`);
          for (const ch of cat.channels) {
            const type = ch.channelType === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
            await guild.channels.create({ name: ch.name, type, parent: category.id });
            created.push(`  └ ${ch.channelType === "voice" ? "🔊" : "💬"} ${ch.name}`);
          }
        }

        const roleColorMap: Record<string, number> = {
          "#FFD700": 0xFFD700, "#FF0000": 0xFF0000, "#3498DB": 0x3498DB,
          "#9B59B6": 0x9B59B6, "#2ECC71": 0x2ECC71, "#95A5A6": 0x95A5A6,
          "#7F8C8D": 0x7F8C8D, "#E74C3C": 0xE74C3C, "#F39C12": 0xF39C12,
          "#1ABC9C": 0x1ABC9C,
        };

        for (const roleData of action.roles) {
          const colorHex = roleData.color?.toUpperCase();
          const color = colorHex && roleColorMap[colorHex] !== undefined
            ? roleColorMap[colorHex]
            : colorHex ? parseInt(colorHex.replace("#", ""), 16) : 0x99AAB5;

          const permissions = roleData.isAdmin ? [PermissionFlagsBits.Administrator] : [];
          await guild.roles.create({ name: roleData.name, color, hoist: roleData.hoist ?? true, permissions });
          created.push(`🎭 Rol: ${roleData.name}`);
        }

        return `✅ Sunucu düzeni başarıyla kuruldu!\n\`\`\`\n${created.join("\n")}\n\`\`\``;
      }

      case "setup_gaming_server": {
        const catG = await guild.channels.create({ name: "📢 Genel", type: ChannelType.GuildCategory });
        const catGaming = await guild.channels.create({ name: "🎮 Oyun", type: ChannelType.GuildCategory });
        const catV = await guild.channels.create({ name: "🔊 Ses", type: ChannelType.GuildCategory });
        await guild.channels.create({ name: "📣duyurular", type: ChannelType.GuildText, parent: catG.id });
        await guild.channels.create({ name: "💬genel-sohbet", type: ChannelType.GuildText, parent: catG.id });
        await guild.channels.create({ name: "🎮oyun-sohbet", type: ChannelType.GuildText, parent: catGaming.id });
        await guild.channels.create({ name: "🔊Genel Ses", type: ChannelType.GuildVoice, parent: catV.id });
        await guild.channels.create({ name: "🎮Oyun Odası 1", type: ChannelType.GuildVoice, parent: catV.id });
        await guild.roles.create({ name: "👑 Sahip", color: Colors.Gold, hoist: true, permissions: [PermissionFlagsBits.Administrator] });
        await guild.roles.create({ name: "🛡️ Moderatör", color: Colors.Blue, hoist: true });
        await guild.roles.create({ name: "🎮 Oyuncu", color: Colors.Green, hoist: true });
        return action.reply;
      }

      case "mute": {
        const userId = parseUserId(action.userId);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return `❌ Kullanıcı bulunamadı.`;
        let muteRole = guild.roles.cache.find((r) => r.name === "Susturuldu");
        if (!muteRole) {
          muteRole = await guild.roles.create({ name: "Susturuldu", color: Colors.DarkGrey });
          for (const channel of guild.channels.cache.values()) {
            if (channel.type === ChannelType.GuildText) {
              await (channel as TextChannel).permissionOverwrites.create(muteRole, { SendMessages: false, Speak: false });
            }
          }
        }
        await member.roles.add(muteRole, action.reason || "Yönetici kararı");
        return action.reply;
      }

      case "unmute": {
        const userId = parseUserId(action.userId);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return `❌ Kullanıcı bulunamadı.`;
        const muteRole = guild.roles.cache.find((r) => r.name === "Susturuldu");
        if (!muteRole) return `❌ Susturma rolü bulunamadı.`;
        await member.roles.remove(muteRole);
        return action.reply;
      }

      case "slowmode": {
        const channel = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildText && c.name.toLowerCase().includes(action.channelName.toLowerCase())
        ) as TextChannel | undefined;
        if (!channel) return `❌ "${action.channelName}" kanalı bulunamadı.`;
        await channel.setRateLimitPerUser(action.seconds);
        return action.reply;
      }

      case "announce": {
        let targetChannel: TextChannel | undefined;
        if (action.channelName) {
          targetChannel = guild.channels.cache.find(
            (c) =>
              (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
              c.name.toLowerCase().includes(action.channelName!.toLowerCase().replace(/\s+/g, "-"))
          ) as TextChannel | undefined;
        }
        if (!targetChannel) {
          targetChannel = guild.channels.cache.find(
            (c) =>
              (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
              (c.name.includes("duyur") || c.name.includes("annou"))
          ) as TextChannel | undefined;
        }
        if (!targetChannel) targetChannel = guild.systemChannel as TextChannel | null ?? undefined;
        if (!targetChannel) return `❌ Duyuru kanalı bulunamadı.`;
        await targetChannel.send(`📢 **DUYURU**\n\n${action.content}`);
        return action.reply;
      }

      case "clear_messages": {
        const msgChannel = (currentChannelId
          ? guild.channels.cache.get(currentChannelId)
          : guild.channels.cache.find((c) => c.type === ChannelType.GuildText)
        ) as TextChannel | undefined;
        if (!msgChannel) return `❌ Kanal bulunamadı.`;
        const amount = Math.min(action.amount, 100);
        await msgChannel.bulkDelete(amount, true);
        return action.reply;
      }

      case "nick": {
        const userId = parseUserId(action.userId);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return `❌ Kullanıcı bulunamadı.`;
        if (!member.manageable) return `❌ Bu kullanıcının nickname'ini değiştiremem.`;
        await member.setNickname(action.newNick);
        return action.reply;
      }

      case "rename_server": {
        await guild.setName(action.newName);
        return action.reply;
      }

      case "server_info": {
        const owner = await guild.fetchOwner().catch(() => null);
        const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
        return (
          `📊 **${guild.name} — Sunucu Bilgisi**\n\n` +
          `👑 **Sahip:** ${owner?.user.username ?? "Bilinmiyor"}\n` +
          `👥 **Üye sayısı:** ${guild.memberCount}\n` +
          `💬 **Metin kanalı:** ${textChannels}\n` +
          `🔊 **Ses kanalı:** ${voiceChannels}\n` +
          `🎭 **Rol sayısı:** ${guild.roles.cache.size - 1}\n` +
          `📅 **Oluşturulma tarihi:** ${guild.createdAt.toLocaleDateString("tr-TR")}\n` +
          `🆔 **Sunucu ID:** ${guild.id}`
        );
      }

      case "automod_enable": {
        enableAutomod(guild.id, { action: action.action, rules: action.rules });
        const config = getAutomodConfig(guild.id)!;
        return (
          `${action.reply}\n\n` +
          `🛡️ **AutoMod Aktif!**\n` +
          `⚡ **Eylem:** ${action.action === "ban" ? "🔨 Ban" : action.action === "kick" ? "👢 Kick" : action.action === "warn" ? "⚠️ Uyarı" : "🗑️ Mesaj Sil"}\n` +
          `📋 **Kurallar:** ${config.rules.join(", ")}`
        );
      }

      case "automod_disable": {
        disableAutomod(guild.id);
        return action.reply;
      }

      case "automod_status": {
        const config = getAutomodConfig(guild.id);
        if (!config || !config.enabled) {
          return `🛡️ **AutoMod Durumu:** ❌ Kapalı\nAçmak için: "@Bot küfür edenleri banla" yazabilirsiniz.`;
        }
        return (
          `🛡️ **AutoMod Durumu:** ✅ Aktif\n` +
          `⚡ **Eylem:** ${config.action}\n` +
          `📋 **Kurallar:** ${config.rules.join(", ")}`
        );
      }

      case "join_voice": {
        return await joinVoice(guild, action.channelName, currentTextChannel);
      }

      case "leave_voice": {
        return await leaveVoice(guild);
      }

      case "fun_8ball": {
        const answer = EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)];
        return `🎱 **Sihirli 8 Top**\n❓ **Soru:** ${action.question}\n${answer}`;
      }

      case "fun_coin": {
        const result = Math.random() < 0.5 ? "👑 Yazı" : "🦅 Tura";
        return `🪙 **Yazı Tura**\nSonuç: **${result}**!`;
      }

      case "fun_dice": {
        const sides = action.sides ?? 6;
        const result = Math.floor(Math.random() * sides) + 1;
        return `🎲 **Zar Atıldı!** (${sides} yüzlü)\nSonuç: **${result}**`;
      }

      case "fun_joke": {
        const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
        return `😂 **Günün Şakası**\n${joke}`;
      }

      case "fun_roulette": {
        const members = guild.members.cache.filter((m) => !m.user.bot && !m.permissions.has(PermissionFlagsBits.Administrator));
        if (members.size === 0) return `🎰 **Çark Çevir** — Hedef bulunamadı! (adminsiz üye yok)`;
        const randomMember = members.random()!;
        return `🎰 **Çark Çevir**\n🎯 Çark **${randomMember.displayName}**'a denk geldi! 😱\n(Not: Bu sadece eğlence, gerçek bir işlem yapılmadı!)`;
      }

      case "fun_quote": {
        const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        return `✨ **İlham Verici Söz**\n${quote}`;
      }

      case "fun_ship": {
        const pct = Math.floor(Math.random() * 101);
        const hearts = "❤️".repeat(Math.floor(pct / 10)) + "🖤".repeat(10 - Math.floor(pct / 10));
        const comment = pct >= 80 ? "Mükemmel bir çift! 💑" : pct >= 60 ? "Oldukça uyumlu! 💕" : pct >= 40 ? "Orta düzey uyum. 🤔" : pct >= 20 ? "Pek uyumlu değil... 😅" : "Bu iş olmaz! 💔";
        return `💘 **Ship Ölçer**\n${action.user1} + ${action.user2}\n${hearts}\n**%${pct} uyumlu!** — ${comment}`;
      }

      default:
        return "❓ Bu komutu anlayamadım.";
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return `❌ Bir hata oluştu: ${errorMessage}`;
  }
}

export async function executeAction(
  action: DiscordAction,
  guild: Guild,
  executorMember: GuildMember,
  currentChannelId?: string,
  currentTextChannel?: TextChannel
): Promise<string> {
  if (action.type === "sequence") {
    const results: string[] = [];
    let hasError = false;

    await new Promise((r) => setTimeout(r, 100));

    for (const subAction of action.actions) {
      if (subAction.reply === undefined) (subAction as Record<string, unknown>).reply = "";
      const result = await executeSingleAction(subAction, guild, executorMember, currentChannelId, currentTextChannel);
      if (result && !result.startsWith("❌")) {
        if (result.trim()) results.push(`✅ ${result}`);
      } else if (result.startsWith("❌")) {
        results.push(result);
        hasError = true;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    const summary = hasError ? "⚠️ Bazı adımlar başarısız oldu:" : "✅ Tüm adımlar tamamlandı!";
    const resultText = results.filter(Boolean).join("\n");
    return `${summary}\n${resultText}`.trim();
  }

  return executeSingleAction(action, guild, executorMember, currentChannelId, currentTextChannel);
}
