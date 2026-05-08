/* eslint-env node */
const routeMatcher = require("./routeMatcher.service");

const MAX_JUMP_METERS = Number(process.env.LIVE_BUSES_MAX_JUMP_METERS || 500);
const MAX_JUMP_SECONDS = Number(process.env.LIVE_BUSES_MAX_JUMP_SECONDS || 10);
const STALE_TIMEOUT_SECONDS = Number(process.env.LIVE_BUSES_STALE_SECONDS || 60);
const MAX_SNAP_METERS = Number(process.env.LIVE_BUSES_SNAP_MAX_METERS || 45);
const PREDICT_SECONDS = Number(process.env.LIVE_BUSES_PREDICT_SECONDS || 3);

const vehicleStates = new Map();

function stableVehicleKey(vehicle) {
  return String(
    vehicle?.vehicleId ||
      vehicle?.id ||
      vehicle?.vehicleLabel ||
      `${vehicle?.routeId || vehicle?.route || vehicle?.number || "bus"}-${vehicle?.tripId || ""}`,
  ).trim();
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeBearing(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round((n + 360) % 360);
}

function smoothBearing(previous, next, maxStep = 35) {
  const prev = normalizeBearing(previous);
  const target = normalizeBearing(next);

  if (prev == null) return target ?? 0;
  if (target == null) return prev;

  let delta = ((target - prev + 540) % 360) - 180;

  if (delta > maxStep) delta = maxStep;
  if (delta < -maxStep) delta = -maxStep;

  return Math.round((prev + delta + 360) % 360);
}

function predictCoordinate(coordinate, heading, speedKph, seconds = PREDICT_SECONDS) {
  const point = routeMatcher.toCoordinate(coordinate);
  const bearing = normalizeBearing(heading);
  const speed = Number(speedKph);

  if (!point || bearing == null || !Number.isFinite(speed) || speed <= 1 || seconds <= 0) {
    return point;
  }

  const distance = Math.min((speed * 1000 / 3600) * seconds, 60);
  const radius = 6371000;
  const angularDistance = distance / radius;
  const bearingRad = (bearing * Math.PI) / 180;
  const lat1 = (point.latitude * Math.PI) / 180;
  const lon1 = (point.longitude * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );

  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: (lon2 * 180) / Math.PI,
  };
}

function isGpsJump(previous, current, secondsBetween) {
  if (!previous || !current || !Number.isFinite(secondsBetween)) return false;

  const distance = routeMatcher.distanceMeters(previous, current);
  return secondsBetween <= MAX_JUMP_SECONDS && distance > MAX_JUMP_METERS;
}

function applyVehicleState(vehicle, options = {}) {
  const key = stableVehicleKey(vehicle);
  const previous = vehicleStates.get(key) || null;
  const currentTimestamp = Number(vehicle.timestamp || nowSeconds());
  const rawCoordinate = routeMatcher.toCoordinate(vehicle.rawCoordinate || vehicle.coordinate || vehicle);
  const previousCoordinate = previous?.coordinate || null;

  if (!rawCoordinate || !key) return null;

  const secondsBetween = previous
    ? Math.max(1, Math.abs(currentTimestamp - Number(previous.timestamp || currentTimestamp)))
    : null;

  const jumpMeters = previousCoordinate
    ? routeMatcher.distanceMeters(previousCoordinate, rawCoordinate)
    : 0;

  if (previousCoordinate && isGpsJump(previousCoordinate, rawCoordinate, secondsBetween)) {
    const staleSeconds = Math.max(0, nowSeconds() - Number(previous.timestamp || nowSeconds()));

    const kept = {
      ...previous,
      stale: staleSeconds > STALE_TIMEOUT_SECONDS,
      staleSeconds,
      filteredJump: true,
      ignoredCoordinate: rawCoordinate,
      ignoredJumpMeters: Math.round(jumpMeters),
      fetchedAt: vehicle.fetchedAt || new Date().toISOString(),
      source: "gtfs-rt-state-cache",
    };

    vehicleStates.set(key, kept);
    return kept;
  }

  const shapePoints = routeMatcher.resolveShapePoints(vehicle, options.shapePointsByTripId || new Map());
  const snapped = routeMatcher.snapToShape(rawCoordinate, shapePoints, {
    maxSnapMeters: MAX_SNAP_METERS,
  });

  const headingCandidate =
    snapped.segmentBearing != null
      ? snapped.segmentBearing
      : vehicle.heading ?? vehicle.bearing;

  const heading = smoothBearing(previous?.heading ?? previous?.bearing, headingCandidate);
  const predicted = predictCoordinate(
    snapped.coordinate || rawCoordinate,
    heading,
    vehicle.speedKph,
    PREDICT_SECONDS,
  );

  const predictedSnapped = routeMatcher.snapToShape(predicted, shapePoints, {
    maxSnapMeters: MAX_SNAP_METERS,
  });

  const coordinate = predictedSnapped.coordinate || snapped.coordinate || rawCoordinate;
  const staleSeconds = Math.max(0, nowSeconds() - currentTimestamp);

  const next = {
    ...vehicle,
    id: vehicle.id || key,
    vehicleId: vehicle.vehicleId || key,
    previousCoordinate,
    previousLatitude: previousCoordinate?.latitude ?? null,
    previousLongitude: previousCoordinate?.longitude ?? null,
    rawCoordinate,
    rawLatitude: rawCoordinate.latitude,
    rawLongitude: rawCoordinate.longitude,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    bearing: heading,
    heading,
    jumpMeters: Math.round(jumpMeters || 0),
    stale: staleSeconds > STALE_TIMEOUT_SECONDS,
    staleSeconds,
    snappedToShape: Boolean(snapped.snapped || predictedSnapped.snapped),
    snapDistanceMeters: snapped.snapDistanceMeters,
    predictedSeconds: PREDICT_SECONDS,
    source: "gtfs-rt-state-cache",
  };

  vehicleStates.set(key, next);
  return next;
}

function cleanupVehicleStates(activeKeys = []) {
  const active = new Set(activeKeys.map(String));

  for (const [key, value] of vehicleStates.entries()) {
    const staleSeconds = nowSeconds() - Number(value.timestamp || 0);

    if (!active.has(String(key)) && staleSeconds > STALE_TIMEOUT_SECONDS) {
      vehicleStates.delete(key);
    }
  }
}

function getVehicleStateStats() {
  return {
    count: vehicleStates.size,
    maxJumpMeters: MAX_JUMP_METERS,
    maxJumpSeconds: MAX_JUMP_SECONDS,
    staleTimeoutSeconds: STALE_TIMEOUT_SECONDS,
    maxSnapMeters: MAX_SNAP_METERS,
    predictSeconds: PREDICT_SECONDS,
  };
}

module.exports = {
  applyVehicleState,
  cleanupVehicleStates,
  getVehicleStateStats,
  stableVehicleKey,
  smoothBearing,
  predictCoordinate,
};
