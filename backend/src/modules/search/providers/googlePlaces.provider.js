const { normalizeText } = require("../utils/normalizeText");
const { getCache, setCache } = require("../cache/searchCache");
const { toResult } = require("../utils/mapSearchResult");

const GOOGLE_BASE = "https://places.googleapis.com/v1";

function enabled() {
  const flag = process.env.SEARCH_PROVIDER_GOOGLE_ENABLED;
  const hasKey = Boolean(process.env.GOOGLE_PLACES_API_KEY);
  if (!hasKey) return false;
  if (flag == null || flag === "") return true;
  return String(flag).toLowerCase() !== "false";
}

function languageCode() {
  return process.env.GOOGLE_PLACES_LANGUAGE || "lt";
}

function regionCode() {
  return process.env.GOOGLE_PLACES_REGION || "LT";
}

function timeoutMs() {
  return Math.min(
    Math.max(Number(process.env.GOOGLE_PLACES_DETAILS_TIMEOUT_MS || 3500), 1000),
    7000,
  );
}

async function fetchGoogle(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function photoProxyUrl(photoName) {
  if (!photoName) return null;
  return `/api/search/photo?name=${encodeURIComponent(photoName)}&maxWidthPx=${encodeURIComponent(
    process.env.GOOGLE_PLACES_PHOTO_MAX_WIDTH || "900",
  )}`;
}

function normalizeCategory(types = []) {
  const first = Array.isArray(types) ? types[0] : null;
  if (!first) return null;
  return String(first).replace(/_/g, " ");
}

function openNowText(place) {
  const open =
    place?.currentOpeningHours?.openNow ?? place?.regularOpeningHours?.openNow;
  if (open === true) return "Atidaryta dabar";
  if (open === false) return "Uždaryta dabar";
  return null;
}

function hoursFromPlace(place) {
  const weekday =
    place?.currentOpeningHours?.weekdayDescriptions ||
    place?.regularOpeningHours?.weekdayDescriptions ||
    [];
  return Array.isArray(weekday) ? weekday.slice(0, 7) : [];
}

function googleSearchQueries(query) {
  const q = String(query || "").replace(/\s{2,}/g, " ").trim();
  const variants = [
    q,
    `${q} Klaipėda Lithuania`,
    `${q} Klaipeda Lithuania`,
    `${q} Klaipėda Lietuva`,
    `${q} Lithuania`,
  ]
    .map((item) => item.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  return Array.from(new Set(variants));
}


function hasHouseNumberQuery(value) {
  return /\b\d+[a-z]?\b/i.test(String(value || ""));
}

function geocodeQueries(query) {
  const q = String(query || "").replace(/\s{2,}/g, " ").trim();
  const variants = [
    q,
    `${q}, Klaipėda, Lietuva`,
    `${q}, Klaipeda, Lithuania`,
    `${q}, Klaipėdos m. sav., Lietuva`,
  ];
  return Array.from(new Set(variants.map((item) => item.trim()).filter(Boolean)));
}

function mapGeocodeResult(item, index, originalQuery) {
  const loc = item?.geometry?.location || {};
  const latitude = Number(loc.lat);
  const longitude = Number(loc.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const components = Array.isArray(item.address_components)
    ? item.address_components
    : [];
  const component = (type) =>
    components.find((part) => Array.isArray(part.types) && part.types.includes(type));
  const road = component("route")?.long_name || null;
  const house = component("street_number")?.long_name || null;
  const city =
    component("locality")?.long_name ||
    component("postal_town")?.long_name ||
    component("administrative_area_level_2")?.long_name ||
    "Klaipėda";

  const title = road && house ? `${road} ${house}` : item.formatted_address || originalQuery;
  const locationType = String(item?.geometry?.location_type || "").toUpperCase();
  const precisionBoost =
    locationType === "ROOFTOP" ? 900 :
    locationType === "RANGE_INTERPOLATED" ? 720 :
    locationType === "GEOMETRIC_CENTER" ? 420 : 320;

  return toResult({
    id: item.place_id || `google-geocode-${index}`,
    type: house ? "address" : "street",
    title,
    name: title,
    subtitle: item.formatted_address || [title, city, "Lietuva"].filter(Boolean).join(", "),
    latitude,
    longitude,
    source: "google_geocoding",
    category: "address",
    priority: precisionBoost,
    score: precisionBoost,
    selectable: Boolean(house),
    requiresHouseNumber: !house,
    keywords: [title, item.formatted_address, road, house, city, originalQuery].filter(Boolean),
    raw: item,
  });
}

async function geocodeAddress(query, limit) {
  if (!enabled() || typeof fetch !== "function") return [];
  if (!hasHouseNumberQuery(query)) return [];

  const key = `google:geocode:v2:${normalizeText(query)}:${limit}:${languageCode()}`;
  const cached = await getCache(key);
  if (Array.isArray(cached) && cached.length) return cached;

  const results = [];
  const errors = [];

  for (const address of geocodeQueries(query)) {
    const params = new URLSearchParams({
      address,
      key: process.env.GOOGLE_PLACES_API_KEY || "",
      language: languageCode(),
      region: regionCode().toLowerCase(),
      components: "country:LT",
      bounds: "55.60,21.05|55.80,21.30",
    });

    try {
      const response = await fetchGoogle(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
      if (!response.ok) continue;
      const json = await response.json();
      if (json.status && !["OK", "ZERO_RESULTS"].includes(json.status)) {
        errors.push(`${json.status}: ${json.error_message || ""}`.trim());
        continue;
      }
      const mapped = (json.results || [])
        .map((item, index) => mapGeocodeResult(item, index, query))
        .filter(Boolean);
      results.push(...mapped);
      if (mapped.some((item) => item.type === "address")) break;
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  const unique = [];
  const seen = new Set();
  for (const item of results) {
    const keyPart = `${item.title}|${Number(item.latitude).toFixed(6)}|${Number(item.longitude).toFixed(6)}`.toLowerCase();
    if (seen.has(keyPart)) continue;
    seen.add(keyPart);
    unique.push(item);
  }

  if (unique.length) await setCache(key, unique.slice(0, limit));
  if (!unique.length && errors.length && process.env.DEBUG_SEARCH === "true") {
    console.warn("Google geocoding failed", errors.join(" | "));
  }
  return unique.slice(0, limit);
}

function enrich(base, place) {
  if (!base || !place) return base;

  const photos = Array.isArray(place.photos)
    ? place.photos
        .slice(0, 6)
        .map((photo) => ({
          name: photo.name,
          widthPx: photo.widthPx,
          heightPx: photo.heightPx,
          authorAttributions: photo.authorAttributions || [],
          url: photoProxyUrl(photo.name),
        }))
        .filter((photo) => photo.name)
    : [];

  return {
    ...base,
    id: place.id || base.id,
    placeId: place.id || base.placeId || base.id,
    googlePlaceId: place.id || base.googlePlaceId || base.id,
    category: normalizeCategory(place.types) || base.category,
    rating: place.rating != null ? Number(place.rating) : base.rating,
    userRatingCount:
      place.userRatingCount != null
        ? Number(place.userRatingCount)
        : base.userRatingCount,
    openNow:
      place?.currentOpeningHours?.openNow ??
      place?.regularOpeningHours?.openNow ??
      base.openNow,
    openNowText: openNowText(place) || base.openNowText,
    openingHours: hoursFromPlace(place),
    photos,
    photoUrls: photos.map((p) => p.url).filter(Boolean),
    phone:
      place.nationalPhoneNumber || place.internationalPhoneNumber || base.phone,
    website: place.websiteUri || base.website,
    googleMapsUri: place.googleMapsUri || base.googleMapsUri,
    raw: place,
  };
}


function hasHouseNumberText(value) {
  return /\b\d+[a-z]?\b/i.test(String(value || ""));
}

function inferGooglePlaceType(place) {
  const types = Array.isArray(place?.types) ? place.types.map((t) => String(t).toLowerCase()) : [];
  const text = `${place?.displayName?.text || ""} ${place?.formattedAddress || ""}`;

  if (
    types.includes("street_address") ||
    types.includes("premise") ||
    types.includes("subpremise") ||
    hasHouseNumberText(text)
  ) {
    return "address";
  }

  if (types.includes("route")) return "street";
  if (types.includes("locality") || types.includes("postal_town")) return "city";
  if (types.includes("administrative_area_level_1") || types.includes("administrative_area_level_2")) return "region";
  if (types.includes("transit_station") || types.includes("bus_station")) return "station";

  return "poi";
}

function mapPlace(place, index) {
  const loc = place.location || {};
  const latitude = Number(loc.latitude);
  const longitude = Number(loc.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const title =
    place.displayName?.text ||
    place.displayName?.name ||
    place.name ||
    place.formattedAddress ||
    "Vieta";

  const base = toResult({
    id: place.id || `google-${index}`,
    type: inferGooglePlaceType(place),
    title,
    name: title,
    subtitle: place.formattedAddress || "Klaipėda, Lietuva",
    latitude,
    longitude,
    source: "google_places",
    category: Array.isArray(place.types) ? place.types[0] : "place",
    keywords: [
      title,
      place.formattedAddress,
      ...(Array.isArray(place.types) ? place.types : []),
    ].filter(Boolean),
    selectable: true,
    requiresHouseNumber: false,
    raw: place,
  });

  return enrich(base, place);
}

async function searchTextOnce(textQuery, limit) {
  const response = await fetchGoogle(`${GOOGLE_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.types",
        "places.rating",
        "places.userRatingCount",
        "places.currentOpeningHours",
        "places.photos",
        "places.googleMapsUri",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: limit,
      languageCode: languageCode(),
      regionCode: regionCode(),
      locationBias: {
        circle: {
          center: {
            latitude: Number(process.env.SEARCH_REGION_LAT || 55.7033),
            longitude: Number(process.env.SEARCH_REGION_LNG || 21.1443),
          },
          radius: Math.min(
            Math.max(Number(process.env.SEARCH_REGION_RADIUS_METERS || 50000), 1000),
            50000,
          ),
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Google Places searchText HTTP ${response.status}: ${message.slice(0, 500)}`,
    );
  }

  const json = await response.json();
  return (json.places || []).map(mapPlace).filter(Boolean);
}

async function searchGooglePlaces(query, options = {}) {
  if (!enabled() || typeof fetch !== "function") return [];

  const q = String(query || "").trim();
  const nq = normalizeText(q);
  if (nq.length < 3) return [];

  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 10);
  const key = `google:text:v3:${nq}:${limit}:${languageCode()}:${regionCode()}`;
  const cached = await getCache(key);
  if (Array.isArray(cached) && cached.length) return cached;

  const errors = [];
  const geocoded = await geocodeAddress(q, limit).catch((error) => {
    errors.push(error?.message || String(error));
    return [];
  });

  if (geocoded.length) {
    const textResults = [];
    for (const textQuery of googleSearchQueries(q).slice(0, 2)) {
      try {
        textResults.push(...(await searchTextOnce(textQuery, limit)));
      } catch (error) {
        errors.push(error?.message || String(error));
      }
    }
    const combined = [...geocoded, ...textResults].slice(0, limit);
    await setCache(key, combined);
    return combined;
  }

  for (const textQuery of googleSearchQueries(q)) {
    try {
      const results = await searchTextOnce(textQuery, limit);
      if (results.length) {
        await setCache(key, results);
        return results;
      }
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  if (errors.length) throw new Error(errors.join(" | "));
  return [];
}

async function getGooglePlaceDetails(placeId) {
  if (!enabled() || typeof fetch !== "function") return null;

  const id = String(placeId || "").trim();
  if (!id) return null;

  const key = `google:details:v3:${id}:${languageCode()}`;
  const cached = await getCache(key);
  if (cached) return cached;

  try {
    const response = await fetchGoogle(
      `${GOOGLE_BASE}/places/${encodeURIComponent(id)}?languageCode=${encodeURIComponent(
        languageCode(),
      )}&regionCode=${encodeURIComponent(regionCode())}`,
      {
        headers: {
          "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": [
            "id",
            "displayName",
            "formattedAddress",
            "location",
            "types",
            "rating",
            "userRatingCount",
            "currentOpeningHours",
            "regularOpeningHours",
            "photos",
            "nationalPhoneNumber",
            "internationalPhoneNumber",
            "websiteUri",
            "googleMapsUri",
          ].join(","),
        },
      },
    );

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(
        `Google Places details HTTP ${response.status}: ${message.slice(0, 500)}`,
      );
    }

    const place = await response.json();
    const mapped = mapPlace(place, 0);
    await setCache(key, mapped);
    return mapped;
  } catch {
    return null;
  }
}

async function searchNearbyGooglePlaces(latitude, longitude, options = {}) {
  if (!enabled() || typeof fetch !== "function") return [];

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const radius = Math.min(
    Math.max(
      Number(
        options.radiusMeters ||
          process.env.GOOGLE_PLACES_NEARBY_RADIUS_METERS ||
          80,
      ),
      20,
    ),
    300,
  );
  const limit = Math.min(Math.max(Number(options.limit || 3), 1), 5);
  const key = `google:nearby:v3:${lat.toFixed(5)}:${lng.toFixed(5)}:${radius}:${limit}`;
  const cached = await getCache(key);
  if (Array.isArray(cached) && cached.length) return cached;

  try {
    const response = await fetchGoogle(`${GOOGLE_BASE}/places:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.types",
          "places.rating",
          "places.userRatingCount",
          "places.currentOpeningHours",
          "places.photos",
          "places.googleMapsUri",
        ].join(","),
      },
      body: JSON.stringify({
        maxResultCount: limit,
        languageCode: languageCode(),
        regionCode: regionCode(),
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius,
          },
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(
        `Google Places nearby HTTP ${response.status}: ${message.slice(0, 500)}`,
      );
    }

    const json = await response.json();
    const results = (json.places || []).map(mapPlace).filter(Boolean);
    if (results.length) await setCache(key, results);
    return results;
  } catch {
    return [];
  }
}

async function getGooglePhotoMediaUrl(name, maxWidthPx) {
  if (!enabled() || typeof fetch !== "function") return null;

  const photoName = String(name || "").trim();
  if (!photoName || !photoName.startsWith("places/")) return null;

  const width = Math.min(
    Math.max(
      Number(maxWidthPx || process.env.GOOGLE_PLACES_PHOTO_MAX_WIDTH || 900),
      128,
    ),
    1600,
  );

  try {
    const response = await fetchGoogle(
      `${GOOGLE_BASE}/${photoName}/media?maxWidthPx=${width}&skipHttpRedirect=true`,
      {
        headers: { "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY },
      },
    );

    if (!response.ok) return null;
    const json = await response.json();
    return json.photoUri || null;
  } catch {
    return null;
  }
}

module.exports = {
  searchGooglePlaces,
  getGooglePlaceDetails,
  searchNearbyGooglePlaces,
  getGooglePhotoMediaUrl,
};
