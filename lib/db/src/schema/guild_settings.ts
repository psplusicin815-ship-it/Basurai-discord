import { pgTable, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guildSettingsTable = pgTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  welcomeEnabled: boolean("welcome_enabled").default(false).notNull(),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message").default("Sunucumuza hoş geldin, {user}! 🎉"),
  autoRoleEnabled: boolean("auto_role_enabled").default(false).notNull(),
  autoRoleId: text("auto_role_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const guildCacheTable = pgTable("guild_cache", {
  guildId: text("guild_id").primaryKey(),
  channels: jsonb("channels").$type<Array<{ id: string; name: string; type: number }>>().default([]),
  roles: jsonb("roles").$type<Array<{ id: string; name: string; color: number }>>().default([]),
  guildName: text("guild_name").default(""),
  guildIcon: text("guild_icon"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGuildSettingsSchema = createInsertSchema(guildSettingsTable).omit({ updatedAt: true });
export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;
export type GuildSettings = typeof guildSettingsTable.$inferSelect;
export type GuildCache = typeof guildCacheTable.$inferSelect;
