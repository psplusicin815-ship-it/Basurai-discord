import {
  Client,
  GatewayIntentBits,
  Events,
  Message,
  PermissionFlagsBits,
  ActivityType,
  AttachmentBuilder,
  TextChannel,
  REST,
  Routes,
  ChatInputCommandInteraction,
  Interaction,
  EmbedBuilder,
  Colors,
} from "discord.js";
import { parseCommand, summarizeSearchResults, generateRefusalMessage } from "./ai.js";
import {
  downloadImage,
  analyzeImageWithGemini,
  removeImageBackground,
  isBackgroundRemovalRequest,
} from "./vision.js";
import { executeAction, executeImageAction } from "./actions.js";
import { logBotActivity } from "./logger.js";
import { webSearch } from "./search.js";
import { checkAutomod } from "./automod.js";
import { slashCommands, handleSlashCommand } from "./commands.js";
import { speakInVoice, isInVoice } from "./voice.js";
import {
  getNumberGame, guessNumber, endNumberGame,
  getWordChain, playWordChain, endWordChain,
  getTrivia, answerTrivia, endTrivia,
} from "./games.js";
import { handleMemberJoin } from "./events/welcome.js";
import { handleReactionAdd, handleReactionRemove, deployPendingReactionRoles } from "./events/reaction-roles.js";
import { syncGuildCache } from "./guild-sync.js";

if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN ortam değişkeni bulunamadı!");
}
if (!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL) {
  throw new Error("AI_INTEGRATIONS_GEMINI_BASE_URL ortam değişkeni bulunamadı!");
}

const CLIENT_ID = "1487520589722685551";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

function isAdministrator(message: Message): boolean {
  if (!message.member) return false;
  return message.member.permissions.has(PermissionFlagsBits.Administrator);
}

const PUBLIC_ACTIONS = new Set([
  "chat",
  "generate_image",
  "web_search",
  "server_info",
  "fun_8ball",
  "fun_coin",
  "fun_dice",
  "fun_joke",
  "fun_roulette",
  "fun_quote",
  "fun_ship",
  "vote_poll",
  "add_reaction",
]);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot hazır: ${readyClient.user.tag}`);
  readyClient.user.setActivity("Sunucuyu koruyorum 🛡️ | /yardım", { type: ActivityType.Watching });

  try {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
    console.log(`✅ ${slashCommands.length} slash komut kaydedildi.`);
  } catch (err) {
    console.error("Slash komut kayıt hatası:", err);
  }

  // Guild önbelleğini senkronize et
  setTimeout(() => {
    syncGuildCache(readyClient).catch(console.error);
    deployPendingReactionRoles(readyClient).catch(console.error);
  }, 3000);
});

// Yeni üye katıldığında
client.on(Events.GuildMemberAdd, async (member) => {
  handleMemberJoin(member).catch((err) => console.error("GuildMemberAdd hatası:", err));
});

// Reaction eklendi
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  handleReactionAdd(reaction, user).catch((err) => console.error("ReactionAdd hatası:", err));
});

// Reaction kaldırıldı
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  handleReactionRemove(reaction, user).catch((err) => console.error("ReactionRemove hatası:", err));
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await handleSlashCommand(interaction as ChatInputCommandInteraction);
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const isTextChannel = message.channel.type === 0 || message.channel.type === 5;

  if (message.member && isTextChannel) {
    const textChannel = message.channel as TextChannel;
    checkAutomod(
      message.guild,
      message.member,
      message.content,
      textChannel,
      () => message.delete().catch(() => Promise.resolve())
    ).catch((err) => console.error("AutoMod hatası:", err));
  }

  // ===== OYUN MESAJ YÖNETİMİ =====
  const rawMsg = message.content.trim();

  // Sayı tahmin oyunu
  const numGame = getNumberGame(message.channelId);
  if (numGame) {
    if (rawMsg.toLowerCase() === "dur") {
      endNumberGame(message.channelId);
      await message.reply(`🛑 Oyun bitti! Tuttuğum sayı **${numGame.target}** idi.`);
      return;
    }
    const guess = parseInt(rawMsg, 10);
    if (!isNaN(guess) && rawMsg.match(/^\d+$/)) {
      const res = guessNumber(message.channelId, guess);
      if (res.result === "correct") {
        const embed = new EmbedBuilder()
          .setTitle("🎉 Doğru Tahmin!")
          .setDescription(`**${guess}** tuttuğum sayıydı! ${res.attempts} denemede buldun! 🏆`)
          .setColor(Colors.Green)
          .setFooter({ text: `${message.author.displayName} kazandı!` });
        await message.reply({ embeds: [embed] });
      } else if (res.result === "lose") {
        const embed = new EmbedBuilder()
          .setTitle("💀 Oyun Bitti!")
          .setDescription(`Hakkın doldu! Tuttuğum sayı **${res.target}** idi.`)
          .setColor(Colors.Red);
        await message.reply({ embeds: [embed] });
      } else if (res.result === "low") {
        await message.reply(`📈 **${guess}** çok küçük! (${res.remaining} hakkın var)`);
      } else if (res.result === "high") {
        await message.reply(`📉 **${guess}** çok büyük! (${res.remaining} hakkın var)`);
      }
      return;
    }
  }

  // Kelime zinciri oyunu
  const wordGame = getWordChain(message.channelId);
  if (wordGame && !rawMsg.startsWith("/") && !rawMsg.includes("<@")) {
    if (rawMsg.toLowerCase() === "bitir") {
      const streak = wordGame.streak;
      endWordChain(message.channelId);
      await message.reply(`🔗 Oyun bitti! Toplam **${streak}** kelime söylendi! 🎉`);
      return;
    }
    if (/^[a-zğüşöçıA-ZĞÜŞÖÇİ]+$/i.test(rawMsg)) {
      const res = playWordChain(message.channelId, rawMsg, message.author.id);
      if (res.result === "ok") {
        const lastChar = [...(res.lastWord || "")].pop()!;
        await message.react("✅").catch(() => null);
        await message.reply(
          `✅ **${res.lastWord}** — Zincir: **${res.streak}** 🔗\nSıradaki kelime **"${lastChar}"** harfiyle başlamalı!`
        );
      } else if (res.result === "wrong_letter") {
        await message.react("❌").catch(() => null);
        await message.reply(
          `❌ Kelimen **"${res.expectedLetter}"** harfiyle başlamalıydı! ` +
          `Son kelime: **${res.lastWord}**`
        );
      } else if (res.result === "already_used") {
        await message.react("♻️").catch(() => null);
        await message.reply(`♻️ **${rawMsg}** daha önce kullanıldı! Başka bir kelime dene.`);
      }
      return;
    }
  }

  // Trivia oyunu
  const triviaGame = getTrivia(message.channelId);
  if (triviaGame && /^[abcdABCD]$/.test(rawMsg)) {
    const res = answerTrivia(message.channelId, rawMsg);
    if (res) {
      const optionLetters = ["A", "B", "C", "D"];
      const correctIdx = triviaGame.options.indexOf(res.answer);
      const correctLetter = optionLetters[correctIdx] ?? "?";
      if (res.correct) {
        await message.reply(`✅ **Doğru!** Cevap **${correctLetter}) ${res.answer}** 🎉`);
      } else {
        await message.reply(`❌ **Yanlış!** Doğru cevap **${correctLetter}) ${res.answer}**`);
      }
      return;
    }
  }
  if (triviaGame && rawMsg.toLowerCase() === "bitir") {
    endTrivia(message.channelId);
    await message.reply("🛑 Trivia oyunu bitti!");
    return;
  }

  // ===== BOT MENTION KONTROLÜ =====
  const botMentioned =
    message.mentions.has(client.user!.id) ||
    message.content.includes(`<@${client.user!.id}>`);

  if (!botMentioned) return;

  const content = message.content
    .replace(new RegExp(`<@!?${client.user!.id}>`, "g"), "")
    .trim();

  // ===== RESİM İŞLEME =====
  const imageAttachments = [...message.attachments.values()].filter(
    (a) =>
      a.contentType?.startsWith("image/") ||
      /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name || "")
  );

  if (imageAttachments.length > 0) {
    const imgTextChannel = message.channel as TextChannel;
    await imgTextChannel.sendTyping();
    const imgChannelName =
      message.channel.type === 0 ? imgTextChannel.name : "bilinmiyor";

    // Typing göstergesini canlı tut (uzun işlemler için)
    const typingInterval = setInterval(() => {
      imgTextChannel.sendTyping().catch(() => null);
    }, 8000);

    try {
      if (isBackgroundRemovalRequest(content)) {
        // Arka plan silme
        const processingMsg = await message.reply(
          "🎨 Arka plan siliniyor... Model yükleniyor, **ilk seferde 30-60 saniye** sürebilir."
        );
        const resultBuffer = await removeImageBackground(imageAttachments[0].url);
        const attachment = new AttachmentBuilder(resultBuffer, { name: "arka_plan_silindi.png" });
        await processingMsg.edit("✅ Arka plan başarıyla silindi!");
        await imgTextChannel.send({ files: [attachment] });
      } else {
        // Görsel analizi
        const imageDataList = await Promise.all(
          imageAttachments.slice(0, 4).map((a) => downloadImage(a.url))
        );
        const imagePrompt =
          content ||
          "Bu görseli detaylıca anlat. Ne görüyorsun? Nesne, renk, mekan, yazı — her detayı Türkçe olarak açıkla.";
        const analysis = await analyzeImageWithGemini(imageDataList, imagePrompt);
        for (const part of analysis.match(/.{1,1990}/gs) || [analysis]) {
          await message.reply(part);
        }
        await logBotActivity({
          guildId: message.guild.id,
          guildName: message.guild.name,
          channelId: message.channelId,
          channelName: imgChannelName,
          userId: message.author.id,
          username: message.author.username,
          messageContent: content || "[resim]",
          actionType: "image_analysis",
          actionResult: `${imageAttachments.length} görsel analiz edildi`,
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Görsel işleme hatası:", errorMessage);
      await message.reply(`❌ Görsel işlenirken hata oluştu: ${errorMessage.slice(0, 200)}`);
    } finally {
      clearInterval(typingInterval);
    }
    return;
  }

  if (!content) {
    await message.reply(
      "Merhaba! 👋 Slash komutlarım için `/yardım` yaz!\n\n" +
      "Ya da beni mention'la ve ne istediğini söyle:\n" +
      "`@BasurAi kanal oluştur` • `@BasurAi sunucuyu kur` • `@BasurAi küfür edenleri banla`"
    );
    return;
  }

  const channelMentionResolved = content.replace(/<#(\d+)>/g, (_, channelId) => {
    const ch = message.guild!.channels.cache.get(channelId);
    return ch ? `#${ch.name} [kanalId:${channelId}]` : `[kanalId:${channelId}]`;
  });

  const fullyResolved = channelMentionResolved.replace(/<@!?(\d+)>/g, (_, userId) => {
    const member = message.guild!.members.cache.get(userId);
    return member ? `@${member.displayName} [userId:${userId}]` : `[userId:${userId}]`;
  });

  try {
    await message.channel.sendTyping();

    const currentTime = new Date().toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const action = await parseCommand(
      fullyResolved,
      message.author.id,
      message.author.displayName || message.author.username,
      currentTime
    );

    const channelName =
      message.channel.type === 0 ? (message.channel as TextChannel).name : "bilinmiyor";

    if (action.type === "web_search") {
      await message.reply(`🌐 ${action.reply}`);
      try {
        const rawResults = await webSearch(action.query);
        const summary = await summarizeSearchResults(action.query, rawResults);
        for (const part of summary.match(/.{1,1990}/gs) || [summary]) {
          await message.channel.send(part);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await message.channel.send(`❌ Arama hatası: ${msg}`);
      }
      await logBotActivity({
        guildId: message.guild.id, guildName: message.guild.name,
        channelId: message.channelId, channelName, userId: message.author.id,
        username: message.author.username, messageContent: fullyResolved,
        actionType: "web_search", actionResult: `Sorgu: ${action.query}`,
      });
      return;
    }

    if (action.type === "generate_image") {
      await message.reply(`🎨 ${action.reply}`);
      const imageResult = await executeImageAction(action.prompt, action.reply);
      if (imageResult.kind === "image") {
        const attachment = new AttachmentBuilder(imageResult.buffer, { name: "gorsel.png" });
        await message.channel.send({ files: [attachment] });
      } else {
        await message.reply(imageResult.content);
      }
      await logBotActivity({
        guildId: message.guild.id, guildName: message.guild.name,
        channelId: message.channelId, channelName, userId: message.author.id,
        username: message.author.username, messageContent: fullyResolved,
        actionType: "generate_image", actionResult: action.reply,
      });
      return;
    }

    const allActionsPublic =
      action.type === "sequence"
        ? action.actions.every((a) => PUBLIC_ACTIONS.has(a.type))
        : PUBLIC_ACTIONS.has(action.type);

    if (!allActionsPublic && !isAdministrator(message)) {
      const restrictedType =
        action.type === "sequence"
          ? (action.actions.find((a) => !PUBLIC_ACTIONS.has(a.type))?.type ?? "sequence")
          : action.type;
      const refusal = await generateRefusalMessage(
        restrictedType,
        message.author.displayName || message.author.username
      );
      await message.reply(refusal);
      return;
    }

    if (action.type === "sequence") {
      await message.reply(`⚙️ ${action.reply || `${action.actions.length} adımlı komut işleniyor...`}`);
    }

    const textCh = message.channel.type === 0 ? (message.channel as TextChannel) : undefined;
    const result = await executeAction(action, message.guild, message.member!, message.channelId, textCh);

    await logBotActivity({
      guildId: message.guild.id, guildName: message.guild.name,
      channelId: message.channelId, channelName, userId: message.author.id,
      username: message.author.username, messageContent: fullyResolved,
      actionType: action.type, actionResult: result,
    });

    for (const part of result.match(/.{1,1990}/gs) || [result]) {
      await message.reply(part);
    }

    // Bot ses kanalındaysa cevabı sesli de söyle
    if (isInVoice(message.guild.id) && action.type === "chat") {
      speakInVoice(message.guild.id, result).catch(() => null);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Hata:", errorMessage);
    await message.reply(`❌ Bir hata oluştu: ${errorMessage}`);
  }
});

client.on(Events.Error, (err) => {
  console.error("Discord client hatası:", err);
});

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("Giriş yapılamadı:", err);
  process.exit(1);
});
