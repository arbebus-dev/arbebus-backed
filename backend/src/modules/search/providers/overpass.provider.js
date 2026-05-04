const { normalizeText } = require('../utils/normalizeText');
const { getCache, setCache } = require('../cache/searchCache');
const { toResult } = require('../utils/mapSearchResult');

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

function enabled() {
  return String(process.env.SEARCH_PROVIDER_OVERPASS_ENABLED ?? 'true') === 'true';
}

function center() {
  return {
    lat: Number(process.env.SEARCH_REGION_LAT || 55.7033),
    lng: Number(process.env.SEARCH_REGION_LNG || 21.1443),
    radius: Number(process.env.SEARCH_REGION_RADIUS_METERS || 55000),
  };
}

function classify(tags = {}) {
  if (tags.railway === 'station') return 'station';
  if (tags.amenity === 'ferry_terminal' || tags.public_transport === 'ferry_terminal') return 'ferry';
  if (tags.shop || tags.amenity || tags.tourism || tags.leisure || tags.office || tags.healthcare) return 'poi';
  return 'poi';
}

function subtitle(tags = {}) {
  const address = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const city = tags['addr:city'] || tags['addr:municipality'] || 'Klaipėdos regionas';
  return [address, city].filter(Boolean).join(', ');
}

function mapElement(el) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const name = tags.name || tags['name:lt'] || tags.brand;
  if (!name || lat == null || lon == null) return null;
  return toResult({
    id: `overpass-${el.type}-${el.id}`,
    type: classify(tags),
    title: name,
    subtitle: subtitle(tags),
    latitude: lat,
    longitude: lon,
    source: 'overpass',
    category: tags.shop || tags.amenity || tags.tourism || tags.leisure || tags.railway || tags.public_transport || null,
    keywords: [tags.brand, tags.operator, tags.alt_name, tags.old_name, tags['addr:street'], tags['addr:housenumber']].filter(Boolean),
    raw: { tags },
  });
}

function buildQuery(q) {
  const { lat, lng, radius } = center();
  const safe = q.replace(/["\\]/g, ' ').trim();
  const regex = safe.split(/\s+/).filter(Boolean).join('.*');
  return `[out:json][timeout:8];(
    node(around:${radius},${lat},${lng})["name"~"${regex}",i];
    way(around:${radius},${lat},${lng})["name"~"${regex}",i];
    relation(around:${radius},${lat},${lng})["name"~"${regex}",i];
  );out center tags 25;`;
}

async function searchOverpass(query, options = {}) {
  if (!enabled()) return [];
  const q = normalizeText(query);
  if (q.length < 4 || typeof fetch !== 'function') return [];
  const limit = Math.min(Math.max(Number(options.limit || 8), 1), 15);
  const key = `overpass:${q}:${limit}`;
  const cached = getCache(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.SEARCH_PROVIDER_TIMEOUT_MS || 6500));
  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ data: buildQuery(q) }).toString(),
    });
    if (!response.ok) return [];
    const json = await response.json();
    const results = (json.elements || []).map(mapElement).filter(Boolean).slice(0, limit);
    setCache(key, results);
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { searchOverpass };
