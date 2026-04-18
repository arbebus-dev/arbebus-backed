const axios = require("axios");

const BBC_WORLD_RSS = "https://feeds.bbci.co.uk/news/world/rss.xml";

function decodeHtml(value = "") {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value = "") {
  return decodeHtml(value).replace(/<[^>]+>/g, "").trim();
}

function extractItems(xml = "") {
  const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return matches.map((match) => match[1]);
}

function getTagValue(block = "", tag = "") {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const found = block.match(regex);
  return found ? stripTags(found[1]) : "";
}

function buildWorldItemsFromXml(xml) {
  const rawItems = extractItems(xml).slice(0, 12);

  return rawItems
    .map((item, index) => {
      const title = getTagValue(item, "title");
      const description = getTagValue(item, "description");
      const pubDate = getTagValue(item, "pubDate");
      const link = getTagValue(item, "link");

      if (!title) return null;

      return {
        id: `world-${index}-${title.slice(0, 24)}`,
        type: "world",
        title,
        subtitle:
          description || "Latest world update from BBC RSS via Arbebus backend.",
        badge: "LIVE",
        cta: link ? "Open article" : "",
        accent: "#60A5FA",
        icon: "globe-outline",
        iconLibrary: "ion",
        createdAt: pubDate || new Date().toISOString(),
        source: "BBC World",
        url: link || "",
        isLive: true,
      };
    })
    .filter(Boolean);
}

function buildFallbackItems() {
  const now = new Date().toISOString();

  return [
    {
      id: "transport-fallback-1",
      type: "transport",
      title: "Transport update",
      subtitle:
        "Live transport feed laikinai ribotas. Backend veikia fallback režimu be app crash.",
      badge: "Fallback",
      cta: "",
      accent: "#34D399",
      icon: "bus-clock",
      iconLibrary: "mdi",
      createdAt: now,
      source: "Arbebus",
      url: "",
      isLive: false,
    },
    {
      id: "update-fallback-1",
      type: "update",
      title: "Arbebus backend status",
      subtitle:
        "Kai kurie šaltiniai laikinai neatsako. Rodomas atsarginis feed, kol live šaltiniai sugrįš.",
      badge: "System",
      cta: "",
      accent: "#F59E0B",
      icon: "warning-outline",
      iconLibrary: "ion",
      createdAt: now,
      source: "Arbebus",
      url: "",
      isLive: false,
    },
  ];
}

async function buildNewsFeed() {
  const items = [];
  const errors = [];
  const sections = {
    world: "empty",
    transport: "fallback",
    deal: "empty",
    update: "fallback",
  };

  try {
    const response = await axios.get(BBC_WORLD_RSS, {
      timeout: 12000,
      responseType: "text",
      headers: {
        "User-Agent": "Arbebus/1.0",
        Accept:
          "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });

    const xml = typeof response.data === "string" ? response.data : "";
    const worldItems = buildWorldItemsFromXml(xml);

    if (worldItems.length > 0) {
      items.push(...worldItems);
      sections.world = "live";
    } else {
      sections.world = "fallback";
      errors.push({
        section: "world",
        message: "BBC RSS returned no items.",
      });
    }
  } catch (error) {
    sections.world = "fallback";
    errors.push({
      section: "world",
      message: error?.message || "BBC RSS fetch failed.",
    });
  }

  items.push(...buildFallbackItems());

  return {
    items,
    meta: {
      partial: errors.length > 0,
      sections,
      errors,
    },
  };
}

module.exports = {
  buildNewsFeed,
};