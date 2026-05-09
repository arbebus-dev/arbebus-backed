const { normalizeText } = require("./utils/normalizeText");
const { rankResults, dedupeResults } = require("./utils/rankSearchResults");
const { getCache, setCache, cacheStats } = require("./cache/searchCache");
const {
  searchLocalPoi,
  localPoiHealth,
} = require("./providers/localPoi.provider");
const {
  searchNominatim,
  reverseNominatim,
} = require("./providers/nominatim.provider");
const { searchOverpass } = require("./providers/overpass.provider");
const {
  searchGooglePlaces,
  getGooglePlaceDetails,
  searchNearbyGooglePlaces,
  getGooglePhotoMediaUrl,
} = require("./providers/googlePlaces.provider");
const {
  searchGtfsStops,
  gtfsHealth,
  loadGtfsStops,
} = require("./providers/gtfsStops.provider");
const { searchFastIndex, searchIndexHealth } = require("./index/searchIndex");
const {
  searchLocalAddresses,
  localAddressHealth,
} = require("./providers/localAddress.provider");

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

function limitValue(value) {
  return Math.min(Math.max(Number(value || DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return String(v).toLowerCase() === "true";
}

async function runProvider(name, fn, timeoutMs = 1600) {
  try {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`provider timeout ${timeoutMs}ms`)),
        timeoutMs,
      );
    });
    const results = await Promise.race([Promise.resolve().then(fn), timeout]);
    if (timer) clearTimeout(timer);
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
  }
}

function searchCacheKey(q, type, limit) {
  return `v4:${normalizeText(q)}:${String(type || "all").toLowerCase()}:${Number(limit || DEFAULT_LIMIT)}`;
}

function isAddressLikeQuery(value = "") {
  const q = String(value || "").trim();
  return (
    /\d/.test(q) ||
    /\b(g|g\.|gatv[eė]|pr|pr\.|prospektas|al|al\.|pl|pl\.|kelias)\b/i.test(q) ||
    q.split(/\s+/).length >= 2
  );
}

function shouldUseExternalSearch(query = {}) {
  const explicit = String(
    query.external ?? query.includeExternal ?? "",
  ).toLowerCase();
  if (explicit === "false" || explicit === "0") return false;
  if (explicit === "true" || explicit === "1") return true;

  const q = String(
    query.q || query.query || query.text || query.search || "",
  ).trim();

  // Address search must not depend on stops/POI cache. Without this fallback,
  // queries like "Taikos 32" or "Laivų g." return only GTFS stops.
  if (q.length >= 3 && isAddressLikeQuery(q)) return true;

  return envBool("SEARCH_EXTERNAL_ENABLED", false);
}

function hasHouseNumberQuery(value = "") {
  return /\b\d+[a-z]?\b/i.test(String(value || ""));
}

function isStreetOnlyQuery(value = "") {
  return isAddressLikeQuery(value) && !hasHouseNumberQuery(value);
}

function filterUnsafeSearchResults(items, query) {
  const streetOnly = isStreetOnlyQuery(query);
  const addressWithNumber = hasHouseNumberQuery(query);

  if (!streetOnly && !addressWithNumber) return items;

  return items.filter((item) => {
    const type = String(item.type || "").toLowerCase();

    // For address-like search, random stops/cities/villages must not outrank
    // real street/address suggestions. This prevents "Taikos pr 8" -> Radailiai.
    if (["city", "region", "village"].includes(type)) return false;
    if (
      type === "stop" &&
      !/\b(st|stotele|stotis|bus|autobus)\b/i.test(String(query))
    )
      return false;

    if (streetOnly)
      return ["street", "address", "poi", "station", "ferry"].includes(type);
    if (addressWithNumber)
      return ["address", "street", "poi", "station", "ferry"].includes(type);

    return true;
  });
}

function compactProviderMeta(providers) {
  return providers.map((p) => ({
    name: p.name,
    ok: p.ok,
    count: p.results.length,
    error: p.error,
  }));
}

async function index(query = {}) {
  const startedAt = Date.now();
  const q = String(
    query.q || query.query || query.text || query.search || "",
  ).trim();
  const type = String(query.type || "all").toLowerCase();
  const limit = limitValue(query.limit);
  const nq = normalizeText(q);

  if (nq.length < 2) {
    return {
      ok: true,
      query: q,
      count: 0,
      results: [],
      places: [],
      stops: [],
      addresses: [],
      meta: healthMeta(),
    };
  }

  const cacheKey = searchCacheKey(q, type, limit);
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

  // Apple Maps style: first answer from in-memory/local sources.
  // Local address fallback is mandatory, because Google/OSM can return 0 or be rate-limited.
  const [fastIndex, localAddress] = await Promise.all([
    runProvider(
      "fast_local_index",
      () => searchFastIndex(q, { limit: Math.max(18, limit) }),
      120,
    ),
    runProvider(
      "local_address",
      () => searchLocalAddresses(q, { limit: Math.max(8, limit) }),
      80,
    ),
  ]);

  let combined = [...localAddress.results, ...fastIndex.results];
  const providers = [localAddress, fastIndex];

  const rankedFast = rankResults(dedupeResults(combined), q);
  const hasStrongFastResult = rankedFast.some(
    (item) => Number(item.score || 0) >= 360,
  );
  const addressLike = isAddressLikeQuery(q);
  const includeExternal = shouldUseExternalSearch(query);

  if (includeExternal && (addressLike || !hasStrongFastResult)) {
    const [google, nominatim, overpass] = await Promise.all([
      runProvider(
        "google_places",
        () => searchGooglePlaces(q, { limit: 8 }),
        1200,
      ),
      runProvider("nominatim", () => searchNominatim(q, { limit: 8 }), 1200),
      runProvider("overpass", () => searchOverpass(q, { limit: 6 }), 900),
    ]);
    providers.push(google, nominatim, overpass);
    combined = [
      ...combined,
      ...google.results,
      ...nominatim.results,
      ...overpass.results,
    ];
  }

  if (type !== "all") combined = combined.filter((item) => item.type === type);

  const ranked = rankResults(dedupeResults(combined), q);
  const safeRanked = filterUnsafeSearchResults(ranked, q);
  const results = dedupeResults(safeRanked).slice(0, limit);

  const payload = {
    ok: true,
    query: q,
    count: results.length,
    results,
    places: results.filter((item) => item.type !== "stop"),
    stops: results.filter((item) => item.type === "stop"),
    addresses: results.filter((item) => item.type === "address"),
    meta: {
      ...healthMeta(),
      cached: false,
      instant: true,
      externalEnabled: includeExternal,
      externalSkipped:
        !includeExternal || (!addressLike && hasStrongFastResult),
      tookMs: Date.now() - startedAt,
      providers: compactProviderMeta(providers),
    },
  };

  await setCache(cacheKey, payload, 300);
  return payload;
}

async function debug(query = {}) {
  const payload = await index({ ...query, limit: query.limit || 20 });
  return {
    ...payload,
    debug: {
      firstType: payload.results[0]?.type || null,
      firstSource: payload.results[0]?.source || null,
      expectedPriority:
        "exact local_poi > address/city from nominatim > overpass/google > gtfs stop fallback",
    },
  };
}

async function stops(query = {}) {
  const q = String(
    query.q || query.query || query.text || query.search || "",
  ).trim();
  const results = await searchGtfsStops(q, { limit: limitValue(query.limit) });
  return {
    ok: true,
    query: q,
    count: results.length,
    results,
    places: results,
    stops: results,
    meta: healthMeta(),
  };
}

function healthMeta() {
  return {
    module: "dynamic_search",
    env: {
      ORS_API_KEY: Boolean(process.env.ORS_API_KEY),
      GOOGLE_PLACES_API_KEY: Boolean(process.env.GOOGLE_PLACES_API_KEY),
      SEARCH_PROVIDER_GOOGLE_ACTIVE:
        Boolean(process.env.GOOGLE_PLACES_API_KEY) &&
        String(
          process.env.SEARCH_PROVIDER_GOOGLE_ENABLED || "true",
        ).toLowerCase() !== "false",
      SEARCH_PROVIDER_OSM_ENABLED: envBool("SEARCH_PROVIDER_OSM_ENABLED", true),
      SEARCH_PROVIDER_OVERPASS_ENABLED: envBool(
        "SEARCH_PROVIDER_OVERPASS_ENABLED",
        true,
      ),
      SEARCH_PROVIDER_GOOGLE_ENABLED: envBool(
        "SEARCH_PROVIDER_GOOGLE_ENABLED",
        false,
      ),
      SEARCH_CACHE_TTL_SECONDS: process.env.SEARCH_CACHE_TTL_SECONDS || "86400",
      SEARCH_REGION_LAT: process.env.SEARCH_REGION_LAT || "55.7033",
      SEARCH_REGION_LNG: process.env.SEARCH_REGION_LNG || "21.1443",
      SEARCH_REGION_RADIUS_METERS:
        process.env.SEARCH_REGION_RADIUS_METERS || "55000",
    },
    ...localAddressHealth(),
    ...localPoiHealth(),
    ...gtfsHealth(),
    ...searchIndexHealth(),
    cache: cacheStats(),
  };
}

async function reverse(query = {}) {
  const latitude = Number(query.lat ?? query.latitude);
  const longitude = Number(query.lng ?? query.lon ?? query.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      ok: false,
      error: "lat/lng required",
      place: null,
      result: null,
      meta: healthMeta(),
    };
  }

  const fallback = {
    id: `map-${latitude.toFixed(6)}-${longitude.toFixed(6)}`,
    type: "address",
    title: "Pasirinkta vieta",
    name: "Pasirinkta vieta",
    subtitle: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    source: "map_tap",
    score: 1,
    priority: 0,
    keywords: [],
  };

  const googleNearby = await runProvider("google_nearby", () =>
    searchNearbyGooglePlaces(latitude, longitude, { limit: 3 }),
  );
  let result = googleNearby.results[0] || null;

  const nominatim = !result
    ? await runProvider("nominatim_reverse", async () => {
        const item = await reverseNominatim(latitude, longitude, {
          zoom: query.zoom || 18,
        });
        return item ? [item] : [];
      })
    : { name: "nominatim_reverse", ok: true, results: [], error: null };

  if (!result) result = nominatim.results[0] || null;
  if (!result) result = fallback;

  result = {
    ...fallback,
    ...result,
    latitude: Number(result.latitude ?? latitude),
    longitude: Number(result.longitude ?? longitude),
    coordinate: result.coordinate || {
      latitude: Number(result.latitude ?? latitude),
      longitude: Number(result.longitude ?? longitude),
    },
    source: result.source || "reverse",
  };

  return {
    ok: true,
    query: { latitude, longitude },
    result,
    place: result,
    results: [result],
    meta: {
      ...healthMeta(),
      providers: [
        {
          name: googleNearby.name,
          ok: googleNearby.ok,
          count: googleNearby.results.length,
          error: googleNearby.error,
        },
        {
          name: nominatim.name,
          ok: nominatim.ok,
          count: nominatim.results.length,
          error: nominatim.error,
        },
      ],
    },
  };
}

async function details(query = {}) {
  const placeId = String(
    query.placeId || query.id || query.googlePlaceId || "",
  ).trim();
  if (!placeId) {
    return {
      ok: false,
      error: "placeId required",
      result: null,
      place: null,
      meta: healthMeta(),
    };
  }

  const google = await runProvider("google_details", async () => {
    const result = await getGooglePlaceDetails(placeId);
    return result ? [result] : [];
  });

  const result = google.results[0] || null;
  return {
    ok: Boolean(result),
    placeId,
    result,
    place: result,
    results: result ? [result] : [],
    meta: {
      ...healthMeta(),
      providers: [
        {
          name: google.name,
          ok: google.ok,
          count: google.results.length,
          error: google.error,
        },
      ],
    },
  };
}

async function photo(query = {}) {
  const name = String(query.name || "").trim();
  const maxWidthPx =
    query.maxWidthPx ||
    query.max_width_px ||
    process.env.GOOGLE_PLACES_PHOTO_MAX_WIDTH ||
    900;
  if (!name) return { ok: false, error: "name required", url: null };
  const url = await getGooglePhotoMediaUrl(name, maxWidthPx);
  return { ok: Boolean(url), url };
}

function health() {
  return {
    ok: true,
    routes: [
      "/api/search",
      "/api/search/debug",
      "/api/search/health",
      "/api/search/stops",
      "/api/search/reverse",
      "/api/search/details",
      "/api/search/photo",
    ],
    meta: healthMeta(),
  };
}

function allStops() {
  return loadGtfsStops();
}

function findNearestStop(input) {
  const latitude = Number(input?.latitude ?? input?.lat);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const R = 6371000;
  const distance = (a, b) => {
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
  };
  return (
    loadGtfsStops()
      .map((s) => ({
        ...s,
        distanceMeters: distance({ latitude, longitude }, s),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null
  );
}

module.exports = {
  index,
  debug,
  reverse,
  details,
  photo,
  stops,
  health,
  healthMeta,
  allStops,
  findNearestStop,
  normalizeText,
};
