import { Client } from "discord.js";
import { db, guildCacheTable } from "@workspace/db";

export async function syncGuildCache(client: Client): Promise<void> {
  try {
    for (const guild of client.guilds.cache.values()) {
      try {
        await guild.channels.fetch().catch(() => null);
        await guild.roles.fetch().catch(() => null);

        const channels = guild.channels.cache
          .filter((c) => c.type === 0 || c.type === 2 || c.type === 4 || c.type === 5)
          .map((c) => ({ id: c.id, name: c.name, type: c.type }));

        const roles = guild.roles.cache
          .filter((r) => !r.managed && r.name !== "@everyone")
          .sort((a, b) => b.position - a.position)
          .map((r) => ({ id: r.id, name: r.name, color: r.color }));

        await db
          .insert(guildCacheTable)
          .values({
            guildId: guild.id,
            guildName: guild.name,
            guildIcon: guild.iconURL(),
            channels,
            roles,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: guildCacheTable.guildId,
            set: {
              guildName: guild.name,
              guildIcon: guild.iconURL(),
              channels,
              roles,
              updatedAt: new Date(),
            },
          });

        console.log(`✅ Guild cache senkronize: ${guild.name} (${channels.length} kanal, ${roles.length} rol)`);
      } catch (e) {
        console.error(`Guild cache senkronize hatası (${guild.name}):`, e);
      }
    }
  } catch (err) {
    console.error("syncGuildCache hatası:", err);
  }
}
