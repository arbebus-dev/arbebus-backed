/* eslint-env node */
const { fetchFeed, feedTimestampSeconds } = require("./gtfsRT.client");
const vehicleStateCache = require("../vehicleState.cache");

const DEFAULT_URL = "https://www.stops.lt/klaipeda/gtfs_realtime.pb";

const KLAIPEDA_BOUNDS = {
  minLat: 55.5,
  maxLat: 56.08,
  minLon: 20.7,
  maxLon: 21.65,
};

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
  return String(value ?? "")
    .trim()
    .replace(/^0+/, "")
    .toUpperCase();
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
    String(
      descriptor.label ||
        descriptor.licensePlate ||
        descriptor.license_plate ||
        vehicleId,
    ).trim() || vehicleId;

  const timestampSeconds = Number(
    vehicle.timestamp || feedTimestamp || Math.floor(Date.now() / 1000),
  );

  const fetchedAt = new Date().toISOString();
  const positionTime = Number.isFinite(timestampSeconds)
    ? new Date(timestampSeconds * 1000).toISOString()
    : fetchedAt;

  const bearing = toNumber(vehicle.position.bearing);
  const speedMps = toNumber(vehicle.position.speed);
  const speedKph = Number.isFinite(speedMps)
    ? Math.max(0, speedMps * 3.6)
    : null;

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

function dedupeVehicles(vehicles) {
  const map = new Map();

  for (const vehicle of vehicles) {
    const key = vehicleStateCache.stableVehicleKey(vehicle);
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

  const rawVehicles = dedupeVehicles(
    feed.entities
      .map((entity) => entityToVehicle(entity, feedTs))
      .filter(Boolean),
  );

  const vehicles = rawVehicles
    .map((vehicle) =>
      vehicleStateCache.applyVehicleState(vehicle, { shapePointsByTripId }),
    )
    .filter(Boolean);

  vehicleStateCache.cleanupVehicleStates(
    vehicles.map((vehicle) => vehicleStateCache.stableVehicleKey(vehicle)),
  );

  return {
    ok: true,
    source: "gtfs-rt-trafi-like",
    url,
    count: vehicles.length,
    buses: vehicles,
    vehicles,
    fetchedAt: feed.fetchedAt,
    feedTimestamp: feedTs,
    meta: {
      byteLength: feed.byteLength,
      entityCount: feed.entities.length,
      state: vehicleStateCache.getVehicleStateStats(),
    },
  };
}

module.exports = {
  getVehiclePositions,
  entityToVehicle,
};
