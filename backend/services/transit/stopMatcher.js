function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function distanceMeters(a, b) {
  const aLat = toNumber(a?.latitude ?? a?.lat);
  const aLon = toNumber(a?.longitude ?? a?.lon);
  const bLat = toNumber(b?.latitude ?? b?.lat);
  const bLon = toNumber(b?.longitude ?? b?.lon);

  if ([aLat, aLon, bLat, bLon].some((value) => value === null)) {
    return Number.POSITIVE_INFINITY;
  }

  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
}

function findNearestStop(stops, point, maxDistanceMeters = Infinity) {
  if (!Array.isArray(stops) || !stops.length || !point) return null;

  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const stop of stops) {
    const distance = distanceMeters(
      { latitude: stop?.latitude ?? stop?.stop_lat, longitude: stop?.longitude ?? stop?.stop_lon },
      point
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      best = stop;
    }
  }

  if (!best || bestDistance > maxDistanceMeters) return null;
  return {
    ...best,
    distanceMeters: Math.round(bestDistance),
  };
}

module.exports = {
  distanceMeters,
  findNearestStop,
};
