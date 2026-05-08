/* eslint-env node */
const { distanceMeters } = require("./routeMatcher.service");

const DEFAULT_WALK_M_PER_MIN = 78;
const DEFAULT_BUS_KPH = 24;

function calculateEtaMinutes(distanceMetersValue = 0, speedKph = DEFAULT_BUS_KPH) {
  const metersPerMinute = (Number(speedKph) * 1000) / 60;
  return Math.max(1, Math.round(Number(distanceMetersValue || 0) / Math.max(metersPerMinute, 1)));
}

function calculateEtaSeconds(distanceMetersValue = 0, speedKph = DEFAULT_BUS_KPH) {
  return calculateEtaMinutes(distanceMetersValue, speedKph) * 60;
}

function calculateVehicleEtaToStop(vehicle, stop) {
  const distance = distanceMeters(vehicle?.coordinate || vehicle, stop?.coordinate || stop);
  const speedKph = Number(vehicle?.speedKph || DEFAULT_BUS_KPH);

  if (!Number.isFinite(distance)) {
    return {
      distanceMeters: null,
      etaSeconds: null,
      etaMinutes: null,
      confidence: "low",
    };
  }

  const etaSeconds = calculateEtaSeconds(distance, speedKph);

  return {
    distanceMeters: Math.round(distance),
    etaSeconds,
    etaMinutes: Math.max(1, Math.round(etaSeconds / 60)),
    confidence:
      vehicle?.stale ? "low" : vehicle?.snappedToShape ? "high" : "medium",
  };
}

function calculateWalkMinutes(distanceMetersValue = 0) {
  return Math.max(1, Math.round(Number(distanceMetersValue || 0) / DEFAULT_WALK_M_PER_MIN));
}

module.exports = {
  calculateEtaMinutes,
  calculateEtaSeconds,
  calculateVehicleEtaToStop,
  calculateWalkMinutes,
};
