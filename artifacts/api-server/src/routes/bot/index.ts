import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { botLogsTable } from "@workspace/db";
import { GetBotStatsResponse, GetBotLogsQueryParams, GetBotLogsResponse, GetBotGuildsResponse } from "@workspace/api-zod";
import { desc, eq, count, sql, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  try {
    const [totalMessages] = await db.select({ count: count() }).from(botLogsTable);
    const [totalCommands] = await db
      .select({ count: count() })
      .from(botLogsTable)
      .where(sql`${botLogsTable.actionType} != 'chat'`);

    const guilds = await db
      .selectDistinct({ guildId: botLogsTable.guildId })
      .from(botLogsTable);

    const users = await db
      .selectDistinct({ userId: botLogsTable.userId })
      .from(botLogsTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayMessages] = await db
      .select({ count: count() })
      .from(botLogsTable)
      .where(sql`${botLogsTable.createdAt} >= ${today}`);

    const data = GetBotStatsResponse.parse({
      totalMessages: totalMessages?.count ?? 0,
      totalCommands: totalCommands?.count ?? 0,
      totalGuilds: guilds.length,
      totalUsers: users.length,
      todayMessages: todayMessages?.count ?? 0,
    });

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to get bot stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/logs", async (req, res) => {
  try {
    const query = GetBotLogsQueryParams.parse(req.query);
    const { page, limit, guildId, userId, actionType } = query;
    const offset = ((page ?? 1) - 1) * (limit ?? 50);

    const conditions = [];
    if (guildId) conditions.push(eq(botLogsTable.guildId, guildId));
    if (userId) conditions.push(eq(botLogsTable.userId, userId));
    if (actionType) conditions.push(eq(botLogsTable.actionType, actionType));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, [{ total }]] = await Promise.all([
      db
        .select()
        .from(botLogsTable)
        .where(whereClause)
        .orderBy(desc(botLogsTable.createdAt))
        .limit(limit ?? 50)
        .offset(offset),
      db.select({ total: count() }).from(botLogsTable).where(whereClause),
    ]);

    const data = GetBotLogsResponse.parse({
      logs: logs.map((l) => ({
        ...l,
        actionResult: l.actionResult ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
      total: total ?? 0,
      page: page ?? 1,
      limit: limit ?? 50,
    });

    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to get bot logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/guilds", async (req, res) => {
  try {
    const guilds = await db
      .select({
        guildId: botLogsTable.guildId,
        guildName: botLogsTable.guildName,
        messageCount: count(),
      })
      .from(botLogsTable)
      .groupBy(botLogsTable.guildId, botLogsTable.guildName)
      .orderBy(desc(count()));

    const data = GetBotGuildsResponse.parse(guilds);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to get bot guilds");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
