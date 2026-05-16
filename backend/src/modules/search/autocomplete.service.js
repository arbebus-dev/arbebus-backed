/* eslint-env node */
const { normalizeText } = require("./utils/normalizeText");
const { getCache, setCache } = require("./cache/searchCache");
const { searchLocalAddresses } = require("./providers/localAddress.provider");

function limitValue(value) {
  return Math.min(Math.max(Number(value || 8), 1), 12);
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
      addressAutocompleteOnly: true,
      addressFirst: true,
      localAddressOnly: true,
      noProviderTimeout: true,
      strictPrefixOnly: true,
      ultraFastLookup: true,
      poiDisabledForAutocomplete: true,
      searchServiceVersion: "ultra-fast-lookup-v140",
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

  const cacheKey = `autocomplete-local-only-ultra-v140:${normalizeText(q)}:${limit}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return {
      ...cached,
      meta: {
        ...(cached.meta || {}),
        cached: true,
        tookMs: Date.now() - startedAt,
      },
    };
  }

  // FINAL RULE: autocomplete uses ONLY the Lithuania local geocoder.
  // No meili, no POI, no stops, no OSM/Google. This fixes Slengiai/Radailiai/Nida/Laivų.
  const ranked = await searchLocalAddresses(q, {
    limit: Math.max(limit, 10),
    autocomplete: true,
    lat: query.lat ?? query.latitude,
    lon: query.lon ?? query.lng ?? query.longitude,
  });

  const payload = responsePayload({ q, ranked: ranked.slice(0, limit), startedAt });
  await setCache(cacheKey, payload, 120);
  return payload;
}

module.exports = { autocomplete };
