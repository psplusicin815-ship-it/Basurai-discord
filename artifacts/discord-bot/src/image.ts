import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export async function generateImage(prompt: string): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  throw new Error("Görsel üretilemedi.");
}

export async function editImage(
  imageBuffer: Buffer,
  mimeType: string,
  instruction: string
): Promise<Buffer> {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString("base64"),
            },
          },
          {
            text: `Bu görseli şu talimata göre düzenle ve yeni görsel olarak döndür: ${instruction}. Sadece düzenlenmiş görseli döndür.`,
          },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  throw new Error("Görsel düzenlenemedi. Farklı bir istek dene.");
}

const IMAGE_EDIT_KEYWORDS = [
  "düzenle", "düzenleme", "değiştir", "dönüştür", "çevir",
  "yap", "ekle", "sil", "kaldır", "boyut", "renk", "renklendir",
  "filtre", "efekt", "karikatür", "anime", "pixel", "sanatsal",
  "çiz", "resme çevir", "boyama", "eskiz", "siyah beyaz",
  "renkli yap", "bulanıklaştır", "keskinleştir", "aydınlat",
  "karart", "arka planı", "arkaplanı", "yüzü", "gözleri",
  "saçı", "saçları", "kıyafeti", "kıyafetini", "görseli düzenle",
  "fotoğrafı", "resmi", "cartoon", "çizgi film", "manga",
  "watercolor", "suluboya", "oil painting", "yağlı boya",
  "vintage", "retro", "glow", "ışıltı", "parlat",
  "emoji ekle", "yazı ekle", "metin ekle", "logo ekle",
  "sticker ekle", "şapka ekle", "gözlük ekle",
];

export function isImageEditRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return IMAGE_EDIT_KEYWORDS.some((kw) => lower.includes(kw));
}
