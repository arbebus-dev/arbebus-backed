const fs = require("fs");
const path = require("path");
const axios = require("axios");

const NEWS_FILE_PATH = path.join(__dirname, "..", "data", "news.json");
const GNEWS_BASE = "https://gnews.io/api/v4";
const CACHE_TTL_MS = Number(process.env.NEWS_CACHE_TTL_MS || 5 * 60 * 1000);

let cache = {
  generatedAt: 0,
  payload: null,
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatLtDate(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString("lt-LT", {
      timeZone: "Europe/Vilnius",
    });
  }

  return date.toLocaleString("lt-LT", {
    timeZone: "Europe/Vilnius",
  });
}

function readFallbackNewsFile() {
  try {
    if (!fs.existsSync(NEWS_FILE_PATH)) return [];

    const raw = fs.readFileSync(NEWS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;

    return safeArray(items).filter(Boolean);
  } catch (error) {
    console.error("readFallbackNewsFile error:", error.message);
    return [];
  }
}

function normalizeFallbackItem(item) {
  return {
    id: item.id || `${item.type || "update"}-${slugify(item.title)}`,
    type: item.type || "update",
    title: item.title || "Arbebus update",
    subtitle: item.subtitle || "Fallback naujiena.",
    badge: item.badge || item.type || "Update",
    cta: item.cta || "Atidaryti",
    accent: item.accent || "#60A5FA",
    icon: item.icon || "newspaper-outline",
    iconLibrary: item.iconLibrary === "mdi" ? "mdi" : "ion",
    createdAt: item.createdAt || formatLtDate(),
    source: item.source || "Arbebus fallback",
    url: item.url || "https://arbebus.com",
    isLive: Boolean(item.isLive),
  };
}

function pickFallbackByTypes(items, allowedTypes) {
  return safeArray(items)
    .filter((item) => allowedTypes.includes(item?.type))
    .map(normalizeFallbackItem);
}

function normalizeWorldArticle(article, index) {
  const sourceName =
    article?.source?.name ||
    article?.source?.url ||
    "Global source";

  return {
    id: `world-${slugify(article?.title || `article-${index}`)}-${index}`,
    type: "world",
    title: article?.title || "World news update",
    subtitle:
      article?.description ||
      article?.content ||
      "Atidaryk pilną straipsnį.",
    badge: "World",
    cta: "Skaityti",
    accent: "#4DA3FF",
    icon: "globe-outline",
    iconLibrary: "ion",
    createdAt: formatLtDate(article?.publishedAt),
    source: sourceName,
    url: article?.url || "https://arbebus.com",
    isLive: true,
  };
}

async function fetchWorldNewsFromGNews() {
  const apiKey = process.env.GNEWS_API_KEY || process.env.NEWS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GNEWS_API_KEY");
  }

  const response = await axios.get(`${GNEWS_BASE}/top-headlines`, {
    timeout: 12000,
    params: {
      category: "world",
      lang: "en",
      max: 10,
      apikey: apiKey,
    },
  });

  if (response.status !== 200 || !response.data) {
    throw new Error("GNews bad response");
  }

  const articles = safeArray(response.data.articles);

  if (!articles.length) {
    throw new Error("GNews returned no articles");
  }

  return articles.map(normalizeWorldArticle);
}

async function buildNewsFeed() {
  if (
    cache.payload &&
    cache.generatedAt &&
    Date.now() - cache.generatedAt < CACHE_TTL_MS
  ) {
    return cache.payload;
  }

  const fallbackItems = readFallbackNewsFile();

  let worldItems = [];
  let worldStatus = "fallback";
  const errors = [];

  try {
    worldItems = await fetchWorldNewsFromGNews();
    worldStatus = "live";
  } catch (error) {
    errors.push({
      section: "world",
      message: error.message || "World feed failed",
    });

    worldItems = pickFallbackByTypes(fallbackItems, ["world"]);
  }

  const transportItems = pickFallbackByTypes(fallbackItems, ["transport"]);
  const dealItems = pickFallbackByTypes(fallbackItems, ["deal"]);
  const updateItems = pickFallbackByTypes(fallbackItems, ["update"]);

  const items = [
    ...worldItems,
    ...transportItems,
    ...dealItems,
    ...updateItems,
  ];

  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    meta: {
      partial: errors.length > 0,
      cacheTtlMs: CACHE_TTL_MS,
      sections: {
        world: worldStatus,
        transport: transportItems.length ? "fallback" : "empty",
        deal: dealItems.length ? "fallback" : "empty",
        update: updateItems.length ? "fallback" : "empty",
      },
      errors,
    },
    items,
  };

  cache = {
    generatedAt: Date.now(),
    payload,
  };

  return payload;
}

module.exports = {
  buildNewsFeed,
};