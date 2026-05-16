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
  // For short typing like ta/tai/taikos, address prefix must win over POI spam.
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
    const ap = String(a.type || "") === "address" ? 1 : 0;
    const bp = String(b.type || "") === "address" ? 1 : 0;
    if (bp !== ap) return bp - ap;
    const as = Number(a.score || 0) + Number(a.priority || 0);
    const bs = Number(b.score || 0) + Number(b.priority || 0);
    return bs - as;
  });
}

async function autocomplete(query = {}) {
  const startedAt = Date.now();
  const q = String(query.q || query.query || query.text || query.search || "").trim();
  const limit = limitValue(query.limit);

  if (q.length < 2) {
    return { ok: true, query: q, count: 0, results: [], suggestions: [], places: [], stops: [], addresses: [], meta: { tookMs: Date.now() - startedAt, autocomplete: true } };
  }

  const cacheKey = `autocomplete-v20:${normalizeText(q)}:${limit}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return { ...cached, meta: { ...(cached.meta || {}), cached: true, tookMs: Date.now() - startedAt } };
  }

  const addressAutocomplete = isAddressAutocompleteQuery(q);
  const addressTimeout = Number(process.env.SEARCH_AUTOCOMPLETE_ADDRESS_TIMEOUT_MS || 3000);

  // Apple Maps rule: while typing street/address text, addresses are the primary source.
  // POI/stops are allowed only if no address exists at all.
  const localAddress = await safeProvider(
    "local_address",
    () => searchLocalAddresses(q, { limit: Math.max(limit, 10), autocomplete: true }),
    addressTimeout,
  );

  let providers = [localAddress];
  let ranked = addressFirst(dedupeResults(rankResults(localAddress.results, q))).slice(0, limit);

  if (!addressAutocomplete || ranked.length === 0) {
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

    ranked = addressFirst(dedupeResults(rankResults(providers.flatMap((p) => p.results), q))).slice(0, limit);
  }

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
      autocomplete: true,
      addressAutocompleteOnly: addressAutocomplete,
      providers: providers.map((p) => ({ name: p.name, ok: p.ok, count: p.results.length, error: p.error })),
    },
  };

  await setCache(cacheKey, payload, 120);
  return payload;
}

module.exports = { autocomplete };
