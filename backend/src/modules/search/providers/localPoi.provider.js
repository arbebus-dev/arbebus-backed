const path = require('path');
const fs = require('fs');
const { normalizeText, expandQuery } = require('../utils/normalizeText');
const { toResult } = require('../utils/mapSearchResult');

const DATA_ROOT = path.join(__dirname, '../../../data/poi');

// Local POI turi buti tik svarbiausi override'ai: Akropolis, arena, baseinas,
// stotys, perkėlos. Miestai/regionai turi ateiti is Nominatim, ne is local JSON.
const ALLOWED_LOCAL_TYPES = new Set(['poi', 'station', 'ferry']);

function readJson(file, fallback) {
  try {
    const p = path.join(DATA_ROOT, file);
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, 'utf8').trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function aliasesObject() {
  const aliases = readJson('placeAliases.json', {});
  if (Array.isArray(aliases)) {
    return aliases.reduce((acc, entry) => {
      if (entry?.canonical) acc[entry.canonical] = [...(entry.aliases || []), ...(entry.keywords || [])];
      return acc;
    }, {});
  }
  return aliases && typeof aliases === 'object' ? aliases : {};
}

function loadLocalPois() {
  const priority = readJson('priorityPois.json', []);
  const legacy = readJson('klaipedaPois.json', []);

  return [...priority, ...legacy]
    .map((item) => ({
      ...item,
      type: item.type || 'poi',
      source: 'local_poi',
      keywords: [...(item.keywords || []), ...(item.aliases || [])],
    }))
    .filter((item) => ALLOWED_LOCAL_TYPES.has(String(item.type || '').toLowerCase()))
    .map((item) => toResult(item))
    .filter(Boolean);
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
    const parts = q.split(' ').filter(Boolean);

    for (const field of fields) {
      if (field === q) score = Math.max(score, 340);
      else if (field.startsWith(q)) score = Math.max(score, 260);
      else if (field.includes(q)) score = Math.max(score, 190);
      else if (parts.length > 1 && parts.every((part) => field.includes(part))) score = Math.max(score, 145);
    }
  }

  if (score <= 0) return 0;
  return score + Number(item.priority || 0);
}

async function searchLocalPoi(query, options = {}) {
  const q = normalizeText(query);
  if (!q || q.length < 2) return [];

  const limit = Number(options.limit || 10);
  const aliasMap = aliasesObject();
  const variants = expandQuery(q, aliasMap);

  return loadLocalPois()
    .map((item) => ({ ...item, score: scoreLocalPoi(item, variants), matchScore: scoreLocalPoi(item, variants) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function localPoiHealth() {
  return {
    poiCount: loadLocalPois().length,
    aliasesCount: Object.keys(aliasesObject()).length,
    localTypes: [...ALLOWED_LOCAL_TYPES],
  };
}

module.exports = { searchLocalPoi, loadLocalPois, localPoiHealth, aliasesObject };
