import { pgTable, text, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botLogsTable = pgTable("bot_logs", {
  id: serial("id").primaryKey(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  guildName: text("guild_name").notNull(),
  channelId: varchar("channel_id", { length: 32 }).notNull(),
  channelName: text("channel_name").notNull(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  username: text("username").notNull(),
  messageContent: text("message_content").notNull(),
  actionType: varchar("action_type", { length: 64 }).notNull().default("chat"),
  actionResult: text("action_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBotLogSchema = createInsertSchema(botLogsTable).omit({ id: true, createdAt: true });
export type InsertBotLog = z.infer<typeof insertBotLogSchema>;
export type BotLog = typeof botLogsTable.$inferSelect;
