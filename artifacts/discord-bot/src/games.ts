import { TextChannel, EmbedBuilder, Colors } from "discord.js";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

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
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      {
        role: "system",
        content: `Türkçe bilgi yarışması sorusu üret. Zorluk: ${difficulty}. JSON döndür: {"question":"...","answer":"doğru_cevap","options":["A cevap","B cevap","C cevap","D cevap"]} — options içinde doğru cevap da olsun, rastgele sırada. Kısa ve net yaz.`,
      },
      { role: "user", content: "Yeni bir trivia sorusu üret." },
    ],
    max_tokens: 200,
    temperature: 0.9,
  });

  const text = completion.choices[0]?.message?.content?.trim() || "{}";
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    return JSON.parse(match[0]);
  }
  return {
    question: "Türkiye'nin başkenti neresidir?",
    answer: "Ankara",
    options: ["İstanbul", "Ankara", "İzmir", "Bursa"],
  };
}

export function startTrivia(channelId: string, userId: string, data: { question: string; answer: string; options: string[] }): TriviaGame {
  const emojis = ["🇦", "🇧", "🇨", "🇩"];
  const game: TriviaGame = { ...data, emojis, userId };
  triviaGames.set(channelId, game);
  return game;
}

export function answerTrivia(channelId: string, emoji: string): { correct: boolean; answer: string } | null {
  const game = triviaGames.get(channelId);
  if (!game) return null;

  const idx = game.emojis.indexOf(emoji);
  const chosen = idx >= 0 ? game.options[idx] : null;
  triviaGames.delete(channelId);
  return { correct: chosen === game.answer, answer: game.answer };
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
