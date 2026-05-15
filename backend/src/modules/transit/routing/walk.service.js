function toCoordinate(input) {
  const latitude = Number(input?.latitude ?? input?.lat);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a, b) {
  const from = toCoordinate(a);
  const to = toCoordinate(b);
  if (!from || !to) return 0;
  const R = 6371000;
  const toRad = (v) => (Number(v) * Math.PI) / 180;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRad(to.longitude) - toRad(from.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function buildWalkStep({ from, to, title = 'Eikite pėsčiomis', label }) {
  const origin = toCoordinate(from);
  const destination = toCoordinate(to);
  const meters = distanceMeters(origin, destination);
  const minutes = Math.max(1, Math.round(meters / 78));
  return {
    type: 'walk',
    mode: 'walk',
    title,
    subtitle: `${meters} m • ${minutes} min`,
    instruction: label || `${minutes} min pėsčiomis`,
    durationMinutes: minutes,
    minutes,
    distanceMeters: meters,
    from: origin,
    to: destination,
    polyline: [origin, destination].filter(Boolean),
  };
}

module.exports = { buildWalkStep, distanceMeters, toCoordinate };
