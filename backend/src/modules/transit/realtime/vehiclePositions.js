/* eslint-env node */
const { fetchFeed, feedTimestampSeconds } = require("./gtfsRT.client");

const DEFAULT_URL = "https://www.stops.lt/klaipeda/gtfs_realtime.pb";

const KLAIPEDA_BOUNDS = {
  minLat: 55.5,
  maxLat: 56.08,
  minLon: 20.7,
  maxLon: 21.65,
};

const MAX_JUMP_METERS = Number(process.env.LIVE_BUSES_MAX_JUMP_METERS || 500);
const MAX_JUMP_SECONDS = Number(process.env.LIVE_BUSES_MAX_JUMP_SECONDS || 10);
const STALE_TIMEOUT_SECONDS = Number(process.env.LIVE_BUSES_STALE_SECONDS || 60);
const MAX_SNAP_METERS = Number(process.env.LIVE_BUSES_SNAP_MAX_METERS || 45);

let vehicleStateCache = new Map();

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isInKlaipeda(latitude, longitude) {
  return (
    latitude >= KLAIPEDA_BOUNDS.minLat &&
    latitude <= KLAIPEDA_BOUNDS.maxLat &&
    longitude >= KLAIPEDA_BOUNDS.minLon &&
    longitude <= KLAIPEDA_BOUNDS.maxLon
  );
}

function cleanRouteNumber(value) {
  return String(value ?? "").trim().replace(/^0+/, "").toUpperCase();
}

function distanceMeters(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;

  const radius = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function smoothBearing(previous, next) {
  const prev = Number(previous);
  const target = Number(next);

  if (!Number.isFinite(prev)) return Number.isFinite(target) ? Math.round(target) : 0;
  if (!Number.isFinite(target)) return Math.round(prev);

  let delta = ((target - prev + 540) % 360) - 180;
  const maxStep = 35;

  if (delta > maxStep) delta = maxStep;
  if (delta < -maxStep) delta = -maxStep;

  return Math.round((prev + delta + 360) % 360);
}

function projectToSegment(point, a, b) {
  const latScale = 111320;
  const lonScale = 111320 * Math.cos((point.latitude * Math.PI) / 180);

  const px = point.longitude * lonScale;
  const py = point.latitude * latScale;
  const ax = a.longitude * lonScale;
  const ay = a.latitude * latScale;
  const bx = b.longitude * lonScale;
  const by = b.latitude * latScale;

  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;

  if (len2 <= 0) {
    return {
      coordinate: a,
      distance: distanceMeters(point, a),
    };
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const projected = {
    latitude: (ay + t * dy) / latScale,
    longitude: (ax + t * dx) / lonScale,
  };

  return {
    coordinate: projected,
    distance: distanceMeters(point, projected),
  };
}

function snapToShape(coordinate, shapePoints = []) {
  if (!coordinate || !Array.isArray(shapePoints) || shapePoints.length < 2) {
    return { coordinate, snapped: false, snapDistanceMeters: null };
  }

  let best = null;

  for (let i = 0; i < shapePoints.length - 1; i += 1) {
    const a = shapePoints[i];
    const b = shapePoints[i + 1];

    if (
      !Number.isFinite(Number(a?.latitude)) ||
      !Number.isFinite(Number(a?.longitude)) ||
      !Number.isFinite(Number(b?.latitude)) ||
      !Number.isFinite(Number(b?.longitude))
    ) {
      continue;
    }

    const projection = projectToSegment(coordinate, a, b);

    if (!best || projection.distance < best.distance) {
      best = projection;
    }
  }

  if (best && best.distance <= MAX_SNAP_METERS) {
    return {
      coordinate: best.coordinate,
      snapped: true,
      snapDistanceMeters: Math.round(best.distance),
    };
  }

  return {
    coordinate,
    snapped: false,
    snapDistanceMeters: best ? Math.round(best.distance) : null,
  };
}

function entityToVehicle(entity, feedTimestamp) {
  const vehicle = entity?.vehicle;
  if (!vehicle?.position) return null;

  const latitude = toNumber(vehicle.position.latitude);
  const longitude = toNumber(vehicle.position.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!isInKlaipeda(latitude, longitude)) return null;

  const trip = vehicle.trip || {};
  const descriptor = vehicle.vehicle || {};

  const routeId = cleanRouteNumber(trip.routeId || trip.route_id || "");
  const tripId = String(trip.tripId || trip.trip_id || "").trim() || null;

  const vehicleId =
    String(descriptor.id || descriptor.label || entity.id || tripId || "").trim() ||
    `${routeId || "bus"}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`;

  const label =
    String(descriptor.label || descriptor.licensePlate || descriptor.license_plate || vehicleId).trim() ||
    vehicleId;

  const timestampSeconds = Number(vehicle.timestamp || feedTimestamp || Math.floor(Date.now() / 1000));
  const fetchedAt = new Date().toISOString();
  const positionTime = Number.isFinite(timestampSeconds)
    ? new Date(timestampSeconds * 1000).toISOString()
    : fetchedAt;

  const bearing = toNumber(vehicle.position.bearing);
  const speedMps = toNumber(vehicle.position.speed);
  const speedKph = Number.isFinite(speedMps) ? Math.max(0, speedMps * 3.6) : null;

  return {
    id: `${vehicleId}-${routeId || "route"}-${tripId || "trip"}`,
    vehicleId,
    number: routeId || String(trip.routeId || trip.route_id || "BUS"),
    route: routeId || String(trip.routeId || trip.route_id || "BUS"),
    routeId: routeId || String(trip.routeId || trip.route_id || ""),
    routeNumber: routeId || String(trip.routeId || trip.route_id || "BUS"),
    vehicleLabel: label,
    tripId,
    directionId: trip.directionId ?? trip.direction_id ?? null,
    startTime: trip.startTime || trip.start_time || null,
    startDate: trip.startDate || trip.start_date || null,
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    rawLatitude: latitude,
    rawLongitude: longitude,
    rawCoordinate: { latitude, longitude },
    bearing: Number.isFinite(bearing) ? Math.round(bearing) : null,
    heading: Number.isFinite(bearing) ? Math.round(bearing) : null,
    speedKph,
    timestamp: timestampSeconds,
    positionTime,
    fetchedAt,
    source: "gtfs-rt",
    rawEntityId: entity.id || null,
  };
}

function enrichVehicleState(vehicle, shapePointsByTripId = new Map()) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const previous = vehicleStateCache.get(vehicle.vehicleId);
  const currentTimestamp = Number(vehicle.timestamp || nowSeconds);

  const previousCoordinate =
    previous?.coordinate && Number.isFinite(previous.coordinate.latitude)
      ? previous.coordinate
      : null;

  const rawCoordinate = vehicle.rawCoordinate || vehicle.coordinate;
  const secondsSincePrevious = previous
    ? Math.max(1, Math.abs(currentTimestamp - Number(previous.timestamp || currentTimestamp)))
    : null;

  const jumpMeters = previousCoordinate ? distanceMeters(previousCoordinate, rawCoordinate) : 0;
  const isJump =
    previousCoordinate &&
    secondsSincePrevious != null &&
    secondsSincePrevious <= MAX_JUMP_SECONDS &&
    jumpMeters > MAX_JUMP_METERS;

  if (isJump) {
    const staleSeconds = Math.max(0, nowSeconds - Number(previous.timestamp || nowSeconds));
    return {
      ...previous,
      stale: staleSeconds > STALE_TIMEOUT_SECONDS,
      staleSeconds,
      filteredJump: true,
      ignoredCoordinate: rawCoordinate,
      ignoredJumpMeters: Math.round(jumpMeters),
      fetchedAt: vehicle.fetchedAt,
      source: "gtfs-rt-smoothed",
    };
  }

  const shapePoints =
    shapePointsByTripId.get(String(vehicle.tripId || "")) ||
    shapePointsByTripId.get(String(vehicle.routeId || "")) ||
    [];

  const snapped = snapToShape(rawCoordinate, shapePoints);
  const coordinate = snapped.coordinate || rawCoordinate;
  const previousHeading = previous?.heading ?? previous?.bearing;
  const heading = smoothBearing(previousHeading, vehicle.heading ?? vehicle.bearing);

  const staleSeconds = Math.max(0, nowSeconds - currentTimestamp);

  const enriched = {
    ...vehicle,
    previousCoordinate,
    previousLatitude: previousCoordinate?.latitude ?? null,
    previousLongitude: previousCoordinate?.longitude ?? null,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    bearing: heading,
    heading,
    jumpMeters: Math.round(jumpMeters || 0),
    stale: staleSeconds > STALE_TIMEOUT_SECONDS,
    staleSeconds,
    snappedToShape: snapped.snapped,
    snapDistanceMeters: snapped.snapDistanceMeters,
    source: "gtfs-rt-smoothed",
  };

  vehicleStateCache.set(vehicle.vehicleId, enriched);
  return enriched;
}

function cleanupStateCache(activeVehicleIds) {
  const active = new Set(activeVehicleIds.map(String));
  for (const [vehicleId, state] of vehicleStateCache.entries()) {
    const staleSeconds = Math.floor(Date.now() / 1000) - Number(state.timestamp || 0);

    if (!active.has(String(vehicleId)) && staleSeconds > STALE_TIMEOUT_SECONDS) {
      vehicleStateCache.delete(vehicleId);
    }
  }
}

function dedupeVehicles(vehicles) {
  const map = new Map();

  for (const vehicle of vehicles) {
    const key = `${vehicle.vehicleId}-${vehicle.routeId || vehicle.route || ""}`;
    const previous = map.get(key);

    if (!previous || Number(vehicle.timestamp || 0) >= Number(previous.timestamp || 0)) {
      map.set(key, vehicle);
    }
  }

  return Array.from(map.values());
}

async function getVehiclePositions(options = {}) {
  const url =
    process.env.GTFS_RT_VEHICLE_POSITIONS_URL ||
    process.env.KKT_GTFS_RT_VEHICLE_POSITIONS_URL ||
    DEFAULT_URL;

  const feed = await fetchFeed(url);
  const feedTs = feedTimestampSeconds(feed);

  const shapePointsByTripId = options.shapePointsByTripId || new Map();

  const vehicles = dedupeVehicles(
    feed.entities
      .map((entity) => entityToVehicle(entity, feedTs))
      .filter(Boolean),
  ).map((vehicle) => enrichVehicleState(vehicle, shapePointsByTripId));

  cleanupStateCache(vehicles.map((vehicle) => vehicle.vehicleId));

  return {
    ok: true,
    source: "gtfs-rt-smoothed",
    url,
    count: vehicles.length,
    buses: vehicles,
    vehicles,
    fetchedAt: feed.fetchedAt,
    feedTimestamp: feedTs,
    meta: {
      byteLength: feed.byteLength,
      entityCount: feed.entities.length,
      smoothing: {
        maxJumpMeters: MAX_JUMP_METERS,
        maxJumpSeconds: MAX_JUMP_SECONDS,
        staleTimeoutSeconds: STALE_TIMEOUT_SECONDS,
        maxSnapMeters: MAX_SNAP_METERS,
      },
    },
  };
}

module.exports = {
  getVehiclePositions,
  entityToVehicle,
  distanceMeters,
  snapToShape,
  smoothBearing,
};
