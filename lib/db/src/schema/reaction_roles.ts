import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reactionRolesTable = pgTable("reaction_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  messageContent: text("message_content").notNull(),
  emoji: text("emoji").notNull(),
  roleId: text("role_id").notNull(),
  roleName: text("role_name").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReactionRoleSchema = createInsertSchema(reactionRolesTable).omit({ id: true, createdAt: true });
export type InsertReactionRole = z.infer<typeof insertReactionRoleSchema>;
export type ReactionRole = typeof reactionRolesTable.$inferSelect;
