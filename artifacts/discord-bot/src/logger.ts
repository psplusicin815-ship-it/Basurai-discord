import { db, botLogsTable } from "@workspace/db";

export async function logBotActivity(params: {
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  userId: string;
  username: string;
  messageContent: string;
  actionType: string;
  actionResult?: string;
}): Promise<void> {
  try {
    await db.insert(botLogsTable).values({
      guildId: params.guildId,
      guildName: params.guildName,
      channelId: params.channelId,
      channelName: params.channelName,
      userId: params.userId,
      username: params.username,
      messageContent: params.messageContent.slice(0, 2000),
      actionType: params.actionType,
      actionResult: params.actionResult?.slice(0, 2000),
    });
  } catch (err) {
    console.error("Log kaydedilemedi:", err);
  }
}
