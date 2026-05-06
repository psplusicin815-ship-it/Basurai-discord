const UA = "Mozilla/5.0 (compatible; BasurAi Discord Bot/2.0)";

interface NewsItem {
  title: string;
  description: string;
  url: string;
  source?: string;
  pubDate?: string;
}

// Google News RSS — gerçek zamanlı haberler
async function googleNewsRSS(query: string): Promise<NewsItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=tr&gl=TR&ceid=TR:tr`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];

    const xml = await res.text();

    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 6) {
      const block = match[1];
      const title = stripHtml(extractTag(block, "title")).replace(/^\[.*?\]\s*/, "").trim();
      const desc = stripHtml(extractTag(block, "description")).slice(0, 300).trim();
      const link = extractTag(block, "link").trim();
      const pubDate = extractTag(block, "pubDate").trim();
      const source = extractTag(block, "source").trim();

      if (title && link) {
        items.push({ title, description: desc, url: link, source, pubDate });
      }
    }

    return items;
  } catch {
    return [];
  }
}

// DuckDuckGo HTML arama — gerçek arama sonuçları ve snippet'lar
async function duckduckgoHTMLSearch(query: string): Promise<NewsItem[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=tr-tr`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });
    if (!res.ok) return [];

    const html = await res.text();
    const items: NewsItem[] = [];

    // DDG result blocks
    const resultRegex = /<div class="result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;

    while ((match = resultRegex.exec(html)) !== null && items.length < 5) {
      const block = match[1];

      // Extract title and URL
      const linkMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

      if (linkMatch) {
        const rawUrl = linkMatch[1];
        const title = stripHtml(linkMatch[2]).trim();
        const snippet = snippetMatch ? stripHtml(snippetMatch[1]).trim() : "";

        // Decode DDG redirect URL
        let finalUrl = rawUrl;
        const uddMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddMatch) {
          try { finalUrl = decodeURIComponent(uddMatch[1]); } catch { /* keep original */ }
        }

        if (title && finalUrl && !finalUrl.includes("duckduckgo.com")) {
          items.push({ title, description: snippet, url: finalUrl });
        }
      }
    }

    return items;
  } catch {
    return [];
  }
}

// Wikipedia özet — ansiklopedik bilgi
async function wikipediaSummary(query: string, lang = "tr"): Promise<NewsItem | null> {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/ /g, "_"))}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };

    if (!data.extract || data.extract.length < 40) return null;

    return {
      title: `Wikipedia — ${data.title || query}`,
      description: data.extract.slice(0, 600) + (data.extract.length > 600 ? "..." : ""),
      url: data.content_urls?.desktop?.page || "",
    };
  } catch {
    return null;
  }
}

// Bir web sayfasından kısa metin içeriği çek
async function fetchPageContent(url: string, maxChars = 1200): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return "";

    const html = await res.text();

    // Script ve style kaldır
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned.slice(0, maxChars);
  } catch {
    return "";
  }
}

// HTML tag içeriğini çıkar
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? (match[1] || match[2] || "").trim() : "";
}

// HTML taglarını temizle
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Sorgunun haber mi bilgi mi olduğunu tahmin et
function isNewsQuery(query: string): boolean {
  const newsKeywords = [
    "son dakika", "haber", "güncel", "bugün", "dün", "bu hafta",
    "savaş", "saldırı", "gelişme", "açıklama", "söyledi", "oldu",
    "breaking", "news", "latest", "today", "war", "attack",
  ];
  const lower = query.toLowerCase();
  return newsKeywords.some((kw) => lower.includes(kw));
}

export async function webSearch(query: string): Promise<string> {
  const newsQuery = isNewsQuery(query);
  const parts: string[] = [];

  // Her zaman paralel çalıştır
  const [newsItems, ddgItems, wikiTR, wikiEN] = await Promise.allSettled([
    googleNewsRSS(query),
    duckduckgoHTMLSearch(query),
    newsQuery ? Promise.resolve(null) : wikipediaSummary(query, "tr"),
    newsQuery ? Promise.resolve(null) : wikipediaSummary(query, "en"),
  ]);

  const news = newsItems.status === "fulfilled" ? newsItems.value : [];
  const ddg = ddgItems.status === "fulfilled" ? ddgItems.value : [];
  const wiki = wikiTR.status === "fulfilled" && wikiTR.value
    ? wikiTR.value
    : wikiEN.status === "fulfilled" ? wikiEN.value : null;

  // 1. Google News sonuçları (en güncel)
  if (news.length > 0) {
    const newsBlock = news.slice(0, 5).map((item) => {
      const date = item.pubDate ? ` _(${item.pubDate.slice(0, 16)})_` : "";
      const source = item.source ? ` — ${item.source}` : "";
      const desc = item.description ? `\n  ${item.description}` : "";
      return `📰 **${item.title}**${source}${date}${desc}\n  🔗 ${item.url}`;
    }).join("\n\n");

    parts.push(`🔴 **Google Haberleri**\n\n${newsBlock}`);
  }

  // 2. DuckDuckGo web sonuçları (haberler yoksa veya ek bilgi için)
  if (ddg.length > 0 && (!newsQuery || news.length === 0)) {
    const ddgBlock = ddg.slice(0, 3).map((item) => {
      const desc = item.description ? `\n  ${item.description}` : "";
      return `🔍 **${item.title}**${desc}\n  🔗 ${item.url}`;
    }).join("\n\n");

    parts.push(`**Web Arama Sonuçları**\n\n${ddgBlock}`);
  }

  // 3. Wikipedia (bilgi sorularında)
  if (wiki && !newsQuery) {
    parts.push(`📖 **${wiki.title}**\n${wiki.description}\n🔗 ${wiki.url}`);
  }

  // 4. İlk haberden içerik çek (haber sorgusuysa ve makul bir URL varsa)
  if (newsQuery && news.length > 0 && news[0].url && !news[0].url.includes("news.google")) {
    const pageContent = await fetchPageContent(news[0].url, 800);
    if (pageContent.length > 100) {
      parts.push(`📄 **İlk Haber İçeriği (${news[0].source || news[0].title}):**\n${pageContent}`);
    }
  }

  if (parts.length === 0) {
    return `"${query}" için internet üzerinde güncel bir bilgiye ulaşılamadı. Daha spesifik anahtar kelimelerle tekrar deneyin.`;
  }

  return parts.join("\n\n---\n\n");
}
