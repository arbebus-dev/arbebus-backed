const { normalizeText } = require('../utils/normalizeText');
const { getCache, setCache } = require('../cache/searchCache');
const { toResult } = require('../utils/mapSearchResult');

function enabled() {
  return String(process.env.SEARCH_PROVIDER_GOOGLE_ENABLED || 'false') === 'true' && Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

function mapPlace(place, index) {
  const loc = place.location || {};
  return toResult({
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
}

async function searchGooglePlaces(query, options = {}) {
  if (!enabled()) return [];
  const q = String(query || '').trim();
  const nq = normalizeText(q);
  if (nq.length < 3 || typeof fetch !== 'function') return [];
  const limit = Math.min(Math.max(Number(options.limit || 6), 1), 10);
  const key = `google:${nq}:${limit}`;
  const cached = getCache(key);
  if (cached) return cached;

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
      },
      body: JSON.stringify({
        textQuery: /lietuva|klaipeda|klaipėda/i.test(q) ? q : `${q} Klaipėda Lietuva`,
        maxResultCount: limit,
        languageCode: 'lt',
        regionCode: 'LT',
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

module.exports = { searchGooglePlaces };
