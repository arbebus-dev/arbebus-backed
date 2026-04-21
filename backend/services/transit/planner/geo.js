function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function getDistanceMeters(a, b) {
  const earthRadius = 6371000;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadius * c;
}

function estimateWalkMinutes(distanceMeters, speedMetersPerMinute = 80) {
  return Math.max(1, Math.round(Number(distanceMeters || 0) / speedMetersPerMinute));
}

module.exports = {
  getDistanceMeters,
  estimateWalkMinutes,
};
