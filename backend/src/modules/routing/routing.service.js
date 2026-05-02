function toCoordinate(input, fallback) {
  const latitude = Number(input?.latitude ?? input?.lat ?? fallback?.latitude);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng ?? fallback?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function buildLine(from, to) {
  return [from, { latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2 }, to];
}

async function directions(payload = {}) {
  const from = toCoordinate(payload.origin || payload.from, { latitude: 55.7033, longitude: 21.1443 });
  const to = toCoordinate(payload.destination || payload.to, { latitude: 55.68962, longitude: 21.14691 });
  const distance = Math.round(distanceMeters(from, to));
  const mode = payload.mode || 'walking';
  const durationMinutes = Math.max(2, Math.round(distance / (mode === 'walking' ? 80 : 450)));
  const polyline = buildLine(from, to);
  return { ok: true, mode, distanceMeters: distance, durationMinutes, polyline, coordinates: polyline };
}

module.exports = { directions, toCoordinate, distanceMeters, buildLine };
