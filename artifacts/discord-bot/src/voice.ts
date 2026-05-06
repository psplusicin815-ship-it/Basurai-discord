import {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  VoiceConnection,
  AudioPlayer,
} from "@discordjs/voice";
import { Guild, TextChannel } from "discord.js";
import { Readable } from "stream";
// @ts-ignore
import gTTS from "node-gtts";

interface VoiceSession {
  connection: VoiceConnection;
  player: AudioPlayer;
  textChannel?: TextChannel;
  playing: boolean;
  queue: string[];
}

const voiceSessions = new Map<string, VoiceSession>();

async function ttsToBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tts = new gTTS("tr");
    const chunks: Buffer[] = [];
    const stream: NodeJS.ReadableStream = tts.stream(text);
    stream.on("data", (chunk: unknown) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
    );
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function processQueue(guildId: string): Promise<void> {
  const session = voiceSessions.get(guildId);
  if (!session || session.playing || session.queue.length === 0) return;

  session.playing = true;
  const text = session.queue.shift()!;

  try {
    const mp3 = await ttsToBuffer(text);
    const resource = createAudioResource(Readable.from(mp3), {
      inputType: StreamType.Arbitrary,
    });

    session.player.play(resource);
    session.connection.subscribe(session.player);
  } catch (err) {
    console.error("TTS hatası:", err);
    session.playing = false;
    processQueue(guildId);
  }
}

export async function speakInVoice(guildId: string, text: string): Promise<void> {
  const session = voiceSessions.get(guildId);
  if (!session) return;

  // 200 karakterden uzunsa kısalt
  const trimmed = text.length > 200 ? text.substring(0, 200) + "..." : text;
  session.queue.push(trimmed);

  if (!session.playing) {
    await processQueue(guildId);
  }
}

export async function joinVoice(
  guild: Guild,
  channelNameOrId: string,
  textChannel?: TextChannel
): Promise<string> {
  const voiceChannel =
    guild.channels.cache.get(channelNameOrId) ??
    guild.channels.cache.find(
      (c) =>
        c.type === 2 &&
        c.name.toLowerCase().includes(channelNameOrId.toLowerCase().replace(/\s+/g, "-"))
    );

  if (!voiceChannel) return `❌ "${channelNameOrId}" ses kanalı bulunamadı.`;
  if (!voiceChannel.isVoiceBased()) return `❌ Bu bir ses kanalı değil.`;

  const old = getVoiceConnection(guild.id);
  if (old) old.destroy();
  voiceSessions.delete(guild.id);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  const player = createAudioPlayer();

  player.on(AudioPlayerStatus.Idle, () => {
    const s = voiceSessions.get(guild.id);
    if (!s) return;
    s.playing = false;
    if (s.queue.length > 0) processQueue(guild.id);
  });

  player.on("error", (err) => {
    console.error("Ses oynatıcı hatası:", err);
    const s = voiceSessions.get(guild.id);
    if (s) { s.playing = false; processQueue(guild.id); }
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    voiceSessions.delete(guild.id);
  });

  connection.on(VoiceConnectionStatus.Ready, () =>
    console.log(`✅ Ses kanalına bağlandı: ${voiceChannel.name}`)
  );

  const session: VoiceSession = {
    connection,
    player,
    textChannel,
    playing: false,
    queue: [],
  };

  voiceSessions.set(guild.id, session);

  // Selamlama
  setTimeout(() => {
    speakInVoice(
      guild.id,
      "Merhaba! Ses kanalına bağlandım. Bana bu kanalın metin bölümünden yazarak konuşabilirsin, cevabımı hem yazarak hem sesli olarak vereceğim."
    );
  }, 1500);

  return (
    `🔊 **${voiceChannel.name}** kanalına katıldım!\n\n` +
    `💡 **Nasıl konuşursun?**\n` +
    `Bu metin kanalına yaz → Bot hem yazılı hem **sesli** cevap verir!\n` +
    `Örn: \`@BasurAi nasılsın?\``
  );
}

export async function leaveVoice(guild: Guild): Promise<string> {
  const session = voiceSessions.get(guild.id);
  if (!session) return `❌ Şu an bir ses kanalında değilim.`;

  await speakInVoice(guild.id, "Görüşürüz!");

  setTimeout(() => {
    const s = voiceSessions.get(guild.id);
    if (s) { s.connection.destroy(); voiceSessions.delete(guild.id); }
  }, 2000);

  return `👋 Ses kanalından ayrılıyorum.`;
}

export function setVoiceTextChannel(guildId: string, channel: TextChannel): void {
  const s = voiceSessions.get(guildId);
  if (s) s.textChannel = channel;
}

export function isInVoice(guildId: string): boolean {
  return voiceSessions.has(guildId);
}
