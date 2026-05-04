const { normalizeText } = require('../utils/normalizeText');
const { getCache, setCache } = require('../cache/searchCache');
const { toResult } = require('../utils/mapSearchResult');

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = process.env.NOMINATIM_REVERSE_URL || 'https://nominatim.openstreetmap.org/reverse';

function enabled() {
  return String(process.env.SEARCH_PROVIDER_OSM_ENABLED ?? 'true') === 'true';
}

function classify(item) {
  const cls = String(item.class || '').toLowerCase();
  const type = String(item.type || '').toLowerCase();
  if (cls === 'place' && ['city', 'town'].includes(type)) return 'city';
  if (cls === 'place') return 'region';
  if (['shop', 'amenity', 'tourism', 'leisure', 'office', 'healthcare'].includes(cls)) return 'poi';
  if (cls === 'railway') return 'station';
  if (cls === 'highway' || item.address?.road || item.address?.house_number) return 'address';
  return 'poi';
}

function titleFor(item) {
  const a = item.address || {};
  return item.name || a.amenity || a.shop || a.tourism || a.leisure || a.building || (a.road && a.house_number ? `${a.road} ${a.house_number}` : a.road) || a.village || a.town || a.city || String(item.display_name || 'Vieta').split(',')[0];
}

function subtitleFor(item) {
  const a = item.address || {};
  const city = a.city || a.town || a.village || a.municipality || a.county;
  const road = a.road && a.house_number ? `${a.road} ${a.house_number}` : a.road;
  return [road, city, 'Lietuva'].filter(Boolean).join(', ');
}

function mapItem(item, index) {
  return toResult({
    id: `nominatim-${item.osm_type}-${item.osm_id || index}`,
    type: classify(item),
    title: titleFor(item),
    subtitle: subtitleFor(item),
    latitude: item.lat,
    longitude: item.lon,
    source: 'nominatim',
    category: item.class,
    keywords: [item.display_name, item.type, item.class].filter(Boolean),
    raw: item,
  });
}

async function searchNominatim(query, options = {}) {
  if (!enabled()) return [];
  const q = String(query || '').trim();
  const nq = normalizeText(q);
  if (nq.length < 3 || typeof fetch !== 'function') return [];
  const limit = Math.min(Math.max(Number(options.limit || 6), 1), 10);
  const key = `nominatim:${nq}:${limit}`;
  const cached = getCache(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: /lietuva|klaipeda|klaipėda|palanga|kretinga|gargzdai|gargždai|radailiai/i.test(q) ? q : `${q}, Klaipėdos apskritis, Lietuva`,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'lt',
    dedupe: '1',
    namedetails: '1',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.SEARCH_PROVIDER_TIMEOUT_MS || 4500));
  try {
    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': process.env.NOMINATIM_USER_AGENT || 'Arbebus/1.0 contact@arbebus.com',
        Accept: 'application/json',
      },
    });
    if (!response.ok) return [];
    const json = await response.json();
    const results = Array.isArray(json) ? json.map(mapItem).filter(Boolean) : [];
    setCache(key, results);
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}



async function reverseNominatim(latitude, longitude, options = {}) {
  if (!enabled()) return null;

  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || typeof fetch !== 'function') {
    return null;
  }

  const zoom = String(options.zoom || 18);
  const key = `nominatim:reverse:${lat.toFixed(6)}:${lon.toFixed(6)}:${zoom}`;
  const cached = getCache(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    addressdetails: '1',
    zoom,
    namedetails: '1',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.SEARCH_PROVIDER_TIMEOUT_MS || 4500));

  try {
    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': process.env.NOMINATIM_USER_AGENT || 'Arbebus/1.0 contact@arbebus.com',
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;
    const json = await response.json();
    const result = mapItem(json, 0);
    setCache(key, result);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { searchNominatim, reverseNominatim };
