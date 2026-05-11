/* eslint-env node */
const { rankResults, dedupeResults } = require('./utils/rankSearchResults');
const { searchMeili } = require('./providers/meili.provider');
const { searchLocalAddresses } = require('./providers/localAddress.provider');
const { searchLocalPoi } = require('./providers/localPoi.provider');
const { searchGtfsStops } = require('./providers/gtfsStops.provider');
const { searchGooglePlaces } = require('./providers/googlePlaces.provider');

function limitValue(value) {
  return Math.min(Math.max(Number(value || 8), 1), 12);
}

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return String(v).toLowerCase() === 'true';
}

async function safeProvider(name, fn, timeoutMs = 900) {
  try {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${name} timeout`)), timeoutMs);
    });
    const results = await Promise.race([Promise.resolve().then(fn), timeout]);
    clearTimeout(timer);
    return { name, ok: true, results: Array.isArray(results) ? results : [], error: null };
  } catch (error) {
    return { name, ok: false, results: [], error: error.message || String(error) };
  }
}

async function autocomplete(query = {}) {
  const startedAt = Date.now();
  const q = String(query.q || query.query || query.text || query.search || '').trim();
  const limit = limitValue(query.limit);

  if (q.length < 2) {
    return { ok: true, query: q, count: 0, results: [], suggestions: [], meta: { tookMs: Date.now() - startedAt } };
  }

  const providers = await Promise.all([
    safeProvider('meilisearch', () => searchMeili(q, { limit: limit * 2 }), 900),
    safeProvider('local_address', () => searchLocalAddresses(q, { limit }), 100),
    safeProvider('local_poi', () => searchLocalPoi(q, { limit }), 120),
    safeProvider('gtfs_stops', () => searchGtfsStops(q, { limit }), 120),
  ]);

  const combined = providers.flatMap((p) => p.results);

  const hasStrongLocal = combined.some((item) => Number(item.score || 0) >= 450);
  const shouldUseGoogle = envBool('SEARCH_AUTOCOMPLETE_GOOGLE_FALLBACK', true) && !hasStrongLocal;

  if (shouldUseGoogle) {
    providers.push(await safeProvider('google_places', () => searchGooglePlaces(q, { limit }), 2200));
  }

  const ranked = rankResults(dedupeResults(providers.flatMap((p) => p.results)), q).slice(0, limit);

  return {
    ok: true,
    query: q,
    count: ranked.length,
    results: ranked,
    suggestions: ranked,
    places: ranked.filter((item) => item.type !== 'stop'),
    stops: ranked.filter((item) => item.type === 'stop'),
    addresses: ranked.filter((item) => item.type === 'address'),
    meta: {
      tookMs: Date.now() - startedAt,
      providers: providers.map((p) => ({ name: p.name, ok: p.ok, count: p.results.length, error: p.error })),
    },
  };
}

module.exports = { autocomplete };
