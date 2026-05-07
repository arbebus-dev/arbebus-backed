const path = require("path");
const fs = require("fs");
const { normalizeText, expandQuery } = require("../utils/normalizeText");
const { toResult } = require("../utils/mapSearchResult");
const logger = require("../../../core/logging/logger");

const DATA_ROOT = path.join(__dirname, "../../../data/poi");

const LOCAL_DATA_FILES = [
  "priorityPois.json",
  "klaipedaPois.json",
  "klaipedaDistricts.json",
  "schools.json",
  "kindergartens.json",
  "sportsClubs.json",
  "shoppingCenters.json",
  "childPois.json",
];

// Arbebus is Klaipėda-first. Local search must include child-relevant POI, not only generic POI.
const ALLOWED_LOCAL_TYPES = new Set([
  "poi",
  "place",
  "station",
  "ferry",
  "district",
  "region",
  "school",
  "kindergarten",
  "sports_club",
  "saved_place_template",
]);

function readJson(file, fallback) {
  try {
    const p = path.join(DATA_ROOT, file);
    if (!fs.existsSync(p)) return fallback;
    const raw = fs
      .readFileSync(p, "utf8")
      .replace(/^\uFEFF/, "")
      .trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    logger.warn(`[localPoi] failed to read ${file}: ${error.message}`);
    return fallback;
  }
}

function aliasesObject() {
  const aliases = readJson("placeAliases.json", {});
  if (Array.isArray(aliases)) {
    return aliases.reduce((acc, entry) => {
      if (entry?.canonical)
        acc[entry.canonical] = [
          ...(entry.aliases || []),
          ...(entry.keywords || []),
        ];
      return acc;
    }, {});
  }
  return aliases && typeof aliases === "object" ? aliases : {};
}

function readItemsFromFile(file) {
  const items = readJson(file, []);
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({ ...item, _dataFile: file }));
}

function normalizeLocalItem(item) {
  const type = String(item.type || item.category || "poi").toLowerCase();
  if (!ALLOWED_LOCAL_TYPES.has(type)) return null;

  const aliases = Array.isArray(item.aliases) ? item.aliases : [];
  const keywords = Array.isArray(item.keywords) ? item.keywords : [];
  const title = item.title || item.name;
  const source = item.source || "local_poi";

  return toResult({
    ...item,
    type,
    title,
    name: item.name || title,
    source,
    keywords: [...keywords, ...aliases, type, item._dataFile].filter(Boolean),
    aliases,
    category: item.category || type,
    priority: Number(item.priority || 0),
  });
}

function loadLocalPois() {
  return LOCAL_DATA_FILES.flatMap(readItemsFromFile)
    .map(normalizeLocalItem)
    .filter(Boolean);
}

function dedupeLocalPois(items) {
  const seen = new Map();
  for (const item of items) {
    const titleKey = normalizeText(item.title || item.name);
    const coordinateKey = [
      Number(item.latitude).toFixed(5),
      Number(item.longitude).toFixed(5),
    ].join(",");
    const key = `${titleKey}|${coordinateKey}`;
    const existing = seen.get(key);
    const itemPower = Number(item.priority || 0) + Number(item.score || 0);
    const existingPower =
      Number(existing?.priority || 0) + Number(existing?.score || 0);
    if (!existing || itemPower >= existingPower) seen.set(key, item);
  }
  return [...seen.values()];
}

function scoreLocalPoi(item, variants) {
  const fields = [
    item.title,
    item.name,
    item.subtitle,
    item.category,
    ...(item.keywords || []),
    ...(item.aliases || []),
  ]
    .map(normalizeText)
    .filter(Boolean);

  let score = 0;
  for (const q of variants) {
    const parts = q.split(" ").filter(Boolean);
    for (const field of fields) {
      if (field === q) score = Math.max(score, 560);
      else if (field.startsWith(q)) score = Math.max(score, 360);
      else if (field.includes(q)) score = Math.max(score, 230);
      else if (parts.length > 1 && parts.every((part) => field.includes(part)))
        score = Math.max(score, 190);
      else if (parts.some((part) => part.length >= 3 && field.includes(part)))
        score = Math.max(score, 90);
    }
  }

  if (score <= 0) return 0;

  const typeBoost =
    {
      school: 130,
      kindergarten: 120,
      sports_club: 115,
      district: 90,
      poi: 80,
      station: 60,
      stop: 40,
    }[String(item.type || "")] || 40;

  return score + typeBoost + Number(item.priority || 0);
}

async function searchLocalPoi(query, options = {}) {
  const q = normalizeText(query);
  if (!q || q.length < 2) return [];

  const limit = Number(options.limit || 12);
  const aliasMap = aliasesObject();
  const variants = expandQuery(q, aliasMap);

  return dedupeLocalPois(loadLocalPois())
    .map((item) => {
      const score = scoreLocalPoi(item, variants);
      return { ...item, score, matchScore: score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function localPoiHealth() {
  const items = loadLocalPois();
  return {
    poiCount: items.length,
    aliasesCount: Object.keys(aliasesObject()).length,
    localTypes: [...ALLOWED_LOCAL_TYPES],
    localDataFiles: LOCAL_DATA_FILES,
  };
}

module.exports = {
  searchLocalPoi,
  loadLocalPois,
  localPoiHealth,
  aliasesObject,
};
