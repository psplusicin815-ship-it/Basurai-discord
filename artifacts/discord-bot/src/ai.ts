import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const MODEL = "gemini-2.5-flash";

async function chatWithFallback(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const systemMsg = messages.find((m) => m.role === "system");
  const conversationMsgs = messages.filter((m) => m.role !== "system");

  const contents = conversationMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: systemMsg?.content,
      maxOutputTokens: maxTokens,
      temperature,
    },
  });

  return response.text ?? "";
}

export type SingleAction =
  | { type: "chat"; reply: string }
  // --- Kullanıcı yönetimi ---
  | { type: "ban"; userId: string; reason?: string; reply: string }
  | { type: "kick"; userId: string; reason?: string; reply: string }
  | { type: "mute"; userId: string; reason?: string; reply: string }
  | { type: "unmute"; userId: string; reply: string }
  | { type: "nick"; userId: string; newNick: string; reply: string }
  // --- Kanal yönetimi ---
  | { type: "create_channel"; name: string; channelType: "text" | "voice"; categoryName?: string; reply: string }
  | { type: "delete_channel"; name: string; reply: string }
  | { type: "delete_all_channels"; reply: string }
  | { type: "rename_channel"; oldName: string; newName: string; reply: string }
  | { type: "lock_channel"; name: string; reply: string }
  | { type: "unlock_channel"; name: string; reply: string }
  | { type: "slowmode"; channelName: string; seconds: number; reply: string }
  | { type: "create_category"; name: string; reply: string }
  // --- Rol yönetimi ---
  | { type: "create_role"; name: string; color?: string; reply: string }
  | { type: "delete_role"; name: string; reply: string }
  | { type: "delete_all_roles"; reply: string }
  | { type: "rename_role"; oldName: string; newName: string; reply: string }
  | { type: "assign_role"; userId: string; roleName: string; reply: string }
  | { type: "remove_role"; userId: string; roleName: string; reply: string }
  // --- Mesaj yönetimi ---
  | { type: "clear_messages"; amount: number; reply: string }
  | { type: "announce"; content: string; channelName?: string; reply: string }
  | { type: "send_message"; channelName: string; channelId?: string; content: string; reply: string }
  | { type: "add_reaction"; channelName: string; emoji: string; reply: string }
  | { type: "vote_poll"; channelName: string; reply: string }
  // --- Sunucu yönetimi ---
  | { type: "rename_server"; newName: string; reply: string }
  | { type: "server_info"; reply: string }
  | {
      type: "setup_server";
      categories: Array<{
        name: string;
        channels: Array<{ name: string; channelType: "text" | "voice" }>;
      }>;
      roles: Array<{
        name: string;
        color?: string;
        hoist?: boolean;
        isAdmin?: boolean;
      }>;
      reply: string;
    }
  | { type: "setup_gaming_server"; reply: string }
  // --- Etkinlik ---
  | { type: "create_event"; name: string; description?: string; startTime: string; channelName: string; reply: string }
  // --- AutoMod ---
  | { type: "automod_enable"; action: "ban" | "kick" | "warn" | "delete"; rules?: string[]; reply: string }
  | { type: "automod_disable"; reply: string }
  | { type: "automod_status"; reply: string }
  // --- Ses kanalı ---
  | { type: "join_voice"; channelName: string; reply: string }
  | { type: "leave_voice"; reply: string }
  // --- Eğlence ---
  | { type: "fun_8ball"; question: string; reply: string }
  | { type: "fun_coin"; reply: string }
  | { type: "fun_dice"; sides?: number; reply: string }
  | { type: "fun_joke"; reply: string }
  | { type: "fun_roulette"; reply: string }
  | { type: "fun_quote"; reply: string }
  | { type: "fun_ship"; user1: string; user2: string; reply: string }
  // --- Herkese açık ---
  | { type: "generate_image"; prompt: string; reply: string }
  | { type: "web_search"; query: string; reply: string };

export type DiscordAction =
  | SingleAction
  | { type: "sequence"; actions: SingleAction[]; reply: string };

const SYSTEM_PROMPT = `Sen "BasurAi" adlı bir Discord sunucu yönetim yapay zekasısın. Türkçe konuşuyorsun.

Kullanıcının mesajını analiz et. Uygun JSON formatını döndür.

ÇOK ADIMLI KOMUTLAR İÇİN SEQUENCE KULLAN:
Birden fazla işlem gerektiren komutlar için (örn: "kategori oluştur, kanal oluştur, mesaj gönder"):
{"type":"sequence","reply":"<genel mesaj>","actions":[{...aksiyon1...},{...aksiyon2...},{...aksiyon3...}]}

=== KULLANICI YÖNETİMİ ===
- Banlama: {"type":"ban","userId":"<id>","reason":"<sebep>","reply":"<mesaj>"}
- Atma (kick): {"type":"kick","userId":"<id>","reason":"<sebep>","reply":"<mesaj>"}
- Susturma: {"type":"mute","userId":"<id>","reason":"<sebep>","reply":"<mesaj>"}
- Susturmayı kaldır: {"type":"unmute","userId":"<id>","reply":"<mesaj>"}
- Nickname değiştir: {"type":"nick","userId":"<id>","newNick":"<yeni isim>","reply":"<mesaj>"}

=== KANAL YÖNETİMİ ===
- Metin kanalı oluştur: {"type":"create_channel","name":"<kanal-adı>","channelType":"text","categoryName":"<kategori veya boş>","reply":"<mesaj>"}
- Ses kanalı oluştur: {"type":"create_channel","name":"<kanal-adı>","channelType":"voice","categoryName":"<kategori>","reply":"<mesaj>"}
- Kanal sil: {"type":"delete_channel","name":"<kanal-adı>","reply":"<mesaj>"}
- TÜM kanalları sil: {"type":"delete_all_channels","reply":"<mesaj>"}
- Kanal adını değiştir: {"type":"rename_channel","oldName":"<eski ad>","newName":"<yeni ad>","reply":"<mesaj>"}
- Kanalı kilitle: {"type":"lock_channel","name":"<kanal-adı>","reply":"<mesaj>"}
- Kanal kilidini aç: {"type":"unlock_channel","name":"<kanal-adı>","reply":"<mesaj>"}
- Yavaş mod: {"type":"slowmode","channelName":"<kanal-adı>","seconds":<saniye>,"reply":"<mesaj>"}
- Kategori oluştur: {"type":"create_category","name":"<kategori adı>","reply":"<mesaj>"}

=== ROL YÖNETİMİ ===
- Rol oluştur: {"type":"create_role","name":"<rol adı>","color":"<#HEX>","reply":"<mesaj>"}
- Rol sil: {"type":"delete_role","name":"<rol adı>","reply":"<mesaj>"}
- TÜM rolleri sil: {"type":"delete_all_roles","reply":"<mesaj>"}
- Rol adını değiştir: {"type":"rename_role","oldName":"<eski ad>","newName":"<yeni ad>","reply":"<mesaj>"}
- Kullanıcıya rol ver: {"type":"assign_role","userId":"<id>","roleName":"<rol adı>","reply":"<mesaj>"}
- Kullanıcıdan rol al: {"type":"remove_role","userId":"<id>","roleName":"<rol adı>","reply":"<mesaj>"}

=== MESAJ YÖNETİMİ ===
- Mesaj temizle: {"type":"clear_messages","amount":<miktar>,"reply":"<mesaj>"}
- Duyuru yap: {"type":"announce","content":"<içerik>","channelName":"<kanal adı veya boş>","reply":"<onay mesajı>"}
- Kanala mesaj gönder: {"type":"send_message","channelName":"<kanal-adı>","channelId":"<id varsa>","content":"<içerik>","reply":"<onay mesajı>"}
- Mesaja tepki ekle / ankete oy ver: {"type":"add_reaction","channelName":"<kanal-adı>","emoji":"<emoji>","reply":"<mesaj>"}
- Ankette en iyi seçeneğe oy ver: {"type":"vote_poll","channelName":"<kanal-adı>","reply":"<mesaj>"}

=== SUNUCU YÖNETİMİ ===
- Sunucu adını değiştir: {"type":"rename_server","newName":"<yeni isim>","reply":"<mesaj>"}
- Sunucu bilgisi: {"type":"server_info","reply":""}
- Etkinlik oluştur: {"type":"create_event","name":"<etkinlik>","description":"<açıklama>","startTime":"<ISO 8601>","channelName":"<ses kanalı>","reply":"<mesaj>"}

=== SUNUCU KURULUMU ===
- Özel yapıyla kur: {"type":"setup_server","categories":[{"name":"📋 BİLGİ","channels":[{"name":"kurallar","channelType":"text"}]}],"roles":[{"name":"👑 Kurucu","color":"#FFD700","hoist":true,"isAdmin":true}],"reply":"<mesaj>"}

Minecraft sunucusu için şablonu kullan:
{"type":"setup_server","categories":[{"name":"📋 BİLGİ","channels":[{"name":"📜kurallar","channelType":"text"},{"name":"📣duyurular","channelType":"text"},{"name":"ℹ️sunucu-bilgisi","channelType":"text"}]},{"name":"💬 GENEL","channels":[{"name":"💬genel-sohbet","channelType":"text"},{"name":"📸medya","channelType":"text"},{"name":"🤖bot-komutları","channelType":"text"}]},{"name":"🎮 MİNECRAFT","channels":[{"name":"📣mc-duyurular","channelType":"text"},{"name":"💬mc-sohbet","channelType":"text"},{"name":"📝whitelist-basvuru","channelType":"text"},{"name":"🐛bug-bildir","channelType":"text"},{"name":"💡öneriler","channelType":"text"},{"name":"🎉etkinlikler","channelType":"text"}]},{"name":"🆘 DESTEK","channels":[{"name":"🎫ticket-destek","channelType":"text"},{"name":"❓sss","channelType":"text"}]},{"name":"🔊 SES","channels":[{"name":"🔊genel-ses","channelType":"voice"},{"name":"🎮oyun-odası-1","channelType":"voice"},{"name":"🎮oyun-odası-2","channelType":"voice"},{"name":"🎵afk","channelType":"voice"}]}],"roles":[{"name":"👑 Kurucu","color":"#FFD700","hoist":true,"isAdmin":true},{"name":"⚙️ Admin","color":"#E74C3C","hoist":true,"isAdmin":true},{"name":"🛡️ Moderatör","color":"#3498DB","hoist":true},{"name":"🎫 Destek","color":"#1ABC9C","hoist":true},{"name":"🏗️ Builder","color":"#2ECC71","hoist":true},{"name":"💎 VIP","color":"#9B59B6","hoist":true},{"name":"⛏️ Üye","color":"#95A5A6","hoist":true},{"name":"🤖 Bot","color":"#7F8C8D","hoist":false}],"reply":"⛏️ Minecraft sunucusu Discord düzeni kuruluyor!"}

=== AUTO-MOD (OTOMATİK DENETLEME) ===
- Küfür/kural ihlali otomatik yakala ve banla/at/uyar: {"type":"automod_enable","action":"ban","rules":["küfür","hakaret","spam"],"reply":"<mesaj>"}
  (action: "ban" | "kick" | "warn" | "delete")
- Otomatik denetlemeyi kapat: {"type":"automod_disable","reply":"<mesaj>"}
- Otomatik denetleme durumu: {"type":"automod_status","reply":""}

=== SES KANALI ===
- Ses kanalına katıl: {"type":"join_voice","channelName":"<kanal adı veya ID>","reply":"<mesaj>"}
- Ses kanalından çık: {"type":"leave_voice","reply":"<mesaj>"}

=== EĞLENCE KOMUTLARI (herkese açık) ===
- Sihirli 8 top: {"type":"fun_8ball","question":"<soru>","reply":"<mesaj>"}
- Yazı tura: {"type":"fun_coin","reply":"<mesaj>"}
- Zar at: {"type":"fun_dice","sides":6,"reply":"<mesaj>"}
- Şaka söyle: {"type":"fun_joke","reply":"<mesaj>"}
- Çark çevir (random kick): {"type":"fun_roulette","reply":"<mesaj>"}
- İlham verici söz: {"type":"fun_quote","reply":"<mesaj>"}
- İki kişiyi eşleştir: {"type":"fun_ship","user1":"<kullanıcı1>","user2":"<kullanıcı2>","reply":"<mesaj>"}

=== HERKESE AÇIK ===
- Görsel oluştur: {"type":"generate_image","prompt":"<İngilizce detaylı prompt>","reply":"<mesaj>"}
- İnternette ara: {"type":"web_search","query":"<arama sorgusu>","reply":"<mesaj>"}

=== SADECE SOHBET ===
{"type":"chat","reply":"<Türkçe cevabın>"}

ÖNEMLİ KURALLAR:
- SADECE JSON döndür, başka hiçbir şey yazma.
- Birden fazla adım gerektiren komutlarda MUTLAKA "sequence" kullan! Ayrı JSON'lar yazma, tek sequence JSON'u içine al.
- Kullanıcı ID'leri: @KullanıcıAdı [userId:123456789] → userId'yi al.
- Kanal mention'ları: #kanal-adı [kanalId:123456789] → ikisini de kullan.
- Kanal adlarında küçük harf ve tire kullan (ör: genel-sohbet).
- "Tüm kanalları sil" → delete_all_channels. "Tüm rolleri sil" → delete_all_roles.
- Görsel için prompt İngilizce ve detaylı olmalı.
- İnternette araştırma için web_search kullan.
- Sunucu kurulumu için MUTLAKA setup_server kullan.
- Rol renkleri: kurucu=#FFD700, admin=#E74C3C, moderatör=#3498DB, destek=#1ABC9C, builder=#2ECC71, vip=#9B59B6, üye=#95A5A6, bot=#7F8C8D.
- Saatleri doğru yorumla, ISO 8601 formatı kullan.
- "Küfür edenleri banla", "spam yapanları at" vb. → automod_enable kullan.
- "Ankete oy ver", "en mantıklı seçeneği seç" → vote_poll kullan.
- Fun komutlar herkes tarafından kullanılabilir (eğlence amaçlı).
- Kullanıcı bir sayı dizisi (örn: 1469819108878188783) vererek ses kanalı belirtiyorsa, bunu join_voice içinde channelName olarak aynen kullan.
- Ses kanalı ID'si verilirse: {"type":"join_voice","channelName":"1469819108878188783","reply":"..."}`;

const conversationHistory: Map<string, Array<{ role: "user" | "assistant"; content: string }>> = new Map();

export async function parseCommand(
  message: string,
  userId: string,
  username: string,
  currentTime: string
): Promise<DiscordAction> {
  const history = conversationHistory.get(userId) || [];

  const userMessage = `[${currentTime}] ${username}: ${message}`;
  history.push({ role: "user", content: userMessage });
  if (history.length > 20) history.splice(0, history.length - 20);
  conversationHistory.set(userId, history);

  let content: string;
  try {
    content = await chatWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      8192,
      0.2
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: "chat", reply: `⚠️ **BasurAi hata aldı:** ${msg.slice(0, 200)}` };
  }
  history.push({ role: "assistant", content });

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as DiscordAction;

      if (parsed.type !== "sequence") {
        const allMatches = [...content.matchAll(/(\{[\s\S]*?\})(?=\s*\n*\s*\{|\s*$)/g)];
        if (allMatches.length > 1) {
          const actions: SingleAction[] = [];
          for (const m of allMatches) {
            try {
              const a = JSON.parse(m[1]) as SingleAction;
              if (a.type) actions.push(a);
            } catch { /* skip */ }
          }
          if (actions.length > 1) {
            return {
              type: "sequence",
              reply: `✅ ${actions.length} adımlı komut çalışıyor...`,
              actions,
            };
          }
        }
      }

      return parsed;
    }
    return { type: "chat", reply: content };
  } catch {
    return { type: "chat", reply: content };
  }
}

const ACTION_LABELS: Record<string, string> = {
  ban: "kullanıcı banlama",
  kick: "kullanıcı atma (kick)",
  mute: "kullanıcı susturma",
  unmute: "susturma kaldırma",
  nick: "kullanıcı adı değiştirme",
  create_channel: "kanal oluşturma",
  delete_channel: "kanal silme",
  delete_all_channels: "tüm kanalları silme",
  rename_channel: "kanal adı değiştirme",
  lock_channel: "kanal kilitleme",
  unlock_channel: "kanal kilidini açma",
  slowmode: "yavaş mod ayarlama",
  create_category: "kategori oluşturma",
  create_role: "rol oluşturma",
  delete_role: "rol silme",
  delete_all_roles: "tüm rolleri silme",
  rename_role: "rol adı değiştirme",
  assign_role: "kullanıcıya rol verme",
  remove_role: "kullanıcıdan rol alma",
  clear_messages: "mesaj temizleme",
  announce: "duyuru yapma",
  send_message: "kanala mesaj gönderme",
  rename_server: "sunucu adı değiştirme",
  setup_server: "sunucu düzeni kurma",
  setup_gaming_server: "oyun sunucusu kurma",
  create_event: "etkinlik oluşturma",
  automod_enable: "otomatik denetleme açma",
  automod_disable: "otomatik denetleme kapatma",
  join_voice: "ses kanalına katılma",
  leave_voice: "ses kanalından ayrılma",
  add_reaction: "mesaja tepki ekleme",
  vote_poll: "ankete oy verme",
  sequence: "çoklu komut çalıştırma",
};

export async function generateRefusalMessage(
  actionType: string,
  username: string
): Promise<string> {
  const label = ACTION_LABELS[actionType] || "bu işlemi yapma";

  try {
    const result = await chatWithFallback(
      [
        { role: "system", content: `Sen BasurAi adlı bir Discord botusun. Türkçe, samimi ve kısa yanıt ver. Emoji kullanabilirsin.` },
        { role: "user", content: `"${username}" adlı kullanıcı "${label}" komutu verdi ama yönetici izni yok. Ona nazikçe ve kısa (1-2 cümle) açıkla: bu komutu yapamazsın, sadece yöneticiler yapabilir. Konuya özgü yaz, jenerik olmasın.` },
      ],
      256,
      0.7
    );
    return result || `❌ Üzgünüm **${username}**, ${label} için yönetici iznine ihtiyacın var.`;
  } catch {
    return `❌ Üzgünüm **${username}**, ${label} için yönetici iznine ihtiyacın var.`;
  }
}

export async function summarizeSearchResults(
  userQuery: string,
  rawResults: string
): Promise<string> {
  const prompt = `Kullanıcı şunu sormak istedi: "${userQuery}"\n\nAşağıdaki ham internet arama sonuçlarını oku ve kullanıcıya Türkçe, anlaşılır, Discord formatında (maksimum 1800 karakter) özetle. Kaynakları linkler halinde ekle:\n\n${rawResults}`;

  try {
    const result = await chatWithFallback(
      [
        { role: "system", content: "Sen yardımcı bir asistansın. İnternet arama sonuçlarını Türkçe olarak net ve anlaşılır biçimde özetle. Discord markdown formatını kullan (**kalın**, • madde işaretleri). Yanıt 1800 karakteri geçmesin." },
        { role: "user", content: prompt },
      ],
      8192,
      0.4
    );
    return result || rawResults;
  } catch {
    return rawResults;
  }
}

export async function pickPollChoice(
  question: string,
  options: string[]
): Promise<string> {
  try {
    const result = await chatWithFallback(
      [
        { role: "system", content: `Sen mantıklı kararlar veren bir yapay zekasın. Türkçe düşün. Verilen anket seçeneklerinden en mantıklı olanı seç ve sadece o seçeneğin emoji/metnini döndür.` },
        { role: "user", content: `Anket: "${question}"\nSeçenekler (emoji - açıklama):\n${options.join("\n")}\nEn mantıklı seçenek hangisi? Sadece o seçeneğin emoji'sini yaz.` },
      ],
      64,
      0
    );
    return result || options[0];
  } catch {
    return options[0];
  }
}
