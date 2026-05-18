/* eslint-env node */
const { normalizeText } = require("./utils/normalizeText");
const { searchLocalAddresses } = require("./providers/localAddress.provider");
const { searchLocalPoi } = require("./providers/localPoi.provider");
const { searchGtfsStops } = require("./providers/gtfsStops.provider");
const { rankResults, dedupeResults } = require("./utils/rankSearchResults");

const SERVICE_VERSION = "ultra-fast-v170-local-all-single-roundtrip";
const CACHE_TTL_MS = Number(process.env.SEARCH_AUTOCOMPLETE_MEMORY_CACHE_TTL_MS || 5 * 60 * 1000);
const CACHE_MAX = Number(process.env.SEARCH_AUTOCOMPLETE_MEMORY_CACHE_MAX || 1000);
const responseCache = new Map();

function limitValue(value) {
  return Math.min(Math.max(Number(value || 8), 1), 12);
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function cacheGet(key) {
  const item = responseCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  responseCache.delete(key);
  responseCache.set(key, item);
  return item.value;
}

function cacheSet(key, value) {
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (responseCache.size > CACHE_MAX) {
    const first = responseCache.keys().next().value;
    if (!first) break;
    responseCache.delete(first);
  }
}

function responsePayload({ q, ranked, startedAt, cached = false }) {
  return {
    ok: true,
    query: q,
    count: ranked.length,
    results: ranked,
    suggestions: ranked,
    places: ranked,
    stops: [],
    addresses: ranked.filter((item) => item.type === "address"),
    meta: {
      tookMs: Date.now() - startedAt,
      cached,
      autocomplete: true,
      addressAutocompleteOnly: false,
      addressFirst: true,
      localAddressOnly: false,
      localPoiEnabled: true,
      gtfsStopsEnabled: true,
      noProviderTimeout: true,
      strictPrefixOnly: true,
      ultraFastLookup: true,
      poiDisabledForAutocomplete: true,
      oneQueryPerRequest: true,
      memoryCache: responseCache.size,
      searchServiceVersion: SERVICE_VERSION,
      providers: [
        {
          name: "local_address",
          ok: true,
          count: ranked.length,
          error: null,
        },
      ],
    },
  };
}

async function autocomplete(query = {}) {
  const startedAt = Date.now();
  const q = String(query.q || query.query || query.text || query.search || "").trim();
  const limit = limitValue(query.limit);

  if (q.length < 2) {
    return responsePayload({ q, ranked: [], startedAt });
  }

  const cacheKey = `autocomplete:${SERVICE_VERSION}:${normalizeKey(q)}:${limit}:${query.lat || query.latitude || ""}:${query.lon || query.lng || query.longitude || ""}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return {
      ...cached,
      meta: {
        ...(cached.meta || {}),
        cached: true,
        tookMs: Date.now() - startedAt,
        memoryCache: responseCache.size,
        searchServiceVersion: SERVICE_VERSION,
      },
    };
  }

  const addressLimit = Math.max(8, limit);
  const [addresses, pois, stops] = await Promise.all([
    searchLocalAddresses(q, {
      limit: addressLimit,
      autocomplete: true,
      lat: query.lat ?? query.latitude,
      lon: query.lon ?? query.lng ?? query.longitude,
    }),
    searchLocalPoi(q, { limit: Math.max(6, limit) }),
    searchGtfsStops(q, { limit: 6 }),
  ]);

  const ranked = dedupeResults(
    rankResults([...addresses, ...pois, ...stops], q),
  ).slice(0, limit);

  const payload = responsePayload({ q, ranked, startedAt });
  cacheSet(cacheKey, payload);
  return payload;
}

module.exports = { autocomplete };
