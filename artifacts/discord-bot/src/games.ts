import { TextChannel, EmbedBuilder, Colors } from "discord.js";
import { GoogleGenAI } from "@google/genai";

const gemini = process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: { apiVersion: "", baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
    })
  : null;

const STATIC_QUESTIONS = [
  { question: "Türkiye'nin başkenti neresidir?", answer: "Ankara", options: ["İstanbul", "Ankara", "İzmir", "Bursa"] },
  { question: "Güneş sistemimizdeki en büyük gezegen hangisidir?", answer: "Jüpiter", options: ["Satürn", "Uranüs", "Jüpiter", "Neptün"] },
  { question: "Su'nun kimyasal formülü nedir?", answer: "H2O", options: ["CO2", "H2O", "NaCl", "O2"] },
  { question: "Dünyanın en uzun nehri hangisidir?", answer: "Nil", options: ["Amazon", "Nil", "Yangtze", "Missisipi"] },
  { question: "Hangi element periyodik tabloda Au sembolüyle gösterilir?", answer: "Altın", options: ["Gümüş", "Alüminyum", "Altın", "Bakır"] },
  { question: "Osmanlı İmparatorluğu'nun kurucusu kimdir?", answer: "Osman Bey", options: ["Orhan Bey", "Osman Bey", "Murat I", "Yıldırım Bayezid"] },
  { question: "İnsan vücudunda kaç kemik vardır?", answer: "206", options: ["186", "196", "206", "216"] },
  { question: "Hangi ülke hem Avrupa hem Asya kıtasında yer alır?", answer: "Türkiye", options: ["Rusya", "Türkiye", "Kazakistan", "Azerbaycan"] },
  { question: "Dünya'nın en yüksek dağı hangisidir?", answer: "Everest", options: ["K2", "Everest", "Kangchenjunga", "Makalu"] },
  { question: "Hangi renklerin karışımı yeşili oluşturur?", answer: "Mavi ve sarı", options: ["Kırmızı ve sarı", "Mavi ve sarı", "Kırmızı ve mavi", "Sarı ve beyaz"] },
  { question: "Türkiye'nin en büyük gölü hangisidir?", answer: "Van Gölü", options: ["Tuz Gölü", "Van Gölü", "Beyşehir Gölü", "Eğirdir Gölü"] },
  { question: "Işık hızı yaklaşık kaç km/s'dir?", answer: "300.000 km/s", options: ["150.000 km/s", "300.000 km/s", "500.000 km/s", "1.000.000 km/s"] },
  { question: "Hangi gezegen Güneş'e en yakındır?", answer: "Merkür", options: ["Venüs", "Merkür", "Mars", "Dünya"] },
  { question: "DNA'nın açılımı nedir?", answer: "Deoksiribonükleik Asit", options: ["Dinamik Nükleotid Asit", "Deoksiribonükleik Asit", "Dinitro Amino Asit", "Doğal Nükleik Asit"] },
  { question: "Türk Kurtuluş Savaşı hangi yılda sona erdi?", answer: "1923", options: ["1919", "1921", "1923", "1925"] },
  { question: "Hangi sanatçı 'Mona Lisa'yı çizmiştir?", answer: "Leonardo da Vinci", options: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Botticelli"] },
  { question: "Dünyanın en büyük okyanusu hangisidir?", answer: "Pasifik", options: ["Atlantik", "Hint", "Pasifik", "Arktik"] },
  { question: "Türkiye'nin para birimi nedir?", answer: "Türk Lirası", options: ["Euro", "Dolar", "Türk Lirası", "Pound"] },
  { question: "Hangi vitamin güneş ışığından elde edilir?", answer: "D vitamini", options: ["A vitamini", "B12 vitamini", "C vitamini", "D vitamini"] },
  { question: "Atom çekirdeği nelerden oluşur?", answer: "Proton ve nötron", options: ["Elektron ve proton", "Proton ve nötron", "Elektron ve nötron", "Sadece proton"] },
  { question: "Hangi ülke dünya nüfusunun en kalabalığıdır?", answer: "Hindistan", options: ["Çin", "Hindistan", "ABD", "Endonezya"] },
  { question: "Türkiye kaç ilden oluşur?", answer: "81", options: ["79", "80", "81", "82"] },
  { question: "Hangi element havada en çok bulunan gazdır?", answer: "Azot", options: ["Oksijen", "Azot", "Karbondioksit", "Argon"] },
  { question: "İstanbul'un eski adı nedir?", answer: "Konstantinopolis", options: ["Byzantium", "Konstantinopolis", "Roma", "Nikaia"] },
  { question: "Bir oktavda kaç nota vardır?", answer: "8", options: ["6", "7", "8", "12"] },
  { question: "Hangi spor dalında 'grand slam' terimi kullanılır?", answer: "Tenis", options: ["Golf", "Tenis", "Beyzbol", "Her ikisi de"] },
  { question: "Pi sayısının ilk üç basamağı nedir?", answer: "3.14", options: ["3.12", "3.14", "3.16", "3.18"] },
  { question: "Hangi organımız insülin üretir?", answer: "Pankreas", options: ["Karaciğer", "Böbrek", "Pankreas", "Dalak"] },
  { question: "Türkiye'nin en uzun nehri hangisidir?", answer: "Kızılırmak", options: ["Fırat", "Sakarya", "Kızılırmak", "Yeşilırmak"] },
  { question: "Dünyanın en küçük ülkesi hangisidir?", answer: "Vatikan", options: ["Monako", "Nauru", "Vatikan", "San Marino"] },
];
const usedQuestions = new Set<number>();

// ===== SAYI TAHMİN =====
interface NumberGame {
  target: number;
  attempts: number;
  maxAttempts: number;
  userId: string;
  min: number;
  max: number;
}
const numberGames = new Map<string, NumberGame>(); // channelId → game

export function startNumberGame(channelId: string, userId: string, min = 1, max = 100): NumberGame {
  const game: NumberGame = {
    target: Math.floor(Math.random() * (max - min + 1)) + min,
    attempts: 0,
    maxAttempts: 7,
    userId,
    min,
    max,
  };
  numberGames.set(channelId, game);
  return game;
}

export function getNumberGame(channelId: string): NumberGame | undefined {
  return numberGames.get(channelId);
}

export function endNumberGame(channelId: string): void {
  numberGames.delete(channelId);
}

export function guessNumber(channelId: string, guess: number): {
  result: "low" | "high" | "correct" | "lose" | "invalid";
  attempts: number;
  target?: number;
  remaining?: number;
} {
  const game = numberGames.get(channelId);
  if (!game) return { result: "invalid", attempts: 0 };

  game.attempts++;

  if (guess === game.target) {
    numberGames.delete(channelId);
    return { result: "correct", attempts: game.attempts, target: game.target };
  }

  const remaining = game.maxAttempts - game.attempts;
  if (remaining <= 0) {
    const target = game.target;
    numberGames.delete(channelId);
    return { result: "lose", attempts: game.attempts, target, remaining: 0 };
  }

  return {
    result: guess < game.target ? "low" : "high",
    attempts: game.attempts,
    remaining,
  };
}

// ===== KELİME ZİNCİRİ =====
interface WordChain {
  lastWord: string;
  usedWords: Set<string>;
  currentUserId: string | null;
  streak: number;
}
const wordChains = new Map<string, WordChain>(); // channelId → game

export function startWordChain(channelId: string, startWord: string): void {
  wordChains.set(channelId, {
    lastWord: startWord.toLowerCase().trim(),
    usedWords: new Set([startWord.toLowerCase().trim()]),
    currentUserId: null,
    streak: 1,
  });
}

export function getWordChain(channelId: string): WordChain | undefined {
  return wordChains.get(channelId);
}

export function endWordChain(channelId: string): void {
  wordChains.delete(channelId);
}

export function playWordChain(channelId: string, word: string, userId: string): {
  result: "ok" | "wrong_letter" | "already_used" | "no_game";
  streak?: number;
  lastWord?: string;
  expectedLetter?: string;
} {
  const game = wordChains.get(channelId);
  if (!game) return { result: "no_game" };

  const clean = word.toLowerCase().trim();
  const lastChar = [...game.lastWord].pop()!;

  if (!clean.startsWith(lastChar)) {
    return { result: "wrong_letter", expectedLetter: lastChar, lastWord: game.lastWord };
  }

  if (game.usedWords.has(clean)) {
    return { result: "already_used", lastWord: game.lastWord };
  }

  game.usedWords.add(clean);
  game.lastWord = clean;
  game.currentUserId = userId;
  game.streak++;

  return { result: "ok", streak: game.streak, lastWord: clean };
}

// ===== TRİVİA =====
interface TriviaGame {
  question: string;
  answer: string;
  options: string[];
  emojis: string[];
  userId: string;
  messageId?: string;
}
const triviaGames = new Map<string, TriviaGame>(); // channelId → game

export async function generateTrivia(difficulty: "kolay" | "orta" | "zor" = "orta"): Promise<{
  question: string;
  answer: string;
  options: string[];
}> {
  if (gemini) {
    try {
      const res = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `Türkçe bilgi yarışması sorusu üret. Zorluk: ${difficulty}. Sadece JSON döndür (başka hiçbir şey yazma): {"question":"...","answer":"doğru_cevap","options":["A seçenek","B seçenek","C seçenek","D seçenek"]} — options içinde doğru cevap da olsun, rastgele sırada. Kısa net yaz.` }] }],
      });
      const text = res.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch { /* fallback */ }
  }

  // Statik soru bankasından rastgele — aynı soru tekrar gelmesin
  if (usedQuestions.size >= STATIC_QUESTIONS.length) usedQuestions.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * STATIC_QUESTIONS.length); } while (usedQuestions.has(idx));
  usedQuestions.add(idx);
  return STATIC_QUESTIONS[idx];
}

export function startTrivia(channelId: string, userId: string, data: { question: string; answer: string; options: string[] }): TriviaGame {
  const emojis = ["🇦", "🇧", "🇨", "🇩"];
  const game: TriviaGame = { ...data, emojis, userId };
  triviaGames.set(channelId, game);
  return game;
}

export function answerTrivia(channelId: string, input: string): { correct: boolean; answer: string } | null {
  const game = triviaGames.get(channelId);
  if (!game) return null;

  const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
  const emojiMap: Record<string, number> = { "🇦": 0, "🇧": 1, "🇨": 2, "🇩": 3 };
  const idx = letterMap[input.toLowerCase()] ?? emojiMap[input] ?? -1;
  const chosen = idx >= 0 ? game.options[idx] : null;
  triviaGames.delete(channelId);
  return { correct: chosen === game.answer, answer: game.answer };
}

export function endTrivia(channelId: string): void {
  triviaGames.delete(channelId);
}

export function getTrivia(channelId: string): TriviaGame | undefined {
  return triviaGames.get(channelId);
}

// ===== ROAST & COMPLIMENT =====
export async function generateRoast(targetName: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: "Komik, abartılı ama zararsız bir roast yaz. Türkçe, maksimum 2 cümle. Kişisel hakaret değil, eğlenceli espri.",
      },
      { role: "user", content: `"${targetName}" için komik bir roast yaz.` },
    ],
    max_tokens: 100,
    temperature: 0.95,
  });
  return completion.choices[0]?.message?.content?.trim() || `${targetName} o kadar sıradan ki, Wikipedia'da "ortalama" kelimesinin yanına fotoğrafı konmuş.`;
}

export async function generateCompliment(targetName: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: "Samimi ve güzel bir iltifat yaz. Türkçe, maksimum 2 cümle. Kişiyi mutlu edecek türden.",
      },
      { role: "user", content: `"${targetName}" için güzel bir iltifat yaz.` },
    ],
    max_tokens: 100,
    temperature: 0.85,
  });
  return completion.choices[0]?.message?.content?.trim() || `${targetName} bu sunucunun en değerli üyelerinden biri! ✨`;
}

// ===== HAFIZA OYUNU =====
const MEMORY_EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🎮", "🎯", "🎪", "🌟", "💎"];

export function generateMemoryGame(): { sequence: string[]; display: string } {
  const shuffled = [...MEMORY_EMOJIS].sort(() => Math.random() - 0.5).slice(0, 5);
  const doubled = [...shuffled, ...shuffled].sort(() => Math.random() - 0.5);
  return {
    sequence: doubled,
    display: doubled.map((e, i) => `${i + 1}:⬜`).join(" "),
  };
}
