const { normalizeText } = require('../utils/normalizeText');
const { getCache, setCache } = require('../cache/searchCache');
const { toResult } = require('../utils/mapSearchResult');

const GOOGLE_BASE = 'https://places.googleapis.com/v1';

function enabled() {
  return String(process.env.SEARCH_PROVIDER_GOOGLE_ENABLED || 'false').toLowerCase() === 'true' && Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

function languageCode() {
  return process.env.GOOGLE_PLACES_LANGUAGE || 'lt';
}

function regionCode() {
  return process.env.GOOGLE_PLACES_REGION || 'LT';
}

function timeoutMs() {
  return Math.min(Math.max(Number(process.env.GOOGLE_PLACES_DETAILS_TIMEOUT_MS || 4500), 1200), 10000);
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
  return `/api/search/photo?name=${encodeURIComponent(photoName)}&maxWidthPx=${encodeURIComponent(process.env.GOOGLE_PLACES_PHOTO_MAX_WIDTH || '900')}`;
}

function normalizeCategory(types = []) {
  const first = Array.isArray(types) ? types[0] : null;
  if (!first) return null;
  return String(first).replace(/_/g, ' ');
}

function openNowText(place) {
  const open = place?.currentOpeningHours?.openNow ?? place?.regularOpeningHours?.openNow;
  if (open === true) return 'Atidaryta dabar';
  if (open === false) return 'Uždaryta dabar';
  return null;
}

function hoursFromPlace(place) {
  const weekday = place?.currentOpeningHours?.weekdayDescriptions || place?.regularOpeningHours?.weekdayDescriptions || [];
  return Array.isArray(weekday) ? weekday.slice(0, 7) : [];
}

function enrich(base, place) {
  if (!base || !place) return base;
  const photos = Array.isArray(place.photos)
    ? place.photos.slice(0, 6).map((photo) => ({
        name: photo.name,
        widthPx: photo.widthPx,
        heightPx: photo.heightPx,
        authorAttributions: photo.authorAttributions || [],
        url: photoProxyUrl(photo.name),
      })).filter((photo) => photo.name)
    : [];

  return {
    ...base,
    id: place.id || base.id,
    placeId: place.id || base.placeId || base.id,
    googlePlaceId: place.id || base.googlePlaceId || base.id,
    category: normalizeCategory(place.types) || base.category,
    rating: place.rating != null ? Number(place.rating) : base.rating,
    userRatingCount: place.userRatingCount != null ? Number(place.userRatingCount) : base.userRatingCount,
    openNow: place?.currentOpeningHours?.openNow ?? place?.regularOpeningHours?.openNow ?? base.openNow,
    openNowText: openNowText(place) || base.openNowText,
    openingHours: hoursFromPlace(place),
    photos,
    photoUrls: photos.map((p) => p.url).filter(Boolean),
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || base.phone,
    website: place.websiteUri || base.website,
    googleMapsUri: place.googleMapsUri || base.googleMapsUri,
    raw: place,
  };
}

function mapPlace(place, index) {
  const loc = place.location || {};
  const base = toResult({
    id: place.id || `google-${index}`,
    type: 'poi',
    title: place.displayName?.text || place.name || 'Vieta',
    subtitle: place.formattedAddress || 'Lietuva',
    latitude: loc.latitude,
    longitude: loc.longitude,
    source: 'google_places',
    category: Array.isArray(place.types) ? place.types[0] : null,
    keywords: place.types || [],
    raw: place,
  });
  return enrich(base, place);
}

async function searchGooglePlaces(query, options = {}) {
  if (!enabled() || typeof fetch !== 'function') return [];
  const q = String(query || '').trim();
  const nq = normalizeText(q);
  if (nq.length < 3) return [];

  const limit = Math.min(Math.max(Number(options.limit || 6), 1), 10);
  const key = `google:text:${nq}:${limit}:${languageCode()}:${regionCode()}`;
  const cached = getCache(key);
  if (cached) return cached;

  try {
    const response = await fetchGoogle(`${GOOGLE_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.types',
          'places.rating',
          'places.userRatingCount',
          'places.currentOpeningHours',
          'places.photos',
          'places.googleMapsUri',
        ].join(','),
      },
      body: JSON.stringify({
        textQuery: /lietuva|klaipeda|klaipėda/i.test(q) ? q : `${q} Klaipėda Lietuva`,
        maxResultCount: limit,
        languageCode: languageCode(),
        regionCode: regionCode(),
      }),
    });
    if (!response.ok) return [];
    const json = await response.json();
    const results = (json.places || []).map(mapPlace).filter(Boolean);
    setCache(key, results);
    return results;
  } catch {
    return [];
  }
}

async function getGooglePlaceDetails(placeId) {
  if (!enabled() || typeof fetch !== 'function') return null;
  const id = String(placeId || '').trim();
  if (!id) return null;

  const key = `google:details:${id}:${languageCode()}`;
  const cached = getCache(key);
  if (cached) return cached;

  try {
    const response = await fetchGoogle(`${GOOGLE_BASE}/places/${encodeURIComponent(id)}?languageCode=${encodeURIComponent(languageCode())}&regionCode=${encodeURIComponent(regionCode())}`, {
      headers: {
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'types',
          'rating',
          'userRatingCount',
          'currentOpeningHours',
          'regularOpeningHours',
          'photos',
          'nationalPhoneNumber',
          'internationalPhoneNumber',
          'websiteUri',
          'googleMapsUri',
        ].join(','),
      },
    });
    if (!response.ok) return null;
    const place = await response.json();
    const mapped = mapPlace(place, 0);
    setCache(key, mapped);
    return mapped;
  } catch {
    return null;
  }
}

async function searchNearbyGooglePlaces(latitude, longitude, options = {}) {
  if (!enabled() || typeof fetch !== 'function') return [];
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const radius = Math.min(Math.max(Number(options.radiusMeters || process.env.GOOGLE_PLACES_NEARBY_RADIUS_METERS || 80), 20), 300);
  const limit = Math.min(Math.max(Number(options.limit || 3), 1), 5);
  const key = `google:nearby:${lat.toFixed(5)}:${lng.toFixed(5)}:${radius}:${limit}`;
  const cached = getCache(key);
  if (cached) return cached;

  try {
    const response = await fetchGoogle(`${GOOGLE_BASE}/places:searchNearby`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.types',
          'places.rating',
          'places.userRatingCount',
          'places.currentOpeningHours',
          'places.photos',
          'places.googleMapsUri',
        ].join(','),
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
    if (!response.ok) return [];
    const json = await response.json();
    const results = (json.places || []).map(mapPlace).filter(Boolean);
    setCache(key, results);
    return results;
  } catch {
    return [];
  }
}

async function getGooglePhotoMediaUrl(name, maxWidthPx) {
  if (!enabled() || typeof fetch !== 'function') return null;
  const photoName = String(name || '').trim();
  if (!photoName || !photoName.startsWith('places/')) return null;
  const width = Math.min(Math.max(Number(maxWidthPx || process.env.GOOGLE_PLACES_PHOTO_MAX_WIDTH || 900), 128), 1600);

  try {
    const response = await fetchGoogle(`${GOOGLE_BASE}/${photoName}/media?maxWidthPx=${width}&skipHttpRedirect=true`, {
      headers: { 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY },
    });
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
