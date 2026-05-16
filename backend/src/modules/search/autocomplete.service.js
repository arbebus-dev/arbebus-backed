/* eslint-env node */
const { rankResults, dedupeResults } = require("./utils/rankSearchResults");
const { getCache, setCache } = require("./cache/searchCache");
const { searchMeili } = require("./providers/meili.provider");
const { searchLocalAddresses } = require("./providers/localAddress.provider");
const { searchLocalPoi } = require("./providers/localPoi.provider");
const { searchGtfsStops } = require("./providers/gtfsStops.provider");
const { searchGooglePlaces } = require("./providers/googlePlaces.provider");
const { index: searchIndex } = require("./search.service");

const AUTOCOMPLETE_CACHE_TTL_SECONDS = Number(
  process.env.SEARCH_AUTOCOMPLETE_CACHE_TTL_SECONDS || 120,
);

function limitValue(value) {
  return Math.min(Math.max(Number(value || 8), 1), 12);
}

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return String(v).toLowerCase() === "true";
}

function hasHouseNumberQuery(value = "") {
  return /\b\d+[a-z]?\b/i.test(String(value || ""));
}

function isAddressOrStreetQuery(value = "") {
  const q = String(value || "").trim();
  if (q.length < 2) return false;
  return (
    /\d/.test(q) ||
    /\b(g|g\.|gatv[eė]|pr|pr\.|prospektas|al|al\.|pl|pl\.|kelias)\b/i.test(q) ||
    /^[a-ząčęėįšųūž\s.-]{2,}$/i.test(q)
  );
}

function autocompleteCacheKey(q, limit, query = {}) {
  const lat = Number(query.lat ?? query.latitude);
  const lon = Number(query.lon ?? query.lng ?? query.longitude);
  const bucket =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? `${lat.toFixed(2)},${lon.toFixed(2)}`
      : "no-gps";
  return `autocomplete:v4:${q.toLowerCase().replace(/\s+/g, " ")}:${limit}:${bucket}`;
}

async function safeProvider(name, fn, timeoutMs = 900) {
  let timer = null;

  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${name} timeout ${timeoutMs}ms`)), timeoutMs);
    });
    const results = await Promise.race([Promise.resolve().then(fn), timeout]);
    return {
      name,
      ok: true,
      results: Array.isArray(results) ? results : [],
      error: null,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      results: [],
      error: error?.message || String(error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function compactProviderMeta(providers) {
  return providers.map((p) => ({
    name: p.name,
    ok: p.ok,
    count: p.results.length,
    error: p.error,
  }));
}

function stableAutocompleteResults(items, query, limit) {
  const qHasNumber = hasHouseNumberQuery(query);

  return dedupeResults(rankResults(items, query))
    .sort((a, b) => {
      const aType = String(a.type || "").toLowerCase();
      const bType = String(b.type || "").toLowerCase();
      const aScore = Number(a.score || 0) + (aType === "address" ? 50000 : aType === "street" ? 25000 : 0);
      const bScore = Number(b.score || 0) + (bType === "address" ? 50000 : bType === "street" ? 25000 : 0);
      if (qHasNumber && aType !== bType) {
        if (aType === "address") return -1;
        if (bType === "address") return 1;
      }
      return bScore - aScore;
    })
    .slice(0, limit);
}

async function autocomplete(query = {}) {
  const startedAt = Date.now();
  const q = String(query.q || query.query || query.text || query.search || "").trim();
  const limit = limitValue(query.limit);

  if (q.length < 2) {
    return {
      ok: true,
      query: q,
      count: 0,
      results: [],
      suggestions: [],
      places: [],
      stops: [],
      addresses: [],
      meta: { tookMs: Date.now() - startedAt, instant: true },
    };
  }

  const cacheKey = autocompleteCacheKey(q, limit, query);
  const cached = await getCache(cacheKey);
  if (cached) {
    return {
      ...cached,
      meta: { ...(cached.meta || {}), cached: true, tookMs: Date.now() - startedAt },
    };
  }

  // Official address DB first. For street/address typing this prevents POI/stops
  // from showing "no address" or wrong-city destinations while typing ta/tai/taikos.
  if (isAddressOrStreetQuery(q)) {
    const addressPayload = await searchIndex({
      ...query,
      q,
      limit,
      external: "false",
      includeExternal: "false",
      autocomplete: "true",
      mode: "autocomplete",
    });

    const results = stableAutocompleteResults(addressPayload.results || [], q, limit);
    const payload = {
      ok: true,
      query: q,
      count: results.length,
      results,
      suggestions: results,
      places: results,
      stops: [],
      addresses: results.filter((item) => item.type === "address"),
      meta: {
        ...(addressPayload.meta || {}),
        tookMs: Date.now() - startedAt,
        cached: false,
        instant: true,
        autocomplete: true,
        addressLocalFirst: true,
        strictLocalAddressOnly: true,
      },
    };

    await setCache(cacheKey, payload, AUTOCOMPLETE_CACHE_TTL_SECONDS);
    return payload;
  }

  const providers = await Promise.all([
    safeProvider("meilisearch", () => searchMeili(q, { limit: limit * 2 }), 700),
    safeProvider("local_address", () => searchLocalAddresses(q, { limit }), 700),
    safeProvider("local_poi", () => searchLocalPoi(q, { limit }), 120),
    safeProvider("gtfs_stops", () => searchGtfsStops(q, { limit }), 120),
  ]);

  const combined = providers.flatMap((p) => p.results);
  const hasStrongLocal = combined.some((item) => Number(item.score || 0) >= 450);
  const shouldUseGoogle = envBool("SEARCH_AUTOCOMPLETE_GOOGLE_FALLBACK", false) && !hasStrongLocal;

  if (shouldUseGoogle) {
    providers.push(await safeProvider("google_places", () => searchGooglePlaces(q, { limit }), 1800));
  }

  const ranked = stableAutocompleteResults(providers.flatMap((p) => p.results), q, limit);

  const payload = {
    ok: true,
    query: q,
    count: ranked.length,
    results: ranked,
    suggestions: ranked,
    places: ranked.filter((item) => item.type !== "stop"),
    stops: ranked.filter((item) => item.type === "stop"),
    addresses: ranked.filter((item) => item.type === "address"),
    meta: {
      tookMs: Date.now() - startedAt,
      cached: false,
      instant: true,
      autocomplete: true,
      providers: compactProviderMeta(providers),
    },
  };

  await setCache(cacheKey, payload, AUTOCOMPLETE_CACHE_TTL_SECONDS);
  return payload;
}

module.exports = { autocomplete };
