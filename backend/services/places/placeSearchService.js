const { getPool } = require('../../db/pool');

const KLAIPEDA_CENTER = { latitude: 55.7033, longitude: 21.1443 };

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function getApiKey() {
  return process.env.OPENCAGE_API_KEY;
}

async function searchOpenCage(q, userPoint, limit) {
  const key = getApiKey();
  if (!key) {
    console.log('❌ NO OPENCAGE KEY');
    return [];
  }

  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
    q
  )}&key=${key}&limit=${limit}&countrycode=lt&no_annotations=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    return data.results.map((r, i) => {
      const lat = r.geometry.lat;
      const lon = r.geometry.lng;

      return {
        id: `geo-${i}`,
        title: r.formatted,
        name: r.formatted,
        subtitle: 'Vieta',
        type: 'place',
        latitude: lat,
        longitude: lon,
        distanceMeters: distanceMeters(userPoint, {
          latitude: lat,
          longitude: lon,
        }),
        score: 1000 - i * 10,
        source: 'opencage',
      };
    });
  } catch (e) {
    console.log('❌ OpenCage error', e.message);
    return [];
  }
}

async function searchStops(q, userPoint, limit) {
  const pool = getPool();

  const sql = `
    SELECT stop_id, stop_name, stop_lat, stop_lon
    FROM transit.stops
    WHERE stop_name ILIKE '%' || $1 || '%'
    LIMIT $2
  `;

  const res = await pool.query(sql, [q, limit]);

  return res.rows.map((r) => ({
    id: r.stop_id,
    title: r.stop_name,
    name: r.stop_name,
    subtitle: 'Stotelė',
    type: 'stop',
    latitude: Number(r.stop_lat),
    longitude: Number(r.stop_lon),
    distanceMeters: distanceMeters(userPoint, {
      latitude: r.stop_lat,
      longitude: r.stop_lon,
    }),
    score: 500,
    source: 'stop',
  }));
}

async function searchPlaces({ q, lat, lon, limit = 10 }) {
  if (!q || q.length < 2) return [];

  const userPoint = {
    latitude: Number(lat) || KLAIPEDA_CENTER.latitude,
    longitude: Number(lon) || KLAIPEDA_CENTER.longitude,
  };

  const [geo, stops] = await Promise.all([
    searchOpenCage(q, userPoint, limit),
    searchStops(q, userPoint, limit),
  ]);

  const results = [...geo, ...stops];

  return results
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

module.exports = { searchPlaces };