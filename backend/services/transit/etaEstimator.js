const { distanceMeters } = require("./stopMatcher");

function normalizeRouteId(value) {
  return String(value || "")
    .trim()
    .replace(/^0+/, "")
    .toUpperCase();
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function estimateEtaSecondsByDistance(distance, speedKph) {
  const safeDistance = Math.max(1, distance);
  const fallbackSpeedMps = 6.5;
  const liveSpeedMps =
    Number(speedKph) > 3 ? (Number(speedKph) * 1000) / 3600 : fallbackSpeedMps;

  return Math.round(safeDistance / liveSpeedMps);
}

function looksDirectionCompatible(vehicle, stop, destinationStop, headsign) {
  const direction = normalizeText(vehicle?.directionName);
  if (!direction) return true;

  const headsignText = normalizeText(headsign);
  const stopName = normalizeText(stop?.name);
  const destinationName = normalizeText(destinationStop?.name);

  if (headsignText && direction.includes(headsignText)) return true;
  if (destinationName && direction.includes(destinationName)) return true;
  if (stopName && direction.includes(stopName)) return true;

  return false;
}

function scoreVehicleForStop({
  vehicle,
  stop,
  destinationStop,
  headsign = null,
}) {
  const stopPoint = {
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude),
  };

  const vehiclePoint = {
    latitude: Number(vehicle.latitude),
    longitude: Number(vehicle.longitude),
  };

  const dist = distanceMeters(vehiclePoint, stopPoint);
  const etaSeconds = estimateEtaSecondsByDistance(dist, vehicle.speedKph);
  const directionOk = looksDirectionCompatible(
    vehicle,
    stop,
    destinationStop,
    headsign
  );

  let score = etaSeconds;

  if (!directionOk) {
    score += 360;
  }

  if (Number(vehicle.delaySeconds) > 0) {
    score += Math.min(180, Math.round(Number(vehicle.delaySeconds) / 2));
  }

  return {
    vehicle,
    distanceMeters: Math.round(dist),
    etaSeconds,
    directionOk,
    score,
  };
}

function pickBestVehicleForStop({
  vehicles,
  routeId,
  stop,
  destinationStop = null,
  headsign = null,
  limit = 3,
}) {
  const normalizedRouteId = normalizeRouteId(routeId);

  const matches = (Array.isArray(vehicles) ? vehicles : [])
    .filter(
      (vehicle) =>
        normalizeRouteId(vehicle.routeId || vehicle.number) === normalizedRouteId
    )
    .map((vehicle) =>
      scoreVehicleForStop({
        vehicle,
        stop,
        destinationStop,
        headsign,
      })
    )
    .sort((a, b) => a.score - b.score);

  if (!matches.length) {
    return null;
  }

  return {
    vehicle: matches[0].vehicle,
    etaSeconds: matches[0].etaSeconds,
    candidates: matches.slice(0, limit),
  };
}

module.exports = {
  pickBestVehicleForStop,
  estimateEtaSecondsByDistance,
};