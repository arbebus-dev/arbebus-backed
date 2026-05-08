/* eslint-env node */

const DEFAULT_MAX_SNAP_METERS = Number(process.env.LIVE_BUSES_SNAP_MAX_METERS || 45);

function toCoordinate(value) {
  const latitude = Number(value?.latitude ?? value?.lat);
  const longitude = Number(value?.longitude ?? value?.lon ?? value?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a, b) {
  const first = toCoordinate(a);
  const second = toCoordinate(b);
  if (!first || !second) return Number.POSITIVE_INFINITY;

  const radius = 6371000;
  const dLat = ((second.latitude - first.latitude) * Math.PI) / 180;
  const dLon = ((second.longitude - first.longitude) * Math.PI) / 180;
  const lat1 = (first.latitude * Math.PI) / 180;
  const lat2 = (second.latitude * Math.PI) / 180;

  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function bearingBetween(a, b) {
  const first = toCoordinate(a);
  const second = toCoordinate(b);
  if (!first || !second) return null;

  const lat1 = (first.latitude * Math.PI) / 180;
  const lat2 = (second.latitude * Math.PI) / 180;
  const dLon = ((second.longitude - first.longitude) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((bearing + 360) % 360);
}

function projectToSegment(point, a, b) {
  const target = toCoordinate(point);
  const start = toCoordinate(a);
  const end = toCoordinate(b);

  if (!target || !start || !end) {
    return { coordinate: target, distance: Number.POSITIVE_INFINITY, segmentBearing: null };
  }

  const latScale = 111320;
  const lonScale = 111320 * Math.cos((target.latitude * Math.PI) / 180);

  const px = target.longitude * lonScale;
  const py = target.latitude * latScale;
  const ax = start.longitude * lonScale;
  const ay = start.latitude * latScale;
  const bx = end.longitude * lonScale;
  const by = end.latitude * latScale;

  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;

  if (len2 <= 0) {
    return {
      coordinate: start,
      distance: distanceMeters(target, start),
      segmentBearing: bearingBetween(start, end),
    };
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const projected = {
    latitude: (ay + t * dy) / latScale,
    longitude: (ax + t * dx) / lonScale,
  };

  return {
    coordinate: projected,
    distance: distanceMeters(target, projected),
    segmentBearing: bearingBetween(start, end),
  };
}

function snapToShape(coordinate, shapePoints = [], options = {}) {
  const point = toCoordinate(coordinate);
  const maxSnapMeters = Number(options.maxSnapMeters || DEFAULT_MAX_SNAP_METERS);

  if (!point || !Array.isArray(shapePoints) || shapePoints.length < 2) {
    return {
      coordinate: point,
      snapped: false,
      snapDistanceMeters: null,
      segmentBearing: null,
      shapeIndex: -1,
    };
  }

  let best = null;

  for (let i = 0; i < shapePoints.length - 1; i += 1) {
    const projection = projectToSegment(point, shapePoints[i], shapePoints[i + 1]);

    if (!best || projection.distance < best.distance) {
      best = { ...projection, shapeIndex: i };
    }
  }

  if (best && best.distance <= maxSnapMeters) {
    return {
      coordinate: best.coordinate,
      snapped: true,
      snapDistanceMeters: Math.round(best.distance),
      segmentBearing: best.segmentBearing,
      shapeIndex: best.shapeIndex,
    };
  }

  return {
    coordinate: point,
    snapped: false,
    snapDistanceMeters: best ? Math.round(best.distance) : null,
    segmentBearing: best?.segmentBearing ?? null,
    shapeIndex: best?.shapeIndex ?? -1,
  };
}

function resolveShapePoints(vehicle, shapePointsByTripId = new Map()) {
  if (!vehicle) return [];

  const keys = [
    vehicle.tripId,
    vehicle.trip_id,
    vehicle.routeId,
    vehicle.route_id,
    vehicle.route,
    vehicle.number,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  for (const key of keys) {
    const points = shapePointsByTripId.get(key);
    if (Array.isArray(points) && points.length >= 2) return points;
  }

  return [];
}

module.exports = {
  toCoordinate,
  distanceMeters,
  bearingBetween,
  snapToShape,
  resolveShapePoints,
};
