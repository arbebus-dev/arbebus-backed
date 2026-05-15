/* eslint-env node */
const { getPool } = require("../../../db/pool");

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (v) => (Number(v) * Math.PI) / 180;
  const lat1 = toRad(a.latitude ?? a.lat);
  const lat2 = toRad(b.latitude ?? b.lat ?? b.stop_lat);
  const dLat = lat2 - lat1;
  const dLon = toRad(b.longitude ?? b.lon ?? b.lng ?? b.stop_lon) - toRad(a.longitude ?? a.lon ?? a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

async function findNearestStops({ lat, lon, latitude, longitude, limit = 8, radiusMeters = 1600 }) {
  const origin = {
    latitude: Number(latitude ?? lat),
    longitude: Number(longitude ?? lon),
  };

  if (!Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude)) return [];

  try {
    const { rows } = await getPool().query(
      `
      SELECT
        stop_id,
        stop_name,
        stop_lat,
        stop_lon,
        (
          6371000 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians($1)) * cos(radians(stop_lat)) * cos(radians(stop_lon) - radians($2)) +
              sin(radians($1)) * sin(radians(stop_lat))
            ))
          )
        ) AS distance_meters
      FROM public.stops
      WHERE stop_lat IS NOT NULL
        AND stop_lon IS NOT NULL
      ORDER BY distance_meters ASC
      LIMIT $3
      `,
      [origin.latitude, origin.longitude, Math.max(limit * 2, 16)],
    );

    return rows
      .map((row) => ({
        id: String(row.stop_id),
        stopId: String(row.stop_id),
        name: row.stop_name || "Stotelė",
        title: row.stop_name || "Stotelė",
        latitude: Number(row.stop_lat),
        longitude: Number(row.stop_lon),
        coordinate: { latitude: Number(row.stop_lat), longitude: Number(row.stop_lon) },
        distanceMeters: Math.round(Number(row.distance_meters || 0)),
      }))
      .filter((stop) => stop.distanceMeters <= radiusMeters)
      .slice(0, limit);
  } catch {
    return [];
  }
}

module.exports = { findNearestStops, haversineMeters };
