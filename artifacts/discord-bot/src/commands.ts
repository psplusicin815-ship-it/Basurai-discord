import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  AttachmentBuilder,
  Guild,
  GuildMember,
  TextChannel,
  ChannelType,
} from "discord.js";
import { enableAutomod, disableAutomod, getAutomodConfig } from "./automod.js";
import { generateImage } from "./image.js";
import { webSearch } from "./search.js";
import { summarizeSearchResults } from "./ai.js";
import { GoogleGenAI } from "@google/genai";
import { joinVoice, leaveVoice, isInVoice } from "./voice.js";
import {
  startNumberGame, guessNumber, getNumberGame, endNumberGame,
  startWordChain, playWordChain, getWordChain, endWordChain,
  generateTrivia, startTrivia, generateRoast, generateCompliment,
} from "./games.js";

const gemini = process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
    })
  : null;

async function generateJoke(): Promise<string> {
  if (gemini) {
    try {
      const res = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "Türkçe komik bir şaka söyle. Sadece şakayı yaz, başka bir şey ekleme. Kısa ve eğlenceli olsun." }] }],
      });
      const text = res.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch { /* fallback */ }
  }
  return JOKES[Math.floor(Math.random() * JOKES.length)];
}

const EIGHT_BALL_ANSWERS = [
  "Kesinlikle evet! ✅",
  "Görünüşe göre evet. 🟢",
  "Şüphesiz. 💯",
  "Bence evet. 👍",
  "Olasılıklar yüksek. 📈",
  "Tahmin edemiyorum, tekrar sor. 🔄",
  "Şu an cevap vermeyi tercih etmiyorum. 😶",
  "Sonra tekrar sor. ⏳",
  "Şu an bunu tahmin edemem. 🤷",
  "Düşünmeye devam et. 🤔",
  "Buna güvenme. ⚠️",
  "Cevabım hayır. ❌",
  "Kaynaklarım hayır diyor. 🔴",
  "Görünüşe göre iyi değil. 😬",
  "Çok şüpheliyim. 🙅",
];

const QUOTES = [
  { text: "Başarı, her gün tekrarlanan küçük çabaların toplamıdır.", author: "Robert Collier" },
  { text: "Hayal ettiğin yere ulaşman için önce uyumayı bırakman gerekir.", author: "Anonim" },
  { text: "Bugün zor gelen şey yarın normal olacak.", author: "Anonim" },
  { text: "En büyük risk, hiçbir risk almamaktır.", author: "Mark Zuckerberg" },
  { text: "Düşerken öğrenirsin, kalkarken kazanırsın.", author: "Anonim" },
  { text: "Bir hata yapmak insanı aptal yapmaz. Aynı hatayı tekrar yapmak yapar.", author: "Anonim" },
  { text: "Zorluklarla yüzleşmek seni güçlü kılar, onlardan kaçmak seni zayıf.", author: "Anonim" },
];

const JOKES = [
  "Bir programcı markete gider: \"2 ekmek al, eğer domates varsa 6 tane al.\" Domates varmış, programcı 6 ekmek almış. 😂",
  "Neden programcılar karanlıktan korkmaz? Çünkü her şeyi **açık kaynak**! 💡",
  "Hacker bakkala girmiş: \"Para üstü istemiyorum\" demiş. Bakkal: \"Neden?\" Hacker: \"Çünkü ben cache temizlerim!\" 😂",
  "Yazılımcıya sormuşlar: \"Evleniyor musun?\" Demiş ki: \"Hayır, hâlâ beta sürümündeyim.\" 🐛",
  "Neden Wi-Fi şifrelerini kimseyle paylaşmam? Çünkü bağlantı sorunlarım var. 📶",
  "İki bilgisayar mühendisi kavga etmiş. Biri diğerine: \"Sen hep integer birisin!\" Diğeri: \"Dur bir float'ım ben!\" 😤",
];

export const slashCommands = [
  new SlashCommandBuilder()
    .setName("zar")
    .setDescription("Zar at!")
    .addIntegerOption((opt) =>
      opt.setName("yüz").setDescription("Kaç yüzlü zar? (varsayılan: 6)").setMinValue(2).setMaxValue(100).setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("yazıtura")
    .setDescription("Yazı mı tura mı?"),

  new SlashCommandBuilder()
    .setName("8top")
    .setDescription("Sihirli 8 topa sor!")
    .addStringOption((opt) =>
      opt.setName("soru").setDescription("Sorunuzu yazın").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("şaka")
    .setDescription("Komik bir şaka söyle"),

  new SlashCommandBuilder()
    .setName("alıntı")
    .setDescription("İlham verici bir söz al"),

  new SlashCommandBuilder()
    .setName("çark")
    .setDescription("Rastgele bir üye seç (eğlence amaçlı)"),

  new SlashCommandBuilder()
    .setName("ship")
    .setDescription("İki kullanıcının uyumunu ölç!")
    .addUserOption((opt) => opt.setName("kişi1").setDescription("Birinci kişi").setRequired(true))
    .addUserOption((opt) => opt.setName("kişi2").setDescription("İkinci kişi").setRequired(true)),

  new SlashCommandBuilder()
    .setName("sunucubilgi")
    .setDescription("Sunucu hakkında bilgi al"),

  new SlashCommandBuilder()
    .setName("ara")
    .setDescription("İnternette ara")
    .addStringOption((opt) =>
      opt.setName("sorgu").setDescription("Ne aramak istiyorsun?").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("görsel")
    .setDescription("AI ile görsel oluştur")
    .addStringOption((opt) =>
      opt.setName("prompt").setDescription("Ne çizilsin? (Türkçe yazabilirsin)").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Kullanıcıyı sunucudan banla [YÖNETİCİ]")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => opt.setName("kullanıcı").setDescription("Banlanacak kullanıcı").setRequired(true))
    .addStringOption((opt) => opt.setName("sebep").setDescription("Ban sebebi").setRequired(false)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kullanıcıyı sunucudan at [YÖNETİCİ]")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) => opt.setName("kullanıcı").setDescription("Atılacak kullanıcı").setRequired(true))
    .addStringOption((opt) => opt.setName("sebep").setDescription("Kick sebebi").setRequired(false)),

  new SlashCommandBuilder()
    .setName("sustur")
    .setDescription("Kullanıcıyı sustur [YÖNETİCİ]")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName("kullanıcı").setDescription("Susturulacak kullanıcı").setRequired(true))
    .addStringOption((opt) => opt.setName("sebep").setDescription("Susturma sebebi").setRequired(false)),

  new SlashCommandBuilder()
    .setName("temizle")
    .setDescription("Kanaldan mesaj sil [YÖNETİCİ]")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt.setName("miktar").setDescription("Kaç mesaj silinsin? (maks 100)").setMinValue(1).setMaxValue(100).setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("duyuru")
    .setDescription("Duyuru kanalına mesaj gönder [YÖNETİCİ]")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt.setName("mesaj").setDescription("Duyuru içeriği").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Otomatik moderasyon sistemi [YÖNETİCİ]")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt.setName("işlem").setDescription("Aç veya kapat").setRequired(true).addChoices(
        { name: "Aç - Ban", value: "ac_ban" },
        { name: "Aç - Kick", value: "ac_kick" },
        { name: "Aç - Uyar", value: "ac_warn" },
        { name: "Aç - Mesaj Sil", value: "ac_delete" },
        { name: "Kapat", value: "kapat" },
        { name: "Durum", value: "durum" },
      )
    ),

  new SlashCommandBuilder()
    .setName("sesli-katıl")
    .setDescription("Ses kanalına katıl ve seninle konuş!")
    .addStringOption((opt) =>
      opt.setName("kanal").setDescription("Ses kanalının adı veya ID'si (örn: 1469819108878188783)").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("sesli-ayrıl")
    .setDescription("Ses kanalından ayrıl"),

  // ===== YENİ OYUNLAR =====
  new SlashCommandBuilder()
    .setName("tkm")
    .setDescription("Taş Kağıt Makas oyna! ✊✋✌️")
    .addStringOption((opt) =>
      opt.setName("seçim").setDescription("Seçimini yap").setRequired(true)
        .addChoices(
          { name: "✊ Taş", value: "taş" },
          { name: "✋ Kağıt", value: "kağıt" },
          { name: "✌️ Makas", value: "makas" },
        )
    ),

  new SlashCommandBuilder()
    .setName("sayı-tahmin")
    .setDescription("Sayı tahmin oyunu! Ben 1-100 arası bir sayı tutuyorum 🔢")
    .addIntegerOption((opt) =>
      opt.setName("min").setDescription("Alt sınır (varsayılan: 1)").setMinValue(1).setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt.setName("max").setDescription("Üst sınır (varsayılan: 100)").setMaxValue(10000).setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("kelime-zinciri")
    .setDescription("Kelime zinciri oyunu! 🔗 Sırayla kelime söyle, son harften devam et")
    .addStringOption((opt) =>
      opt.setName("başla").setDescription("Oyunu başlatmak için bir kelime yaz").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("trivia")
    .setDescription("Bilgi yarışması sorusu! 🧠")
    .addStringOption((opt) =>
      opt.setName("zorluk").setDescription("Zorluk seviyesi").setRequired(false)
        .addChoices(
          { name: "😊 Kolay", value: "kolay" },
          { name: "🤔 Orta", value: "orta" },
          { name: "🤯 Zor", value: "zor" },
        )
    ),

  // ===== EĞLENCE =====
  new SlashCommandBuilder()
    .setName("roast")
    .setDescription("Birini komik şekilde yak! 🔥")
    .addUserOption((opt) => opt.setName("kişi").setDescription("Kim yansın?").setRequired(true)),

  new SlashCommandBuilder()
    .setName("övgü")
    .setDescription("Birine güzel bir iltifat et! 💐")
    .addUserOption((opt) => opt.setName("kişi").setDescription("Kim iltifat alsın?").setRequired(true)),

  new SlashCommandBuilder()
    .setName("seç")
    .setDescription("Seçenekler arasından birini seç! 🎯")
    .addStringOption((opt) =>
      opt.setName("seçenekler").setDescription("Virgülle ayırarak yaz: elma, armut, muz").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ters")
    .setDescription("Metni tersine çevir! 🔄")
    .addStringOption((opt) =>
      opt.setName("metin").setDescription("Ters çevrilecek metin").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("caps")
    .setDescription("SpOnGeBoB mOdU! 🧽")
    .addStringOption((opt) =>
      opt.setName("metin").setDescription("Capslenecek metin").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("anket")
    .setDescription("Anket oluştur! 📊")
    .addStringOption((opt) =>
      opt.setName("soru").setDescription("Anket sorusu").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("seçenek1").setDescription("1. seçenek (varsayılan: Evet)").setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("seçenek2").setDescription("2. seçenek (varsayılan: Hayır)").setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("seçenek3").setDescription("3. seçenek (opsiyonel)").setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("seçenek4").setDescription("4. seçenek (opsiyonel)").setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("renk")
    .setDescription("Renk göster! 🎨")
    .addStringOption((opt) =>
      opt.setName("hex").setDescription("Renk kodu (örn: #FF5733 veya kırmızı/mavi/yeşil)").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("hesap")
    .setDescription("Hesap makinesi! 🔢")
    .addStringOption((opt) =>
      opt.setName("işlem").setDescription("Hesaplanacak işlem (örn: 2+2, 10*5, sqrt(144))").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("yardım")
    .setDescription("Tüm komutların listesi"),
].map((cmd) => cmd.toJSON());

export async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { commandName, guild, member } = interaction;
  if (!guild) return;

  const isAdmin = (member as GuildMember)?.permissions?.has(PermissionFlagsBits.Administrator) ?? false;

  try {
    switch (commandName) {
      case "zar": {
        const sides = interaction.options.getInteger("yüz") ?? 6;
        const result = Math.floor(Math.random() * sides) + 1;
        const embed = new EmbedBuilder()
          .setTitle("🎲 Zar Atıldı!")
          .setDescription(`**${sides}** yüzlü zar atıldı...\n\n# ${result}`)
          .setColor(Colors.Blue)
          .setFooter({ text: `${interaction.user.displayName} attı` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "yazıtura": {
        const result = Math.random() < 0.5 ? "👑 **YAZI**" : "🦅 **TURA**";
        const embed = new EmbedBuilder()
          .setTitle("🪙 Yazı Tura")
          .setDescription(`Para havaya fırlatıldı...\n\n# ${result}`)
          .setColor(Colors.Gold)
          .setFooter({ text: `${interaction.user.displayName} attı` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "8top": {
        const question = interaction.options.getString("soru", true);
        const answer = EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)];
        const embed = new EmbedBuilder()
          .setTitle("🎱 Sihirli 8 Top")
          .addFields(
            { name: "❓ Soru", value: question },
            { name: "🔮 Cevap", value: answer }
          )
          .setColor(Colors.DarkPurple)
          .setFooter({ text: `${interaction.user.displayName} sordu` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "şaka": {
        await interaction.deferReply();
        const joke = await generateJoke();
        const embed = new EmbedBuilder()
          .setTitle("😂 Günün Şakası")
          .setDescription(joke)
          .setColor(Colors.Yellow)
          .setFooter({ text: "BasurAi şaka yapar 😄" });
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "alıntı": {
        const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        const embed = new EmbedBuilder()
          .setTitle("✨ İlham Verici Söz")
          .setDescription(`*"${q.text}"*`)
          .setColor(Colors.DarkAqua)
          .setFooter({ text: `— ${q.author}` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "çark": {
        const members = guild.members.cache.filter(
          (m) => !m.user.bot && !m.permissions.has(PermissionFlagsBits.Administrator)
        );
        if (members.size === 0) {
          await interaction.reply({ content: "🎰 Hedef bulunamadı! (Admin olmayan üye yok)", ephemeral: true });
          break;
        }
        const target = members.random()!;
        const embed = new EmbedBuilder()
          .setTitle("🎰 Çark Çevir!")
          .setDescription(`Çark dönüyor...\n\n🎯 **${target.displayName}**'a denk geldi!\n\n*(Bu sadece eğlence, hiçbir şey yapılmadı)*`)
          .setColor(Colors.Red)
          .setThumbnail(target.user.displayAvatarURL())
          .setFooter({ text: `${interaction.user.displayName} çevirdi` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "ship": {
        const user1 = interaction.options.getUser("kişi1", true);
        const user2 = interaction.options.getUser("kişi2", true);
        const pct = Math.floor(Math.random() * 101);
        const filled = Math.floor(pct / 10);
        const bar = "❤️".repeat(filled) + "🖤".repeat(10 - filled);
        const comment =
          pct >= 90 ? "Mükemmel eşleşme! Evlenin zaten 💍" :
          pct >= 70 ? "Çok uyumlusunuz! 💕" :
          pct >= 50 ? "Fena değil, bir şansınız var. 🤔" :
          pct >= 30 ? "Biraz zorlanacaksınız... 😅" :
          "Bu iş olmaz, çok uyumsuz! 💔";
        const embed = new EmbedBuilder()
          .setTitle("💘 Ship Ölçer")
          .setDescription(
            `**${user1.displayName}** + **${user2.displayName}**\n\n${bar}\n\n**%${pct} uyumlu!**\n${comment}`
          )
          .setColor(pct >= 50 ? Colors.LuminousVividPink : Colors.DarkRed)
          .setFooter({ text: `${interaction.user.displayName} ölçtü` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "sunucubilgi": {
        await guild.members.fetch().catch(() => null);
        const owner = await guild.fetchOwner().catch(() => null);
        const textCh = guild.channels.cache.filter((c) => c.type === 0).size;
        const voiceCh = guild.channels.cache.filter((c) => c.type === 2).size;
        const embed = new EmbedBuilder()
          .setTitle(`📊 ${guild.name}`)
          .setThumbnail(guild.iconURL())
          .addFields(
            { name: "👑 Sahip", value: owner?.user.username ?? "Bilinmiyor", inline: true },
            { name: "👥 Üye", value: `${guild.memberCount}`, inline: true },
            { name: "📅 Oluşturulma", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
            { name: "💬 Metin Kanalı", value: `${textCh}`, inline: true },
            { name: "🔊 Ses Kanalı", value: `${voiceCh}`, inline: true },
            { name: "🎭 Rol Sayısı", value: `${guild.roles.cache.size - 1}`, inline: true },
          )
          .setColor(Colors.Blurple)
          .setFooter({ text: `ID: ${guild.id}` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "ara": {
        const query = interaction.options.getString("sorgu", true);
        await interaction.deferReply();
        try {
          const rawResults = await webSearch(query);
          const summary = await summarizeSearchResults(query, rawResults);
          const embed = new EmbedBuilder()
            .setTitle(`🌐 Arama: ${query}`)
            .setDescription(summary.substring(0, 4000))
            .setColor(Colors.Green)
            .setFooter({ text: "BasurAi Web Arama" });
          await interaction.editReply({ embeds: [embed] });
        } catch {
          await interaction.editReply("❌ Arama sırasında bir hata oluştu.");
        }
        break;
      }

      case "görsel": {
        const prompt = interaction.options.getString("prompt", true);
        await interaction.deferReply();
        try {
          const buffer = await generateImage(prompt);
          const attachment = new AttachmentBuilder(buffer, { name: "gorsel.png" });
          const embed = new EmbedBuilder()
            .setTitle("🎨 AI Görsel Oluşturuldu")
            .setDescription(`**Prompt:** ${prompt}`)
            .setImage("attachment://gorsel.png")
            .setColor(Colors.Purple)
            .setFooter({ text: `${interaction.user.displayName} istedi` });
          await interaction.editReply({ embeds: [embed], files: [attachment] });
        } catch {
          await interaction.editReply("❌ Görsel oluşturulamadı.");
        }
        break;
      }

      case "ban": {
        const target = interaction.options.getUser("kullanıcı", true);
        const reason = interaction.options.getString("sebep") ?? "Yönetici kararı";
        const memberTarget = guild.members.cache.get(target.id) ?? await guild.members.fetch(target.id).catch(() => null);
        if (!memberTarget) { await interaction.reply({ content: "❌ Kullanıcı bulunamadı.", ephemeral: true }); break; }
        if (!memberTarget.bannable) { await interaction.reply({ content: "❌ Bu kullanıcıyı banlayamam.", ephemeral: true }); break; }
        await memberTarget.ban({ reason });
        const embed = new EmbedBuilder()
          .setTitle("🔨 Kullanıcı Banlandı")
          .addFields(
            { name: "👤 Kullanıcı", value: target.username, inline: true },
            { name: "📝 Sebep", value: reason, inline: true },
            { name: "👮 Yapan", value: interaction.user.username, inline: true },
          )
          .setColor(Colors.Red)
          .setThumbnail(target.displayAvatarURL());
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "kick": {
        const target = interaction.options.getUser("kullanıcı", true);
        const reason = interaction.options.getString("sebep") ?? "Yönetici kararı";
        const memberTarget = guild.members.cache.get(target.id) ?? await guild.members.fetch(target.id).catch(() => null);
        if (!memberTarget) { await interaction.reply({ content: "❌ Kullanıcı bulunamadı.", ephemeral: true }); break; }
        if (!memberTarget.kickable) { await interaction.reply({ content: "❌ Bu kullanıcıyı atamam.", ephemeral: true }); break; }
        await memberTarget.kick(reason);
        const embed = new EmbedBuilder()
          .setTitle("👢 Kullanıcı Atıldı")
          .addFields(
            { name: "👤 Kullanıcı", value: target.username, inline: true },
            { name: "📝 Sebep", value: reason, inline: true },
            { name: "👮 Yapan", value: interaction.user.username, inline: true },
          )
          .setColor(Colors.Orange);
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "sustur": {
        const target = interaction.options.getUser("kullanıcı", true);
        const reason = interaction.options.getString("sebep") ?? "Yönetici kararı";
        const memberTarget = guild.members.cache.get(target.id) ?? await guild.members.fetch(target.id).catch(() => null);
        if (!memberTarget) { await interaction.reply({ content: "❌ Kullanıcı bulunamadı.", ephemeral: true }); break; }

        let muteRole = guild.roles.cache.find((r) => r.name === "Susturuldu");
        if (!muteRole) {
          muteRole = await guild.roles.create({ name: "Susturuldu", color: Colors.DarkGrey });
          for (const ch of guild.channels.cache.values()) {
            if (ch.type === 0) {
              await (ch as TextChannel).permissionOverwrites.create(muteRole!, { SendMessages: false }).catch(() => null);
            }
          }
        }
        await memberTarget.roles.add(muteRole, reason);
        await interaction.reply({ content: `🔇 **${target.username}** susturuldu. Sebep: ${reason}` });
        break;
      }

      case "temizle": {
        const amount = interaction.options.getInteger("miktar", true);
        const ch = interaction.channel as TextChannel;
        await ch.bulkDelete(amount, true);
        await interaction.reply({ content: `🗑️ **${amount}** mesaj silindi.`, ephemeral: true });
        break;
      }

      case "duyuru": {
        const msg = interaction.options.getString("mesaj", true);
        const announceChannel = guild.channels.cache.find(
          (c) => (c.type === 0 || c.type === 5) && (c.name.includes("duyur") || c.name.includes("annou"))
        ) as TextChannel | undefined ?? interaction.channel as TextChannel;
        const embed = new EmbedBuilder()
          .setTitle("📢 DUYURU")
          .setDescription(msg)
          .setColor(Colors.Gold)
          .setFooter({ text: `${interaction.user.displayName} tarafından` })
          .setTimestamp();
        await announceChannel.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Duyuru **#${announceChannel.name}** kanalına gönderildi.`, ephemeral: true });
        break;
      }

      case "automod": {
        const action = interaction.options.getString("işlem", true);
        if (action === "kapat") {
          disableAutomod(guild.id);
          await interaction.reply({ content: "🛡️ AutoMod **kapatıldı**.", ephemeral: false });
        } else if (action === "durum") {
          const config = getAutomodConfig(guild.id);
          if (!config?.enabled) {
            await interaction.reply({ content: "🛡️ AutoMod şu an **kapalı**.", ephemeral: false });
          } else {
            const embed = new EmbedBuilder()
              .setTitle("🛡️ AutoMod Durumu")
              .addFields(
                { name: "Durum", value: "✅ Aktif", inline: true },
                { name: "Eylem", value: config.action, inline: true },
                { name: "Kurallar", value: config.rules.join(", "), inline: false },
              )
              .setColor(Colors.Green);
            await interaction.reply({ embeds: [embed] });
          }
        } else {
          const modAction = action.replace("ac_", "") as "ban" | "kick" | "warn" | "delete";
          enableAutomod(guild.id, { action: modAction });
          const embed = new EmbedBuilder()
            .setTitle("🛡️ AutoMod Aktifleştirildi!")
            .addFields(
              { name: "⚡ Eylem", value: modAction === "ban" ? "🔨 Ban" : modAction === "kick" ? "👢 Kick" : modAction === "warn" ? "⚠️ Uyarı" : "🗑️ Mesaj Sil", inline: true },
              { name: "📋 Kurallar", value: "küfür, hakaret, ırkçılık, spam", inline: true },
            )
            .setColor(Colors.Green)
            .setFooter({ text: `${interaction.user.displayName} tarafından açıldı` });
          await interaction.reply({ embeds: [embed] });
        }
        break;
      }

      case "yardım": {
        const embed = new EmbedBuilder()
          .setTitle("🤖 BasurAi — Tüm Komutlar")
          .setColor(Colors.Blurple)
          .addFields(
            {
              name: "🎲 Klasik Eğlence",
              value: "`/zar` `/yazıtura` `/8top` `/şaka` `/alıntı` `/çark` `/ship`",
              inline: false,
            },
            {
              name: "🎮 Oyunlar",
              value: "`/tkm` — Taş Kağıt Makas\n`/sayı-tahmin` — Sayı tahmin (mesajla oyna!)\n`/kelime-zinciri` — Zincir oyunu (mesajla oyna!)\n`/trivia` — Bilgi yarışması",
              inline: false,
            },
            {
              name: "😂 Eğlenceli Araçlar",
              value: "`/roast [@kişi]` `/övgü [@kişi]` `/seç [seçenekler]`\n`/ters [metin]` `/caps [metin]` `/anket [soru]`\n`/renk [hex]` `/hesap [işlem]`",
              inline: false,
            },
            {
              name: "🔍 Bilgi & Araç",
              value: "`/sunucubilgi` `/ara [sorgu]` `/görsel [prompt]`",
              inline: false,
            },
            {
              name: "🔊 Sesli",
              value: "`/sesli-katıl [kanal]` `/sesli-ayrıl`\nBot girer, metin kanalında @mention'la → sesli cevap verir!",
              inline: false,
            },
            {
              name: "🛡️ Moderasyon (Admin)",
              value: "`/ban` `/kick` `/sustur` `/temizle` `/duyuru` `/automod`",
              inline: false,
            },
            {
              name: "💬 AI Doğal Dil",
              value: "Beni mention'la ve istediğini yaz!\n`@BasurAi kanal oluştur` · `@BasurAi sunucuyu kur`",
              inline: false,
            },
          )
          .setFooter({ text: "BasurAi • AZEPIX | Toplam 29 komut" })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "sesli-katıl": {
        const channelName = interaction.options.getString("kanal", true);
        await interaction.deferReply();
        const textChannel = interaction.channel as TextChannel;
        const result = await joinVoice(guild, channelName, textChannel);
        await interaction.editReply(result);
        break;
      }

      case "sesli-ayrıl": {
        await interaction.deferReply();
        const result = await leaveVoice(guild);
        await interaction.editReply(result);
        break;
      }

      // ===== OYUNLAR =====
      case "tkm": {
        const choices = ["taş", "kağıt", "makas"] as const;
        const emojis: Record<string, string> = { taş: "✊", kağıt: "✋", makas: "✌️" };
        const userChoice = interaction.options.getString("seçim", true) as "taş" | "kağıt" | "makas";
        const botChoice = choices[Math.floor(Math.random() * 3)];
        const wins: Record<string, string> = { taş: "makas", kağıt: "taş", makas: "kağıt" };
        const result =
          userChoice === botChoice
            ? "🤝 **Berabere!**"
            : wins[userChoice] === botChoice
            ? "🎉 **Sen kazandın!**"
            : "😈 **Ben kazandım!**";
        const embed = new EmbedBuilder()
          .setTitle("✊✋✌️ Taş Kağıt Makas")
          .addFields(
            { name: "Sen", value: `${emojis[userChoice]} ${userChoice}`, inline: true },
            { name: "Ben", value: `${emojis[botChoice]} ${botChoice}`, inline: true },
            { name: "Sonuç", value: result, inline: false },
          )
          .setColor(result.includes("kazandın") ? Colors.Green : result.includes("Ben") ? Colors.Red : Colors.Yellow)
          .setFooter({ text: `${interaction.user.displayName} oynadı` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "sayı-tahmin": {
        const min = interaction.options.getInteger("min") ?? 1;
        const max = interaction.options.getInteger("max") ?? 100;
        endNumberGame(interaction.channelId);
        const game = startNumberGame(interaction.channelId, interaction.user.id, min, max);
        const embed = new EmbedBuilder()
          .setTitle("🔢 Sayı Tahmin Oyunu Başladı!")
          .setDescription(
            `**${min}** ile **${max}** arasında bir sayı tuttum.\n` +
            `**${game.maxAttempts}** hakkın var!\n\n` +
            `Bu kanala sadece sayı yazarak tahmin et!\n` +
            `Oyunu bitirmek için \`dur\` yaz.`
          )
          .setColor(Colors.Blue)
          .setFooter({ text: `${interaction.user.displayName} oyunu başlattı` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "kelime-zinciri": {
        const startWord = interaction.options.getString("başla", true);
        if (startWord.length < 2) {
          await interaction.reply({ content: "❌ En az 2 harfli bir kelime gir!", ephemeral: true });
          break;
        }
        endWordChain(interaction.channelId);
        startWordChain(interaction.channelId, startWord);
        const lastLetter = [...startWord.toLowerCase().trim()].pop()!;
        const embed = new EmbedBuilder()
          .setTitle("🔗 Kelime Zinciri Başladı!")
          .setDescription(
            `İlk kelime: **${startWord}**\n\n` +
            `Sıradaki kelime **"${lastLetter}"** harfiyle başlamalı!\n` +
            `Daha önce kullanılan kelimeler geçersiz.\n` +
            `Oyunu bitirmek için \`bitir\` yaz.`
          )
          .setColor(Colors.Purple)
          .setFooter({ text: "Kelime → Son harf → Yeni kelime..." });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "trivia": {
        const difficulty = (interaction.options.getString("zorluk") ?? "orta") as "kolay" | "orta" | "zor";
        await interaction.deferReply();
        try {
          const data = await generateTrivia(difficulty);
          const game = startTrivia(interaction.channelId, interaction.user.id, data);
          const optionEmojis = ["🇦", "🇧", "🇨", "🇩"];
          const optionLines = data.options
            .map((opt, i) => `${optionEmojis[i]} ${opt}`)
            .join("\n");
          const embed = new EmbedBuilder()
            .setTitle("🧠 Trivia Zamanı!")
            .setDescription(`**${data.question}**\n\n${optionLines}`)
            .setColor(Colors.DarkAqua)
            .setFooter({ text: `Zorluk: ${difficulty} • Bu kanala harf yaz (A/B/C/D)` });
          const msg = await interaction.editReply({ embeds: [embed] });
          for (const emoji of optionEmojis.slice(0, data.options.length)) {
            await msg.react(emoji).catch(() => null);
          }
        } catch {
          await interaction.editReply("❌ Soru üretilemedi, tekrar dene.");
        }
        break;
      }

      case "roast": {
        const target = interaction.options.getUser("kişi", true);
        await interaction.deferReply();
        const roast = await generateRoast(target.displayName);
        const embed = new EmbedBuilder()
          .setTitle(`🔥 ${target.displayName} YANIYOR!`)
          .setDescription(roast)
          .setColor(Colors.Orange)
          .setThumbnail(target.displayAvatarURL())
          .setFooter({ text: `${interaction.user.displayName} tarafından ısmarlandı 😈` });
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "övgü": {
        const target = interaction.options.getUser("kişi", true);
        await interaction.deferReply();
        const compliment = await generateCompliment(target.displayName);
        const embed = new EmbedBuilder()
          .setTitle(`💐 ${target.displayName} için iltifat!`)
          .setDescription(compliment)
          .setColor(Colors.LuminousVividPink)
          .setThumbnail(target.displayAvatarURL())
          .setFooter({ text: `${interaction.user.displayName} tarafından gönderildi 💝` });
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case "seç": {
        const raw = interaction.options.getString("seçenekler", true);
        const options = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (options.length < 2) {
          await interaction.reply({ content: "❌ En az 2 seçenek gir! (virgülle ayır)", ephemeral: true });
          break;
        }
        const chosen = options[Math.floor(Math.random() * options.length)];
        const embed = new EmbedBuilder()
          .setTitle("🎯 Seçim Yapıldı!")
          .setDescription(
            `**Seçenekler:** ${options.join(" • ")}\n\n` +
            `🎲 Zar atılıyor...\n\n` +
            `# 👉 ${chosen}`
          )
          .setColor(Colors.Gold)
          .setFooter({ text: `${interaction.user.displayName} seçtirdi` });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "ters": {
        const metin = interaction.options.getString("metin", true);
        const reversed = [...metin].reverse().join("");
        const embed = new EmbedBuilder()
          .setTitle("🔄 Ters Çevirici")
          .addFields(
            { name: "Orijinal", value: metin, inline: false },
            { name: "Ters", value: reversed, inline: false },
          )
          .setColor(Colors.Fuchsia);
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "caps": {
        const metin = interaction.options.getString("metin", true);
        let toggle = true;
        const capsed = [...metin].map((c) => {
          if (/[a-zA-ZğüşöçıİĞÜŞÖÇ]/.test(c)) {
            const r = toggle ? c.toUpperCase() : c.toLowerCase();
            toggle = !toggle;
            return r;
          }
          return c;
        }).join("");
        const embed = new EmbedBuilder()
          .setTitle("🧽 SpOnGeBoB MoD!")
          .setDescription(`> ${capsed}`)
          .setColor(Colors.Yellow)
          .setFooter({ text: "mOcKiNg SpOnGeBoB" });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "anket": {
        const soru = interaction.options.getString("soru", true);
        const optionEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];
        const opts = [
          interaction.options.getString("seçenek1") ?? "✅ Evet",
          interaction.options.getString("seçenek2") ?? "❌ Hayır",
          interaction.options.getString("seçenek3"),
          interaction.options.getString("seçenek4"),
        ].filter(Boolean) as string[];
        const desc = opts.map((o, i) => `${optionEmojis[i]} ${o}`).join("\n");
        const embed = new EmbedBuilder()
          .setTitle("📊 ANKET")
          .setDescription(`**${soru}**\n\n${desc}`)
          .setColor(Colors.Blurple)
          .setFooter({ text: `${interaction.user.displayName} tarafından • Tepki ile oy ver!` })
          .setTimestamp();
        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        for (const emoji of optionEmojis.slice(0, opts.length)) {
          await msg.react(emoji).catch(() => null);
        }
        break;
      }

      case "renk": {
        const input = interaction.options.getString("hex", true).toLowerCase().trim();
        const namedColors: Record<string, string> = {
          kırmızı: "#FF0000", mavi: "#0000FF", yeşil: "#00FF00",
          sarı: "#FFFF00", turuncu: "#FF8C00", mor: "#8B00FF",
          pembe: "#FF69B4", beyaz: "#FFFFFF", siyah: "#000000",
          gri: "#808080", kahverengi: "#8B4513", turkuaz: "#00CED1",
        };
        const hex = namedColors[input] ?? (input.startsWith("#") ? input : `#${input}`);
        const match = hex.match(/^#?([0-9a-f]{6})$/i);
        if (!match) {
          await interaction.reply({ content: "❌ Geçersiz renk kodu! Örn: `#FF5733` veya `kırmızı`", ephemeral: true });
          break;
        }
        const colorInt = parseInt(match[1], 16);
        const r = (colorInt >> 16) & 0xff;
        const g = (colorInt >> 8) & 0xff;
        const b = colorInt & 0xff;
        const embed = new EmbedBuilder()
          .setTitle(`🎨 Renk: ${hex.toUpperCase()}`)
          .setDescription(`**HEX:** \`${hex.toUpperCase()}\`\n**RGB:** ${r}, ${g}, ${b}`)
          .setColor(colorInt)
          .setImage(`https://singlecolorimage.com/get/${match[1]}/300x100`)
          .setFooter({ text: "Renk Önizleme" });
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case "hesap": {
        const expr = interaction.options.getString("işlem", true);
        try {
          const safe = expr
            .replace(/[^0-9+\-*/().^%\s]/gi, "")
            .replace(/\^/g, "**");
          if (!safe.trim()) throw new Error("Geçersiz ifade");
          // eslint-disable-next-line no-new-func
          const result = Function(`"use strict"; return (${safe})`)();
          if (typeof result !== "number" || !isFinite(result)) throw new Error("Sonuç hesaplanamadı");
          const embed = new EmbedBuilder()
            .setTitle("🔢 Hesap Makinesi")
            .addFields(
              { name: "İşlem", value: `\`${expr}\``, inline: true },
              { name: "Sonuç", value: `**${result}**`, inline: true },
            )
            .setColor(Colors.Green);
          await interaction.reply({ embeds: [embed] });
        } catch {
          await interaction.reply({ content: `❌ Geçersiz işlem: \`${expr}\`\nÖrn: \`2+2\`, \`10*5\`, \`100/4\``, ephemeral: true });
        }
        break;
      }

      default:
        await interaction.reply({ content: "❓ Bilinmeyen komut.", ephemeral: true });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Slash komut hatası (${commandName}):`, msg);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(`❌ Hata: ${msg}`).catch(() => null);
    } else {
      await interaction.reply({ content: `❌ Hata: ${msg}`, ephemeral: true }).catch(() => null);
    }
  }
}
