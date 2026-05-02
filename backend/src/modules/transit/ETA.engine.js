function calculateEtaMinutes(distanceMeters = 0, speedKph = 22) {
  const metersPerMinute = (Number(speedKph) * 1000) / 60;
  return Math.max(1, Math.round(Number(distanceMeters || 0) / Math.max(metersPerMinute, 1)));
}
module.exports = { calculateEtaMinutes };
