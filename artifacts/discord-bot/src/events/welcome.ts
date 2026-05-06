import { GuildMember, EmbedBuilder, Colors, AttachmentBuilder } from "discord.js";
import { db, guildSettingsTable, guildCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const { guild } = member;

  try {
    // Load settings
    const [settings] = await db
      .select()
      .from(guildSettingsTable)
      .where(eq(guildSettingsTable.guildId, guild.id));

    // Auto role
    if (settings?.autoRoleEnabled && settings.autoRoleId) {
      const role = guild.roles.cache.get(settings.autoRoleId);
      if (role) {
        await member.roles.add(role, "Otomatik Rol").catch((e) =>
          console.error("Otomatik rol verilemedi:", e)
        );
        console.log(`✅ Otomatik rol verildi: ${member.user.tag} → ${role.name}`);
      }
    }

    // Welcome message
    if (settings?.welcomeEnabled && settings.welcomeChannelId) {
      const channel = guild.channels.cache.get(settings.welcomeChannelId);
      if (!channel || !channel.isTextBased()) return;

      const msg = (settings.welcomeMessage ?? "Sunucumuza hoş geldin, {user}! 🎉")
        .replace("{user}", `<@${member.user.id}>`)
        .replace("{username}", member.user.displayName)
        .replace("{server}", guild.name)
        .replace("{count}", String(guild.memberCount));

      const memberNumber = guild.memberCount;
      const avatarUrl = member.user.displayAvatarURL({ size: 256 });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`👋 Yeni Üye Katıldı!`)
        .setDescription(msg)
        .setThumbnail(avatarUrl)
        .setImage(avatarUrl.replace(/\?size=\d+/, "?size=512"))
        .addFields(
          { name: "👤 Kullanıcı", value: `${member.user.tag}`, inline: true },
          { name: "📅 Hesap Yaşı", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: "👥 Üye Sayısı", value: `**${memberNumber}**. üye`, inline: true },
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined })
        .setTimestamp();

      await (channel as any).send({ embeds: [embed] });
      console.log(`✅ Hoşgeldin mesajı gönderildi: ${member.user.tag} → #${(channel as any).name}`);
    }
  } catch (err) {
    console.error("handleMemberJoin hatası:", err);
  }
}
