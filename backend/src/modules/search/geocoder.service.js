const { normalizeText } = require("./searchnormalizer");

const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const NOMINATIM_URL =
  process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";
const DEFAULT_LIMIT = 6;

const cache = new Map();

function cacheKey(query, limit) {
  return `${normalizeText(query)}::${limit}`;
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function isLikelyAddressQuery(query) {
  const q = normalizeText(query).replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  if (!q || q.length < 3) return false;

  // House numbers, Lithuanian street suffixes and common Klaipėda region names.
  // Examples: "Taikos 32A", "Taikos pr 32", "H Manto g 5", "Liepų 10".
  return (
    /\d+[a-z]?/i.test(q) ||
    /(g|gatve|g\.|pr|pr\.|prospektas|prospekt|pl|pl\.|al|al\.)/.test(q) ||
    /(klaipeda|klaipėda|radail|kreting|palang|gargzd|gargžd|smiltyn|liepu|liepų|taikos|manto|minijos|tilzes|tilžes|debesu|debesų)/.test(q)
  );
}

function mapNominatimItem(item, index) {
  const latitude = toNumber(item.lat);
  const longitude = toNumber(item.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const address = item.address || {};
  const title =
    address.amenity ||
    address.shop ||
    address.tourism ||
    address.building ||
    address.road ||
    address.village ||
    address.town ||
    address.city ||
    String(item.name || item.display_name || "Vieta").split(",")[0];

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    "Klaipėdos regionas";
  const road = address.road;
  const house = address.house_number;
  const subtitle =
    [road && house ? `${road} ${house}` : road, city]
      .filter(Boolean)
      .join(", ") ||
    item.display_name ||
    "Adresas";
  const osmClass = String(item.class || "").toLowerCase();
  const osmType = String(item.type || "").toLowerCase();

  let type = "address";
  if (
    osmClass === "place" &&
    ["city", "town", "village", "suburb", "hamlet"].includes(osmType)
  )
    type = osmType === "city" || osmType === "town" ? "city" : "region";
  if (["amenity", "shop", "tourism", "leisure"].includes(osmClass))
    type = "poi";

  return {
    id: `geocoder-${item.osm_type || "osm"}-${item.osm_id || index}`,
    title: String(title).trim(),
    name: String(title).trim(),
    subtitle,
    type,
    source: "geocoder",
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    distanceMeters:
      item.distanceMeters != null ? Number(item.distanceMeters) : undefined,
    keywords: [
      item.display_name,
      road,
      city,
      address.suburb,
      address.neighbourhood,
    ].filter(Boolean),
    rawType: item.type,
  };
}

async function geocode(query, options = {}) {
  const clean = String(query || "").trim();
  const limit = Math.min(
    Math.max(Number(options.limit || DEFAULT_LIMIT), 1),
    10,
  );

  if (!isLikelyAddressQuery(clean)) return [];

  const key = cacheKey(clean, limit);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS)
    return cached.results;

  if (typeof fetch !== "function") return [];

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(process.env.GEOCODER_TIMEOUT_MS || 1500),
  );

  try {
    const params = new URLSearchParams({
      q: clean.match(
        /klaipėda|klaipeda|kretinga|palanga|gargždai|gargzdai|radailiai|smiltynė|smiltyne/i,
      )
        ? clean
        : `${clean}, Klaipėdos apskritis, Lietuva`,
      format: "jsonv2",
      addressdetails: "1",
      limit: String(limit),
      countrycodes: "lt",
      bounded: "0",
      viewbox: "20.75,56.05,21.55,55.55",
    });

    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          process.env.NOMINATIM_USER_AGENT || "Arbebus/1.0 contact@arbebus.com",
        Accept: "application/json",
      },
    });

    if (!response.ok) return [];
    const data = await response.json();
    const results = Array.isArray(data)
      ? data.map(mapNominatimItem).filter(Boolean)
      : [];
    cache.set(key, { savedAt: Date.now(), results });
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { geocode, isLikelyAddressQuery };
