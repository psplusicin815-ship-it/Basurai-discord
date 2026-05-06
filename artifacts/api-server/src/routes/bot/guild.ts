import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  guildSettingsTable,
  guildCacheTable,
  reactionRolesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// GET guild cache (channels + roles)
router.get("/:guildId/cache", async (req, res) => {
  try {
    const { guildId } = req.params;
    const [cache] = await db.select().from(guildCacheTable).where(eq(guildCacheTable.guildId, guildId));
    if (!cache) {
      res.json({ guildId, channels: [], roles: [], guildName: "", guildIcon: null });
      return;
    }
    res.json(cache);
  } catch (err) {
    req.log.error({ err }, "Failed to get guild cache");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET guild settings
router.get("/:guildId/settings", async (req, res) => {
  try {
    const { guildId } = req.params;
    const [settings] = await db.select().from(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId));
    if (!settings) {
      res.json({
        guildId,
        welcomeEnabled: false,
        welcomeChannelId: null,
        welcomeMessage: "Sunucumuza hoş geldin, {user}! 🎉",
        autoRoleEnabled: false,
        autoRoleId: null,
      });
      return;
    }
    res.json(settings);
  } catch (err) {
    req.log.error({ err }, "Failed to get guild settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT guild settings (upsert)
router.put("/:guildId/settings", async (req, res) => {
  try {
    const { guildId } = req.params;
    const body = req.body;
    await db
      .insert(guildSettingsTable)
      .values({ guildId, ...body, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: guildSettingsTable.guildId,
        set: { ...body, updatedAt: new Date() },
      });
    const [updated] = await db.select().from(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId));
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update guild settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET reaction roles for guild
router.get("/:guildId/reaction-roles", async (req, res) => {
  try {
    const { guildId } = req.params;
    const roles = await db.select().from(reactionRolesTable).where(eq(reactionRolesTable.guildId, guildId));
    res.json(roles);
  } catch (err) {
    req.log.error({ err }, "Failed to get reaction roles");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST create reaction role (bot will pick it up and send the message)
router.post("/:guildId/reaction-roles", async (req, res) => {
  try {
    const { guildId } = req.params;
    const { channelId, messageContent, emoji, roleId, roleName } = req.body;
    const [inserted] = await db
      .insert(reactionRolesTable)
      .values({ guildId, channelId, messageContent, emoji, roleId, roleName: roleName || "" })
      .returning();
    res.json(inserted);
  } catch (err) {
    req.log.error({ err }, "Failed to create reaction role");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE reaction role
router.delete("/:guildId/reaction-roles/:id", async (req, res) => {
  try {
    const { guildId, id } = req.params;
    await db
      .delete(reactionRolesTable)
      .where(and(eq(reactionRolesTable.guildId, guildId), eq(reactionRolesTable.id, parseInt(id))));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete reaction role");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
