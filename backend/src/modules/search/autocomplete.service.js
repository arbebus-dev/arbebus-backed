/* eslint-env node */
const { rankResults, dedupeResults } = require("./utils/rankSearchResults");
const { normalizeText } = require("./utils/normalizeText");
const { getCache, setCache } = require("./cache/searchCache");
const { searchMeili } = require("./providers/meili.provider");
const { searchLocalAddresses } = require("./providers/localAddress.provider");
const { searchLocalPoi } = require("./providers/localPoi.provider");
const { searchGtfsStops } = require("./providers/gtfsStops.provider");
const { searchGooglePlaces } = require("./providers/googlePlaces.provider");

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

function isAddressAutocompleteQuery(value = "") {
  const q = normalizeText(value).trim();
  if (q.length < 2) return false;
  if (hasHouseNumberQuery(q)) return true;
  if (/\b(g|g\.|gatv[eė]|pr|pr\.|prospektas|al|al\.|pl|pl\.|kelias)\b/i.test(String(value))) return true;
  // Apple Maps behavior: while the user types letters, try address prefix first.
  // POI fallback is used only when no street/address exists.
  return /^[a-ząčęėįšųūž\s.-]+$/i.test(String(value || ""));
}

async function safeProvider(name, fn, timeoutMs = 900) {
  let timer = null;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`provider timeout ${timeoutMs}ms`)), timeoutMs);
    });
    const results = await Promise.race([Promise.resolve().then(fn), timeout]);
    return { name, ok: true, results: Array.isArray(results) ? results : [], error: null };
  } catch (error) {
    return { name, ok: false, results: [], error: error?.message || String(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function addressFirst(items) {
  return [...items].sort((a, b) => {
    const aType = String(a.type || "").toLowerCase();
    const bType = String(b.type || "").toLowerCase();
    const aAddress = aType === "address" ? 1 : 0;
    const bAddress = bType === "address" ? 1 : 0;
    if (bAddress !== aAddress) return bAddress - aAddress;

    const aSelectable = a.selectable === true ? 1 : 0;
    const bSelectable = b.selectable === true ? 1 : 0;
    if (bSelectable !== aSelectable) return bSelectable - aSelectable;

    const as = Number(a.score || 0) + Number(a.priority || 0);
    const bs = Number(b.score || 0) + Number(b.priority || 0);
    if (bs !== as) return bs - as;

    return String(a.title || "").localeCompare(String(b.title || ""), "lt");
  });
}

function responsePayload({ q, ranked, providers, startedAt, addressAutocomplete, cached = false }) {
  return {
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
      cached,
      autocomplete: true,
      addressAutocompleteOnly: addressAutocomplete,
      addressFirst: true,
      poiFallbackOnlyWhenNoAddress: true,
      providers: providers.map((p) => ({ name: p.name, ok: p.ok, count: p.results.length, error: p.error })),
    },
  };
}

async function autocomplete(query = {}) {
  const startedAt = Date.now();
  const q = String(query.q || query.query || query.text || query.search || "").trim();
  const limit = limitValue(query.limit);

  if (q.length < 2) {
    return responsePayload({ q, ranked: [], providers: [], startedAt, addressAutocomplete: false });
  }

  const addressAutocomplete = isAddressAutocompleteQuery(q);
  const cacheKey = `autocomplete-v100:${normalizeText(q)}:${limit}:${addressAutocomplete ? "addr" : "mixed"}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return { ...cached, meta: { ...(cached.meta || {}), cached: true, tookMs: Date.now() - startedAt } };
  }

  const addressTimeout = Number(process.env.SEARCH_AUTOCOMPLETE_ADDRESS_TIMEOUT_MS || 10000);
  const localAddress = await safeProvider(
    "local_address",
    () => searchLocalAddresses(q, { limit: Math.max(limit, 10), autocomplete: true }),
    addressTimeout,
  );

  let providers = [localAddress];
  let rankedAddresses = addressFirst(dedupeResults(rankResults(localAddress.results, q))).slice(0, limit);

  // FINAL APPLE MAPS RULE:
  // For address-like typing (ta/tai/taikos/taikos 13), never show POI above addresses.
  // If addresses exist, return only addresses immediately.
  if (addressAutocomplete && rankedAddresses.length > 0) {
    const payload = responsePayload({ q, ranked: rankedAddresses, providers, startedAt, addressAutocomplete });
    await setCache(cacheKey, payload, 120);
    return payload;
  }

  const [meili, localPoi, gtfsStops] = await Promise.all([
    safeProvider("meilisearch", () => searchMeili(q, { limit: limit * 2 }), 900),
    safeProvider("local_poi", () => searchLocalPoi(q, { limit }), 160),
    safeProvider("gtfs_stops", () => searchGtfsStops(q, { limit }), 160),
  ]);

  providers = [localAddress, meili, localPoi, gtfsStops];
  const combined = [
    ...localAddress.results,
    ...meili.results,
    ...localPoi.results,
    ...gtfsStops.results,
  ];

  const hasStrongLocal = combined.some((item) => Number(item.score || 0) >= 450);
  const shouldUseGoogle = envBool("SEARCH_AUTOCOMPLETE_GOOGLE_FALLBACK", false) && !hasStrongLocal;

  if (shouldUseGoogle) {
    providers.push(await safeProvider("google_places", () => searchGooglePlaces(q, { limit }), 2200));
  }

  const ranked = addressFirst(dedupeResults(rankResults(providers.flatMap((p) => p.results), q))).slice(0, limit);
  const payload = responsePayload({ q, ranked, providers, startedAt, addressAutocomplete });
  await setCache(cacheKey, payload, 120);
  return payload;
}

module.exports = { autocomplete };
