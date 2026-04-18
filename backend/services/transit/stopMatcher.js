function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const earthRadius = 6371000;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

function findNearestStop(stops, pickupCoordinate, maxDistanceMeters = 250) {
  let best = null;

  for (const stop of stops) {
    const meters = distanceMeters(pickupCoordinate, {
      latitude: stop.latitude,
      longitude: stop.longitude,
    });

    if (meters > maxDistanceMeters) continue;
    if (!best || meters < best.distanceMeters) {
      best = {
        ...stop,
        distanceMeters: Math.round(meters),
      };
    }
  }

  return best;
}

module.exports = {
  distanceMeters,
  findNearestStop,
};