const { normalizeText } = require('../utils/normalizeText');
const { rankResults, dedupeResults } = require('../utils/rankSearchResults');
const { loadLocalPois } = require('../providers/localPoi.provider');
const { loadGtfsStops } = require('../providers/gtfsStops.provider');

let indexCache = null;
let builtAt = 0;

function fieldsFor(item) {
  return [
    item.title,
    item.name,
    item.subtitle,
    item.category,
    ...(item.keywords || []),
    ...(item.aliases || []),
  ]
    .map(normalizeText)
    .filter(Boolean);
}

function dedupeByTitle(items) {
  const seen = new Map();
  for (const item of items) {
    const key = normalizeText(item.title || item.name) || String(item.id || '');
    const existing = seen.get(key);
    const power = Number(item.priority || 0) + Number(item.score || 0);
    const existingPower = Number(existing?.priority || 0) + Number(existing?.score || 0);
    if (!existing || power >= existingPower) seen.set(key, item);
  }
  return [...seen.values()];
}

function buildFastSearchIndex() {
  const local = dedupeByTitle(loadLocalPois()).map((item) => ({ ...item, source: item.source || 'local_poi', _fields: fieldsFor(item) }));
  const stops = loadGtfsStops().map((item) => ({ ...item, source: item.source || 'gtfs', _fields: fieldsFor(item) }));
  indexCache = [...local, ...stops];
  builtAt = Date.now();
  return indexCache;
}

function getFastSearchIndex() {
  return indexCache || buildFastSearchIndex();
}

function localTextMatchScore(item, query) {
  const q = normalizeText(query);
  const parts = q.split(' ').filter(Boolean);
  let score = 0;

  for (const field of item._fields || fieldsFor(item)) {
    if (field === q) score = Math.max(score, 520);
    else if (field.startsWith(q)) score = Math.max(score, 320);
    else if (field.includes(q)) score = Math.max(score, 210);
    else if (parts.length > 1 && parts.every((part) => field.includes(part))) score = Math.max(score, 180);
    else if (parts.length === 1 && parts.some((part) => part.length >= 3 && field.includes(part))) score = Math.max(score, 72);
  }

  return score;
}

function searchFastIndex(query, options = {}) {
  const q = normalizeText(query);
  if (!q || q.length < 2) return [];
  const limit = Number(options.limit || 18);

  const matches = getFastSearchIndex()
    .map((item) => {
      const matchScore = localTextMatchScore(item, q);
      return { ...item, matchScore, score: Number(item.score || 0) + matchScore };
    })
    .filter((item) => item.matchScore > 0);

  return rankResults(dedupeResults(matches), q).slice(0, limit);
}

function searchIndexHealth() {
  const index = getFastSearchIndex();
  return { searchIndexItems: index.length, searchIndexBuiltAt: builtAt };
}

module.exports = { buildFastSearchIndex, getFastSearchIndex, searchFastIndex, searchIndexHealth };
