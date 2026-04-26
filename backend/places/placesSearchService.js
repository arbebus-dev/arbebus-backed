const path = require('path');
const { getPool } = require('../db/pool');
const pois = require('../data/poi/klaipedaPois.json');

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ė/g, 'e')
    .replace(/ų/g, 'u')
    .replace(/ū/g, 'u')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/č/g, 'c')
    .replace(/ą/g, 'a')
    .replace(/ę/g, 'e')
    .replace(/į/g, 'i')
    .trim();
}

function distanceMeters(a, b) {
  if (!a || !b) return 0;
  const lat1 = Number(a.latitude);
  const lon1 = Number(a.longitude);
  const lat2 = Number(b.latitude);
  const lon2 = Number(b.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 0;
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const x = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function poiScore(poi, q) {
  const haystack = normalizeText([
    poi.title,
    poi.name,
    poi.subtitle,
    ...(poi.keywords || []),
  ].join(' '));
  const query = normalizeText(q);
  if (!query) return 0;
  if (normalizeText(poi.title) === query || normalizeText(poi.name) === query) return 100;
  if ((poi.keywords || []).some((keyword) => normalizeText(keyword) === query)) return 95;
  if (haystack.includes(query)) return 80;
  return 0;
}

async function searchStops(q, userPoint, limit) {
  const pool = getPool();
  const hasPoint = userPoint && Number.isFinite(userPoint.latitude) && Number.isFinite(userPoint.longitude);
  const params = hasPoint ? [q, userPoint.longitude, userPoint.latitude, limit] : [q, limit];

  const sql = hasPoint
    ? `
      SELECT stop_id AS id, stop_name AS name, stop_lat AS latitude, stop_lon AS longitude,
        ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)) AS distance_meters
      FROM transit.stops
      WHERE stop_name ILIKE '%' || $1 || '%' OR stop_code ILIKE '%' || $1 || '%' OR stop_id ILIKE '%' || $1 || '%'
      ORDER BY distance_meters ASC, stop_name ASC
      LIMIT $4
    `
    : `
      SELECT stop_id AS id, stop_name AS name, stop_lat AS latitude, stop_lon AS longitude, 0 AS distance_meters
      FROM transit.stops
      WHERE stop_name ILIKE '%' || $1 || '%' OR stop_code ILIKE '%' || $1 || '%' OR stop_id ILIKE '%' || $1 || '%'
      ORDER BY stop_name ASC
      LIMIT $2
    `;

  const result = await pool.query(sql, params);
  return result.rows.map((row) => ({
    id: String(row.id),
    title: String(row.name),
    name: String(row.name),
    subtitle: 'Stotelė',
    type: 'stop',
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    distanceMeters: Number(row.distance_meters || 0),
  }));
}

async function searchPlaces({ q, lat, lon, limit = 12 }) {
  const query = String(q || '').trim();
  if (query.length < 2) return [];

  const userPoint = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
    ? { latitude: Number(lat), longitude: Number(lon) }
    : null;

  const poiMatches = pois
    .map((poi) => {
      const score = poiScore(poi, query);
      if (!score) return null;
      const distance = userPoint
        ? distanceMeters(userPoint, { latitude: poi.latitude, longitude: poi.longitude })
        : 0;
      return {
        id: poi.id,
        title: poi.title,
        name: poi.name || poi.title,
        subtitle: poi.subtitle || 'Vieta',
        type: poi.type || 'place',
        latitude: Number(poi.latitude),
        longitude: Number(poi.longitude),
        distanceMeters: distance,
        score,
      };
    })
    .filter(Boolean);

  let stopMatches = [];
  try {
    stopMatches = await searchStops(query, userPoint, Math.max(6, limit));
  } catch (error) {
    console.error('POI stop fallback failed:', error.message);
  }

  return [...poiMatches, ...stopMatches]
    .sort((a, b) => (b.score || 50) - (a.score || 50) || Number(a.distanceMeters || 0) - Number(b.distanceMeters || 0))
    .slice(0, limit);
}

module.exports = { searchPlaces };
