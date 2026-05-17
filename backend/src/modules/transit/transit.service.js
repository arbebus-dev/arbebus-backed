/* eslint-env node */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const orsClient = require("../routing/ors.client");
const vehiclePositionsRealtime = require("./realtime/vehiclePositions");
const ETAEngine = require("./ETA.engine");
const otpService = require("../otp/otp.service");
const { formatJourney } = require("./routing/journeyFormatter");
const ferryService = require("../ferries/ferry.service");

const KLAIPEDA_BOUNDS = {
  // Expanded Klaipėda region bounds. The live stops.lt feed also contains
  // regional routes to Palanga, Gargždai, Ditūva, etc. Tight city-only bounds
  // make vehicles appear/disappear at the edge of the map.
  minLat: 55.5,
  maxLat: 56.08,
  minLon: 20.7,
  maxLon: 21.65,
};

const GTFS_DIR = path.resolve(__dirname, "../../data/gtfs");
const STATION_ACCESS_PATH = path.resolve(
  __dirname,
  "../../data/stations/entrances.json",
);
const LIVE_CACHE_MS = Number(process.env.LIVE_BUSES_CACHE_MS || 7000);
const DEFAULT_GPS_URL = "https://www.stops.lt/klaipeda/gps_full.txt";
const WALK_SPEED_M_PER_MIN = 78;
const BUS_AVG_SPEED_M_PER_MIN = 430;

let liveCache = { fetchedAt: 0, data: null };
let gtfsCache = null;

function readFileSafe(fileName) {
  const filePath = path.join(GTFS_DIR, fileName);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function routeLabel(route) {
  return String(
    route?.route_short_name || route?.route_long_name || route?.route_id || "",
  ).trim();
}

function stopToPublic(stop, extra = {}) {
  if (!stop) return null;
  const latitude = toNumber(stop.stop_lat ?? stop.latitude);
  const longitude = toNumber(stop.stop_lon ?? stop.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id: String(stop.stop_id ?? stop.id),
    stopId: String(stop.stop_id ?? stop.id),
    stopCode: stop.stop_code || null,
    name: String(stop.stop_name ?? stop.name ?? "Stotelė"),
    title: String(stop.stop_name ?? stop.name ?? "Stotelė"),
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    ...extra,
  };
}

function publicRoute(route) {
  if (!route) return null;
  return {
    routeId: String(route.route_id),
    routeLabel: routeLabel(route),
    routeShortName: route.route_short_name || routeLabel(route),
    routeLongName: route.route_long_name || "",
    routeColor: route.route_color
      ? `#${String(route.route_color).replace("#", "")}`
      : null,
    routeTextColor: route.route_text_color
      ? `#${String(route.route_text_color).replace("#", "")}`
      : null,
  };
}

function secondsFromGtfsTime(time) {
  const parts = String(time || "")
    .split(":")
    .map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [hours, minutes, seconds = 0] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

function gtfsTimeFromSeconds(value) {
  const safe = Math.max(0, Math.round(value));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function nextTripTimeWindow(
  rawDepartureSeconds,
  rawArrivalSeconds,
  afterSeconds,
) {
  let departureSeconds = Number(rawDepartureSeconds);
  let arrivalSeconds = Number(rawArrivalSeconds);
  const after = Number.isFinite(Number(afterSeconds))
    ? Number(afterSeconds)
    : nowSeconds() - 120;

  if (!Number.isFinite(departureSeconds) || !Number.isFinite(arrivalSeconds)) {
    return null;
  }

  // GTFS service times are often stored as "same service day" seconds.
  // If user searches late evening/early morning, do not return walk-only just
  // because today's matching trip already passed. Shift the trip to the next
  // service day and keep the same HH:mm display through humanGtfsTime().
  while (
    departureSeconds < after &&
    departureSeconds + 86400 <= after + 86400
  ) {
    departureSeconds += 86400;
  }

  while (arrivalSeconds < departureSeconds) {
    arrivalSeconds += 86400;
  }

  if (departureSeconds < after) return null;

  return { departureSeconds, arrivalSeconds };
}

const { getVilniusSeconds } = require("../../utils/timezone");

function nowSeconds() {
  return getVilniusSeconds();
}

function secondsFromRequestedTime(value, fallback = nowSeconds()) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toCoordinate(input, fallback) {
  const latitude = Number(
    input?.latitude ??
      input?.lat ??
      input?.stop_lat ??
      input?.coordinate?.latitude ??
      input?.location?.latitude ??
      input?.location?.lat ??
      fallback?.latitude,
  );
  const longitude = Number(
    input?.longitude ??
      input?.lon ??
      input?.lng ??
      input?.stop_lon ??
      input?.coordinate?.longitude ??
      input?.location?.longitude ??
      input?.location?.lng ??
      fallback?.longitude,
  );
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function toCoordinateFromKeys(input, latKeys = [], lngKeys = []) {
  if (!input || typeof input !== "object") return null;

  for (const latKey of latKeys) {
    for (const lngKey of lngKeys) {
      const latitude = Number(String(input?.[latKey] ?? "").replace(",", "."));
      const longitude = Number(String(input?.[lngKey] ?? "").replace(",", "."));

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    }
  }

  return null;
}

function coordinateFromPlanInput(body = {}, role = "to") {
  const prefix = role === "from" ? "from" : "to";
  const altPrefix = role === "from" ? "origin" : "destination";

  return (
    toCoordinate(body?.[altPrefix]) ||
    toCoordinate(body?.[prefix]) ||
    toCoordinate(body?.selectedDestination) ||
    toCoordinateFromKeys(
      body,
      [
        `${prefix}Lat`,
        `${prefix}Latitude`,
        `${altPrefix}Lat`,
        `${altPrefix}Latitude`,
        role === "from" ? "originLat" : "destinationLat",
        role === "from" ? "originLatitude" : "destinationLatitude",
        role === "from" ? "startLat" : "endLat",
        role === "from" ? "startLatitude" : "endLatitude",
        role === "from" ? "from_lat" : "to_lat",
        role === "from" ? "origin_lat" : "destination_lat",
        role === "from" ? "start_lat" : "end_lat",
      ],
      [
        `${prefix}Lng`,
        `${prefix}Lon`,
        `${prefix}Longitude`,
        `${altPrefix}Lng`,
        `${altPrefix}Lon`,
        `${altPrefix}Longitude`,
        role === "from" ? "originLng" : "destinationLng",
        role === "from" ? "originLon" : "destinationLon",
        role === "from" ? "originLongitude" : "destinationLongitude",
        role === "from" ? "startLng" : "endLng",
        role === "from" ? "startLon" : "endLon",
        role === "from" ? "startLongitude" : "endLongitude",
        role === "from" ? "from_lng" : "to_lng",
        role === "from" ? "from_lon" : "to_lon",
        role === "from" ? "origin_lng" : "destination_lng",
        role === "from" ? "origin_lon" : "destination_lon",
        role === "from" ? "start_lng" : "end_lng",
        role === "from" ? "start_lon" : "end_lon",
      ],
    )
  );
}

function makeWalkPolyline(from, to) {
  if (!from || !to) return [];
  return [from, to];
}

async function getWalkingRoute(from, to) {
  if (!from || !to)
    return {
      polyline: makeWalkPolyline(from, to),
      distanceMeters: 0,
      durationMinutes: 0,
      provider: "fallback",
    };
  const result = await orsClient.walkingDirections({ from, to });
  const polyline =
    Array.isArray(result?.polyline) && result.polyline.length >= 2
      ? result.polyline
      : makeWalkPolyline(from, to);
  return {
    ...result,
    polyline,
    distanceMeters: Number.isFinite(Number(result?.distanceMeters))
      ? Number(result.distanceMeters)
      : Math.round(distanceMeters(from, to)),
    durationMinutes: Number.isFinite(Number(result?.durationMinutes))
      ? Number(result.durationMinutes)
      : Math.max(
          1,
          Math.round(distanceMeters(from, to) / WALK_SPEED_M_PER_MIN),
        ),
  };
}

function rebuildPolylineFromSteps(steps, fallbackPolyline = []) {
  const points = [];
  for (const step of steps || []) {
    const line = Array.isArray(step?.polyline) ? step.polyline : [];
    for (const point of line) {
      const coord = toCoordinate(point);
      if (!coord) continue;
      const previous = points[points.length - 1];
      if (!previous || distanceMeters(previous, coord) > 4) points.push(coord);
    }
  }
  return points.length >= 2 ? simplifyPoints(points, 280) : fallbackPolyline;
}

async function enrichPlanWithWalkingGeometry(plan) {
  if (!plan || !Array.isArray(plan.journeySteps)) return plan;
  const steps = await Promise.all(
    plan.journeySteps.map(async (step) => {
      if (
        step?.type !== "walk" ||
        !Array.isArray(step.polyline) ||
        step.polyline.length < 2
      )
        return step;
      const from = toCoordinate(step.polyline[0]);
      const to = toCoordinate(step.polyline[step.polyline.length - 1]);
      if (!from || !to) return step;
      const walk = await getWalkingRoute(from, to);
      return {
        ...step,
        polyline: walk.polyline,
        distanceMeters: Math.round(
          walk.distanceMeters ||
            step.distanceMeters ||
            distanceMeters(from, to),
        ),
        durationMinutes: walk.durationMinutes || step.durationMinutes,
        minutes: walk.durationMinutes || step.minutes,
        provider: walk.provider,
        subtitle: `${Math.round(walk.distanceMeters || step.distanceMeters || 0)} m • ${walk.durationMinutes || step.durationMinutes || step.minutes || 1} min`,
      };
    }),
  );

  const accessWalk = steps.find((step) => step.id?.includes("walk-access"));
  const egressWalk = steps.find((step) => step.id?.includes("walk-egress"));
  const totalWalkMinutes = steps
    .filter((step) => step.type === "walk")
    .reduce(
      (sum, step) => sum + Number(step.durationMinutes || step.minutes || 0),
      0,
    );
  const totalWalkMeters = steps
    .filter((step) => step.type === "walk")
    .reduce((sum, step) => sum + Number(step.distanceMeters || 0), 0);
  const polyline = rebuildPolylineFromSteps(
    steps,
    plan.polyline || plan.previewPoints || [],
  );
  const totalDurationMinutes = Math.max(
    1,
    Number(plan.totalBusMinutes || 0) +
      totalWalkMinutes +
      Number(plan.summary?.transferWaitMinutes || 0),
  );

  return {
    ...plan,
    journeySteps: steps,
    steps,
    polyline,
    previewPoints: polyline,
    totalWalkMinutes,
    walkingMinutes: totalWalkMinutes,
    totalWalkingDistanceMeters: Math.round(totalWalkMeters),
    totalDurationMinutes,
    totalMinutes: totalDurationMinutes,
    walkingProvider: "ors-with-fallback",
    accessWalkProvider: accessWalk?.provider || null,
    egressWalkProvider: egressWalk?.provider || null,
    summary: {
      ...(plan.summary || {}),
      totalWalkMinutes,
      totalDurationMinutes,
      walkingProvider: "ors-with-fallback",
    },
  };
}

function simplifyPoints(points, maxPoints = 180) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points || [];
  const step = Math.ceil(points.length / maxPoints);
  const simplified = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (simplified[simplified.length - 1] !== last) simplified.push(last);
  return simplified;
}

function loadGtfs() {
  if (gtfsCache) return gtfsCache;

  const stops = parseCsv(readFileSafe("stops.txt"));
  const routes = parseCsv(readFileSafe("routes.txt"));
  const trips = parseCsv(readFileSafe("trips.txt"));
  const stopTimes = parseCsv(readFileSafe("stop_times.txt"));
  const shapes = parseCsv(readFileSafe("shapes.txt"));

  const stopsById = new Map();
  const routesById = new Map();
  const tripsById = new Map();
  const tripsByRouteId = new Map();
  const stopTimesByStopId = new Map();
  const stopTimesByTripId = new Map();
  const routeIdsByStopId = new Map();
  const stopsByRouteId = new Map();
  const shapesByShapeId = new Map();

  for (const stop of stops) {
    if (!stop.stop_id) continue;
    stopsById.set(String(stop.stop_id), stop);
  }

  for (const route of routes) {
    if (!route.route_id) continue;
    routesById.set(String(route.route_id), route);
  }

  for (const trip of trips) {
    if (!trip.trip_id) continue;
    tripsById.set(String(trip.trip_id), trip);
    const routeId = String(trip.route_id || "");
    if (!tripsByRouteId.has(routeId)) tripsByRouteId.set(routeId, []);
    tripsByRouteId.get(routeId).push(trip);
  }

  for (const stopTime of stopTimes) {
    const stopId = String(stopTime.stop_id || "");
    const tripId = String(stopTime.trip_id || "");
    if (!stopId || !tripId) continue;

    if (!stopTimesByStopId.has(stopId)) stopTimesByStopId.set(stopId, []);
    stopTimesByStopId.get(stopId).push(stopTime);

    if (!stopTimesByTripId.has(tripId)) stopTimesByTripId.set(tripId, []);
    stopTimesByTripId.get(tripId).push(stopTime);
  }

  for (const list of stopTimesByTripId.values()) {
    list.sort(
      (a, b) => Number(a.stop_sequence || 0) - Number(b.stop_sequence || 0),
    );
  }

  for (const list of stopTimesByStopId.values()) {
    list.sort((a, b) =>
      String(a.departure_time || a.arrival_time).localeCompare(
        String(b.departure_time || b.arrival_time),
      ),
    );
  }

  for (const trip of trips) {
    const routeId = String(trip.route_id || "");
    const tripTimes = stopTimesByTripId.get(String(trip.trip_id)) || [];
    if (!routeId || !tripTimes.length) continue;
    if (!stopsByRouteId.has(routeId)) stopsByRouteId.set(routeId, new Set());
    for (const stopTime of tripTimes) {
      const stopId = String(stopTime.stop_id || "");
      if (!stopId) continue;
      stopsByRouteId.get(routeId).add(stopId);
      if (!routeIdsByStopId.has(stopId))
        routeIdsByStopId.set(stopId, new Set());
      routeIdsByStopId.get(stopId).add(routeId);
    }
  }

  for (const shape of shapes) {
    const shapeId = String(shape.shape_id || "");
    if (!shapeId) continue;
    if (!shapesByShapeId.has(shapeId)) shapesByShapeId.set(shapeId, []);
    const latitude = toNumber(shape.shape_pt_lat);
    const longitude = toNumber(shape.shape_pt_lon);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      shapesByShapeId.get(shapeId).push({
        latitude,
        longitude,
        sequence: Number(shape.shape_pt_sequence || 0),
        distance: Number(shape.shape_dist_traveled || 0),
      });
    }
  }

  for (const list of shapesByShapeId.values()) {
    list.sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
  }

  gtfsCache = {
    stops,
    routes,
    trips,
    stopTimes,
    shapes,
    stopsById,
    routesById,
    tripsById,
    tripsByRouteId,
    stopTimesByStopId,
    stopTimesByTripId,
    routeIdsByStopId,
    stopsByRouteId,
    shapesByShapeId,
    loadedAt: new Date().toISOString(),
  };

  return gtfsCache;
}

function nearestStops(coordinate, limit = 6, maxDistanceMeters = 1600) {
  const gtfs = loadGtfs();
  if (!coordinate) return [];

  return gtfs.stops
    .map((stop) => {
      const publicStop = stopToPublic(stop);
      if (!publicStop) return null;
      const distance = distanceMeters(coordinate, publicStop.coordinate);
      return { ...publicStop, distanceMeters: Math.round(distance) };
    })
    .filter(Boolean)
    .filter((stop) => stop.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

function routesForStop(stopId) {
  const gtfs = loadGtfs();
  const routeIds = Array.from(gtfs.routeIdsByStopId.get(String(stopId)) || []);
  return routeIds
    .map((id) => publicRoute(gtfs.routesById.get(id)))
    .filter(Boolean);
}

function tripStopPublic(stopTime) {
  const gtfs = loadGtfs();
  const stop = stopToPublic(gtfs.stopsById.get(String(stopTime.stop_id)), {
    stopSequence: Number(stopTime.stop_sequence || 0),
    arrivalTime: stopTime.arrival_time,
    departureTime: stopTime.departure_time,
    arrivalSeconds: secondsFromGtfsTime(stopTime.arrival_time),
    departureSeconds: secondsFromGtfsTime(stopTime.departure_time),
  });
  return stop;
}

function nearestShapeIndex(points, coordinate) {
  if (!Array.isArray(points) || !points.length || !coordinate) return -1;

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i += 1) {
    const point = toCoordinate(points[i]);
    if (!point) continue;

    const distance = distanceMeters(point, coordinate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function shapeForTrip(trip, fallbackStops = []) {
  const gtfs = loadGtfs();
  const stopPolyline = fallbackStops
    .map((stop) => stop?.coordinate || toCoordinate(stop))
    .filter(Boolean);

  const shapeId = String(trip?.shape_id || "");
  const fullShape =
    shapeId && gtfs.shapesByShapeId.has(shapeId)
      ? gtfs.shapesByShapeId.get(shapeId)
      : [];

  if (fullShape.length >= 2 && stopPolyline.length >= 2) {
    const startIndex = nearestShapeIndex(fullShape, stopPolyline[0]);
    const endIndex = nearestShapeIndex(
      fullShape,
      stopPolyline[stopPolyline.length - 1],
    );

    if (
      startIndex >= 0 &&
      endIndex >= 0 &&
      Math.abs(endIndex - startIndex) >= 1
    ) {
      const from = Math.min(startIndex, endIndex);
      const to = Math.max(startIndex, endIndex);
      const sliced = fullShape.slice(from, to + 1);

      if (sliced.length >= 2) {
        // GTFS shapes are full line geometry. Slice by nearest boarding/alighting stops
        // so the map does not draw the whole city loop or a random straight fallback.
        return simplifyPoints(sliced, 240);
      }
    }
  }

  if (fullShape.length >= 2 && stopPolyline.length < 2) {
    return simplifyPoints(fullShape, 240);
  }

  return stopPolyline;
}

function findTripSegment(
  routeId,
  fromStopId,
  toStopId,
  afterSeconds = nowSeconds() - 120,
) {
  const gtfs = loadGtfs();
  const trips = gtfs.tripsByRouteId.get(String(routeId)) || [];
  let best = null;

  for (const trip of trips) {
    const times = gtfs.stopTimesByTripId.get(String(trip.trip_id)) || [];
    let fromIndex = -1;
    let toIndex = -1;

    for (let i = 0; i < times.length; i += 1) {
      if (String(times[i].stop_id) === String(fromStopId) && fromIndex < 0)
        fromIndex = i;
      if (fromIndex >= 0 && String(times[i].stop_id) === String(toStopId)) {
        toIndex = i;
        break;
      }
    }

    if (fromIndex < 0 || toIndex <= fromIndex) continue;

    const fromTime = times[fromIndex];
    const toTime = times[toIndex];
    const rawDepartureSeconds = secondsFromGtfsTime(
      fromTime.departure_time || fromTime.arrival_time,
    );
    const rawArrivalSeconds = secondsFromGtfsTime(
      toTime.arrival_time || toTime.departure_time,
    );
    const tripWindow = nextTripTimeWindow(
      rawDepartureSeconds,
      rawArrivalSeconds,
      afterSeconds,
    );
    if (!tripWindow) continue;

    const { departureSeconds, arrivalSeconds } = tripWindow;

    const segmentStops = times
      .slice(fromIndex, toIndex + 1)
      .map(tripStopPublic)
      .filter(Boolean);
    const route = gtfs.routesById.get(String(routeId));
    const durationMinutes = Math.max(
      1,
      Math.round((arrivalSeconds - departureSeconds) / 60),
    );
    const candidate = {
      trip,
      route,
      routeId: String(routeId),
      routeLabel: routeLabel(route),
      fromStopId: String(fromStopId),
      toStopId: String(toStopId),
      fromTime,
      toTime,
      fromSequence: Number(fromTime.stop_sequence || 0),
      toSequence: Number(toTime.stop_sequence || 0),
      departureSeconds,
      arrivalSeconds,
      departureTime: gtfsTimeFromSeconds(departureSeconds),
      arrivalTime: gtfsTimeFromSeconds(arrivalSeconds),
      durationMinutes,
      stopCount: Math.max(0, segmentStops.length - 1),
      stops: segmentStops,
      shapeId: trip.shape_id || null,
      polyline: shapeForTrip(trip, segmentStops),
      headsign: trip.trip_headsign || null,
    };

    if (!best || candidate.departureSeconds < best.departureSeconds)
      best = candidate;
  }

  return best;
}

function candidateDirectRoutes(originStops, destinationStops, options = {}) {
  const gtfs = loadGtfs();
  const after = Number.isFinite(Number(options.afterSeconds))
    ? Number(options.afterSeconds)
    : nowSeconds() - 120;
  const arriveBy = Number.isFinite(Number(options.arriveBySeconds))
    ? Number(options.arriveBySeconds)
    : null;
  const routeOptions = [];

  for (const origin of originStops) {
    const originRoutes = Array.from(
      gtfs.routeIdsByStopId.get(String(origin.id)) || [],
    );
    for (const destination of destinationStops) {
      const destinationRouteIds = new Set(
        Array.from(gtfs.routeIdsByStopId.get(String(destination.id)) || []),
      );
      const sharedRoutes = originRoutes.filter((routeId) =>
        destinationRouteIds.has(routeId),
      );

      for (const routeId of sharedRoutes) {
        const segment = findTripSegment(
          routeId,
          origin.id,
          destination.id,
          after,
        );
        if (!segment) continue;
        if (arriveBy != null && Number(segment.arrivalSeconds) > arriveBy)
          continue;
        const walkingMeters =
          Number(origin.distanceMeters || 0) +
          Number(destination.distanceMeters || 0);
        const walkingMinutes = Math.max(
          1,
          Math.round(walkingMeters / WALK_SPEED_M_PER_MIN),
        );
        const totalMinutes = walkingMinutes + segment.durationMinutes;
        routeOptions.push({
          type: "direct",
          origin,
          destination,
          segments: [segment],
          walkingMeters,
          walkingMinutes,
          totalMinutes,
        });
      }
    }
  }

  return rankAndDedupeCandidates(routeOptions, 4);
}

function candidateTransferRoutes(originStops, destinationStops, options = {}) {
  const gtfs = loadGtfs();
  const after = Number.isFinite(Number(options.afterSeconds))
    ? Number(options.afterSeconds)
    : nowSeconds() - 120;
  const arriveBy = Number.isFinite(Number(options.arriveBySeconds))
    ? Number(options.arriveBySeconds)
    : null;
  const candidates = [];

  for (const origin of originStops.slice(0, 4)) {
    const originRouteIds = Array.from(
      gtfs.routeIdsByStopId.get(String(origin.id)) || [],
    ).slice(0, 16);
    for (const destination of destinationStops.slice(0, 4)) {
      const destinationRouteIds = Array.from(
        gtfs.routeIdsByStopId.get(String(destination.id)) || [],
      ).slice(0, 16);

      for (const firstRouteId of originRouteIds) {
        const firstRouteStops = gtfs.stopsByRouteId.get(String(firstRouteId));
        if (!firstRouteStops) continue;

        for (const secondRouteId of destinationRouteIds) {
          if (String(firstRouteId) === String(secondRouteId)) continue;
          const secondRouteStops = gtfs.stopsByRouteId.get(
            String(secondRouteId),
          );
          if (!secondRouteStops) continue;

          const transferStopIds = [];
          for (const stopId of firstRouteStops) {
            if (secondRouteStops.has(stopId)) transferStopIds.push(stopId);
            if (transferStopIds.length >= 16) break;
          }

          for (const transferStopId of transferStopIds) {
            const leg1 = findTripSegment(
              firstRouteId,
              origin.id,
              transferStopId,
              after,
            );
            if (!leg1) continue;
            const leg2 = findTripSegment(
              secondRouteId,
              transferStopId,
              destination.id,
              leg1.arrivalSeconds + 120,
            );
            if (!leg2) continue;
            if (arriveBy != null && Number(leg2.arrivalSeconds) > arriveBy)
              continue;
            const transferStop = stopToPublic(
              gtfs.stopsById.get(String(transferStopId)),
            );
            if (!transferStop) continue;
            const walkingMeters =
              Number(origin.distanceMeters || 0) +
              Number(destination.distanceMeters || 0);
            const walkingMinutes = Math.max(
              1,
              Math.round(walkingMeters / WALK_SPEED_M_PER_MIN),
            );
            const waitMinutes = Math.max(
              0,
              Math.round((leg2.departureSeconds - leg1.arrivalSeconds) / 60),
            );
            const totalMinutes =
              walkingMinutes +
              leg1.durationMinutes +
              waitMinutes +
              leg2.durationMinutes;
            candidates.push({
              type: "transfer",
              origin,
              destination,
              transferStop,
              segments: [leg1, leg2],
              walkingMeters,
              walkingMinutes,
              waitMinutes,
              totalMinutes,
            });
          }
        }
      }
    }
  }

  return rankAndDedupeCandidates(candidates, 4);
}

function candidateSignature(candidate) {
  const routes = (candidate.segments || [])
    .map((segment) => String(segment.routeLabel || segment.routeId || ""))
    .join(">");
  return [
    candidate.type,
    routes,
    candidate.origin?.id,
    candidate.destination?.id,
    candidate.transferStop?.id || "direct",
  ].join("|");
}

function scoreCandidate(candidate) {
  const transfersPenalty =
    Math.max(0, (candidate.segments || []).length - 1) * 7;
  const walkPenalty = Math.round(Number(candidate.walkingMinutes || 0) * 0.8);
  const waitPenalty = Math.round(Number(candidate.waitMinutes || 0) * 0.35);
  return Math.round(
    Number(candidate.totalMinutes || 999) +
      transfersPenalty +
      walkPenalty +
      waitPenalty,
  );
}

function rankAndDedupeCandidates(candidates = [], limit = 4) {
  const seen = new Set();
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate),
      signature: candidateSignature(candidate),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.totalMinutes !== b.totalMinutes)
        return a.totalMinutes - b.totalMinutes;
      return (
        Math.max(0, (a.segments || []).length - 1) -
        Math.max(0, (b.segments || []).length - 1)
      );
    })
    .filter((candidate) => {
      if (seen.has(candidate.signature)) return false;
      seen.add(candidate.signature);
      return true;
    })
    .slice(0, limit);
}

function humanGtfsTime(value) {
  const seconds = secondsFromGtfsTime(value);
  if (seconds == null) return value || null;
  const normalized = ((seconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildChildGuide(route) {
  const steps = Array.isArray(route?.journeySteps) ? route.journeySteps : [];
  return steps.map((step, index) => {
    const type = String(step.type || step.mode || "step");
    let icon = "➡️";
    let action = step.title || "Kitas žingsnis";

    if (type === "walk") {
      icon = index === steps.length - 1 ? "🏁" : "🚶";
      action = step.title || "Eik iki stotelės";
    } else if (type === "board") {
      icon = "🚌";
      action =
        step.routeNumber || step.routeLabel
          ? `Lipk į ${step.routeNumber || step.routeLabel} autobusą`
          : "Lipk į autobusą";
    } else if (type === "ride" || type === "bus") {
      icon = "🚌";
      action = step.stopCount
        ? `Važiuok ${step.stopCount} stot.`
        : step.title || "Važiuok autobusu";
    } else if (type === "transfer") {
      icon = "🔁";
      action = step.title || "Persėsk į kitą autobusą";
    } else if (type === "arrive") {
      icon = "🏁";
      action = step.title || "Atvykai";
    }

    return {
      id: step.id || `child-guide-${index}`,
      index,
      type,
      icon,
      action,
      title: action,
      subtitle: step.subtitle || null,
      stopName: step.stopName || step.fromStopName || step.toStopName || null,
      routeNumber: step.routeNumber || step.routeLabel || null,
      minutes: Number(step.durationMinutes || step.minutes || 0) || null,
      stopCount: Number(step.stopCount || 0) || null,
      safeText: [action, step.subtitle].filter(Boolean).join(" • "),
    };
  });
}

function attachChildGuide(route) {
  const childGuide = buildChildGuide(route);
  return {
    ...route,
    childGuide,
    parentSummary: {
      routeNumbers: route.routeNumbers || [],
      totalDurationMinutes:
        route.totalDurationMinutes || route.totalMinutes || null,
      transfersCount: route.transfersCount || 0,
      stopCount: route.stopCount || 0,
      boardStopName: route.boardStopName || route.originStop?.name || null,
      alightStopName:
        route.alightStopName || route.destinationStop?.name || null,
      childGuideCount: childGuide.length,
    },
    summary: {
      ...(route.summary || {}),
      childGuide,
    },
  };
}

const FINAL_ROUTING_VERSION = "apple-maps-polish-v3";

function routeDuration(route) {
  return Number(
    route?.totalDurationMinutes ??
      route?.totalMinutes ??
      route?.summary?.totalDurationMinutes ??
      9999,
  );
}

function routeWalkMinutes(route) {
  return Number(
    route?.totalWalkMinutes ??
      route?.walkingMinutes ??
      route?.summary?.totalWalkMinutes ??
      9999,
  );
}

function routeTransfers(route) {
  return Number(
    route?.transfersCount ??
      route?.transfers ??
      route?.summary?.transfersCount ??
      99,
  );
}

function optionSignature(route) {
  const numbers = Array.isArray(route?.routeNumbers)
    ? route.routeNumbers.join(">")
    : String(route?.routeLabel || route?.routeId || "");
  return [
    numbers,
    routeTransfers(route),
    route?.boardStopName || route?.originStop?.name,
    route?.alightStopName || route?.destinationStop?.name,
  ].join("|");
}

function decorateRouteOption(route, optionType, optionLabel, rank) {
  const suffix = optionType ? `-${optionType}` : "";
  const summary = {
    ...(route.summary || {}),
    optionType,
    optionLabel,
    rank,
    totalDurationMinutes: routeDuration(route),
    totalWalkMinutes: routeWalkMinutes(route),
    transfersCount: routeTransfers(route),
  };

  return attachChildGuide({
    ...route,
    id: String(route.id || `route-${rank}`) + suffix,
    optionType,
    optionLabel,
    rank,
    badge: optionLabel,
    summary,
  });
}

function buildPolishedRouteOptions(plans = []) {
  const valid = (plans || []).filter(Boolean);
  if (!valid.length) return [];

  const pickers = [
    {
      type: "fastest",
      label: "Greičiausias",
      sort: (a, b) =>
        routeDuration(a) - routeDuration(b) ||
        routeTransfers(a) - routeTransfers(b) ||
        routeWalkMinutes(a) - routeWalkMinutes(b),
    },
    {
      type: "less_walk",
      label: "Mažiau ėjimo",
      sort: (a, b) =>
        routeWalkMinutes(a) - routeWalkMinutes(b) ||
        routeDuration(a) - routeDuration(b) ||
        routeTransfers(a) - routeTransfers(b),
    },
    {
      type: "less_transfer",
      label: "Mažiau persėdimų",
      sort: (a, b) =>
        routeTransfers(a) - routeTransfers(b) ||
        routeDuration(a) - routeDuration(b) ||
        routeWalkMinutes(a) - routeWalkMinutes(b),
    },
  ];

  const selected = [];
  const seen = new Set();

  pickers.forEach((picker) => {
    const route = [...valid].sort(picker.sort)[0];
    if (!route) return;
    const sig = optionSignature(route);
    if (seen.has(sig)) return;
    seen.add(sig);
    selected.push(
      decorateRouteOption(route, picker.type, picker.label, selected.length),
    );
  });

  for (const route of valid) {
    if (selected.length >= 4) break;
    const sig = optionSignature(route);
    if (seen.has(sig)) continue;
    seen.add(sig);
    selected.push(
      decorateRouteOption(route, "alternative", "Alternatyva", selected.length),
    );
  }

  return selected;
}

function stableFormattedRoutes(routes = []) {
  return routes.map((route) => formatJourney(route));
}

function fallbackOption(from, to, destinationTitle) {
  const meters = Math.round(distanceMeters(from, to));
  const walkingMinutes = Math.max(1, Math.round(meters / WALK_SPEED_M_PER_MIN));
  const polyline = makeWalkPolyline(from, to);
  const route = {
    id: `walk-only-${Math.round(from.latitude * 10000)}-${Math.round(to.latitude * 10000)}`,
    title: "Eiti pėsčiomis",
    subtitle: "Autobusų maršrutas pagal GTFS šiuo metu nerastas",
    mode: "walk",
    routeId: "walk",
    routeLabel: "Pėsčiomis",
    routeNumbers: [],
    totalDurationMinutes: walkingMinutes,
    totalMinutes: walkingMinutes,
    totalWalkMinutes: walkingMinutes,
    walkingMinutes,
    totalBusMinutes: 0,
    transfers: 0,
    transfersCount: 0,
    stopCount: 0,
    boardStopName: "Pradžia",
    alightStopName: destinationTitle,
    originStop: {
      id: "origin-walk",
      name: "Pradžia",
      title: "Pradžia",
      ...from,
      coordinate: from,
      distanceMeters: 0,
    },
    destinationStop: {
      id: "destination-walk",
      name: destinationTitle,
      title: destinationTitle,
      ...to,
      coordinate: to,
      distanceMeters: 0,
    },
    previewPoints: polyline,
    polyline,
    steps: [],
    journeySteps: [
      {
        id: "walk-only-step",
        type: "walk",
        mode: "walk",
        title: `Eik iki „${destinationTitle}“`,
        subtitle: `${meters} m • ${walkingMinutes} min`,
        durationMinutes: walkingMinutes,
        minutes: walkingMinutes,
        distanceMeters: meters,
        polyline,
      },
    ],
    routingQuality: {
      score: 999,
      hasRealtimeGps: false,
      hasGtfsSchedule: false,
      hasWalkingGeometry: false,
      candidateType: "walk_only_fallback",
    },
    summary: {
      routeLabel: "Pėsčiomis",
      routeNumbers: [],
      totalDurationMinutes: walkingMinutes,
      totalWalkMinutes: walkingMinutes,
      totalBusMinutes: 0,
      transfersCount: 0,
      stopCount: 0,
      boardStopName: "Pradžia",
      alightStopName: destinationTitle,
      etaMinutes: null,
      journeyMessage: "Autobusų maršrutas nerastas – rodomas ėjimas pėsčiomis.",
    },
    legs: [
      {
        id: "walk-only-leg",
        type: "walk",
        mode: "walk",
        durationMinutes: walkingMinutes,
        distanceMeters: meters,
        polyline,
      },
    ],
  };

  route.steps = route.journeySteps;
  return attachChildGuide(route);
}

function buildPlanFromCandidate(candidate, from, to, index = 0) {
  const routeNumbers = candidate.segments.map((segment) =>
    String(segment.routeLabel || segment.routeId),
  );
  const routeLabelText = routeNumbers.join(" → ");
  const originStop = candidate.origin;
  const destinationStop = candidate.destination;
  const accessWalkMinutes = Math.max(
    1,
    Math.round(Number(originStop.distanceMeters || 0) / WALK_SPEED_M_PER_MIN),
  );
  const egressWalkMinutes = Math.max(
    1,
    Math.round(
      Number(destinationStop.distanceMeters || 0) / WALK_SPEED_M_PER_MIN,
    ),
  );
  const firstDeparture =
    humanGtfsTime(candidate.segments[0]?.departureTime) || null;
  const lastArrival =
    humanGtfsTime(
      candidate.segments[candidate.segments.length - 1]?.arrivalTime,
    ) || null;
  const busMinutes = candidate.segments.reduce(
    (sum, segment) => sum + segment.durationMinutes,
    0,
  );
  const stopCount = candidate.segments.reduce(
    (sum, segment) => sum + segment.stopCount,
    0,
  );
  const transfersCount = Math.max(0, candidate.segments.length - 1);
  const polyline = [
    from,
    originStop.coordinate,
    ...candidate.segments.flatMap((segment) => segment.polyline),
    destinationStop.coordinate,
    to,
  ]
    .filter(Boolean)
    .filter(
      (point, pointIndex, arr) =>
        pointIndex === 0 || distanceMeters(point, arr[pointIndex - 1]) > 4,
    );

  const journeySteps = [];
  journeySteps.push({
    id: `walk-access-${index}`,
    type: "walk",
    mode: "walk",
    title: `Eik iki stotelės „${originStop.name}“`,
    subtitle: `${Math.round(originStop.distanceMeters || 0)} m • ${accessWalkMinutes} min`,
    stopId: originStop.id,
    stopName: originStop.name,
    durationMinutes: accessWalkMinutes,
    minutes: accessWalkMinutes,
    distanceMeters: Math.round(originStop.distanceMeters || 0),
    polyline: makeWalkPolyline(from, originStop.coordinate),
  });

  candidate.segments.forEach((segment, segmentIndex) => {
    const boardStop = segment.stops[0];
    const alightStop = segment.stops[segment.stops.length - 1];
    journeySteps.push({
      id: `board-${index}-${segmentIndex}`,
      type: "board",
      mode: "bus",
      title: `Lipk į autobusą ${segment.routeLabel}`,
      subtitle: `${boardStop?.name || originStop.name} • ${humanGtfsTime(segment.departureTime)}${segment.headsign ? ` • ${segment.headsign}` : ""}`,
      routeId: segment.routeId,
      routeNumber: segment.routeLabel,
      routeLabel: segment.routeLabel,
      stopId: boardStop?.id || segment.fromStopId,
      stopName: boardStop?.name || originStop.name,
      departureTime: humanGtfsTime(segment.departureTime),
      headsign: segment.headsign,
      polyline: [boardStop?.coordinate || originStop.coordinate],
    });
    journeySteps.push({
      id: `ride-${index}-${segmentIndex}`,
      type: "ride",
      mode: "bus",
      title: `Važiuok autobusu ${segment.routeLabel}`,
      subtitle: `Iki „${alightStop?.name || destinationStop.name}“ • ${segment.stopCount} st. • ${segment.durationMinutes} min`,
      routeId: segment.routeId,
      routeNumber: segment.routeLabel,
      routeLabel: segment.routeLabel,
      fromStopId: boardStop?.id || segment.fromStopId,
      toStopId: alightStop?.id || segment.toStopId,
      fromStopName: boardStop?.name || originStop.name,
      toStopName: alightStop?.name || destinationStop.name,
      stopCount: segment.stopCount,
      durationMinutes: segment.durationMinutes,
      minutes: segment.durationMinutes,
      departureTime: humanGtfsTime(segment.departureTime),
      arrivalTime: humanGtfsTime(segment.arrivalTime),
      stops: segment.stops,
      rideStops: segment.stops,
      routeStops: segment.stops,
      polyline: segment.polyline,
      headsign: segment.headsign,
    });

    if (segmentIndex < candidate.segments.length - 1) {
      const transfer = candidate.transferStop;
      const wait = candidate.waitMinutes || 2;
      journeySteps.push({
        id: `transfer-${index}-${segmentIndex}`,
        type: "transfer",
        mode: "walk",
        title: `Persėsk stotelėje „${transfer?.name || alightStop?.name || "Persėdimas"}“`,
        subtitle: `Lauk ${wait} min • kitas autobusas ${candidate.segments[segmentIndex + 1].routeLabel}`,
        transferFromRoute: segment.routeLabel,
        transferToRoute: candidate.segments[segmentIndex + 1].routeLabel,
        transferWaitMinutes: wait,
        stopId: transfer?.id,
        stopName: transfer?.name,
        durationMinutes: wait,
        minutes: wait,
        polyline: transfer?.coordinate
          ? [transfer.coordinate, transfer.coordinate]
          : [],
      });
    }
  });

  journeySteps.push({
    id: `walk-egress-${index}`,
    type: "walk",
    mode: "walk",
    title: `Eik iki tikslo`,
    subtitle: `Nuo „${destinationStop.name}“ • ${Math.round(destinationStop.distanceMeters || 0)} m • ${egressWalkMinutes} min`,
    stopId: destinationStop.id,
    stopName: destinationStop.name,
    durationMinutes: egressWalkMinutes,
    minutes: egressWalkMinutes,
    distanceMeters: Math.round(destinationStop.distanceMeters || 0),
    polyline: makeWalkPolyline(destinationStop.coordinate, to),
  });

  const totalDurationMinutes = Math.max(1, candidate.totalMinutes);
  const etaMinutes = Math.max(
    0,
    Math.round((candidate.segments[0]?.departureSeconds - nowSeconds()) / 60),
  );

  const route = {
    id: `${candidate.type}-${routeNumbers.join("-")}-${index}`,
    title: transfersCount
      ? `Autobusai ${routeLabelText}`
      : `Autobusas ${routeLabelText}`,
    mode: transfersCount ? "mixed" : "bus",
    routeId: candidate.segments[0]?.routeId || routeNumbers[0],
    routeLabel: routeLabelText,
    routeNumbers,
    shapeId: candidate.segments[0]?.shapeId || null,
    totalDurationMinutes,
    totalMinutes: totalDurationMinutes,
    totalWalkMinutes: accessWalkMinutes + egressWalkMinutes,
    walkingMinutes: accessWalkMinutes + egressWalkMinutes,
    totalBusMinutes: busMinutes,
    etaMinutes,
    liveEta: { etaMinutes, etaSeconds: etaMinutes * 60, distanceMeters: null },
    boardingState:
      etaMinutes <= 2
        ? "boarding_soon"
        : etaMinutes <= 6
          ? "on_the_way"
          : "later",
    routingQuality: {
      score: Number(candidate.score || scoreCandidate(candidate)),
      hasRealtimeGps: false,
      hasGtfsSchedule: true,
      hasWalkingGeometry: true,
      candidateType: candidate.type,
      signature: candidate.signature || candidateSignature(candidate),
    },
    transfers: transfersCount,
    transfersCount,
    stopCount,
    boardStopName: originStop.name,
    alightStopName: destinationStop.name,
    originStop,
    destinationStop,
    transferStops: candidate.transferStop ? [candidate.transferStop] : [],
    transferMessages: candidate.transferStop
      ? [`Persėsk: ${candidate.transferStop.name}`]
      : [],
    previewPoints: polyline,
    polyline: simplifyPoints(polyline, 250),
    steps: journeySteps,
    journeySteps,
    departureText: firstDeparture,
    arrivalText: lastArrival,
    headsign: candidate.segments[0]?.headsign || null,
    journeyMessage: transfersCount
      ? `Važiuok ${routeLabelText} su persėdimu ties „${candidate.transferStop?.name || "persėdimo stotele"}“`
      : `Važiuok autobusu ${routeLabelText} iki „${destinationStop.name}“`,
    summary: {
      routeLabel: routeLabelText,
      routeNumbers,
      totalDurationMinutes,
      totalWalkMinutes: accessWalkMinutes + egressWalkMinutes,
      totalBusMinutes: busMinutes,
      transfersCount,
      stopCount,
      boardStopName: originStop.name,
      alightStopName: destinationStop.name,
      etaMinutes,
      departureTime: firstDeparture,
      arrivalTime: lastArrival,
      headsign: candidate.segments[0]?.headsign || null,
      journeyMessage: transfersCount
        ? `Važiuok ${routeLabelText} su persėdimu ties „${candidate.transferStop?.name || "persėdimo stotele"}“`
        : `Važiuok autobusu ${routeLabelText} iki „${destinationStop.name}“`,
      routingQuality: {
        score: Number(candidate.score || scoreCandidate(candidate)),
        candidateType: candidate.type,
        hasGtfsSchedule: true,
        hasWalkingGeometry: true,
      },
    },
    legs: candidate.segments.map((segment) => ({
      id: segment.trip.trip_id,
      type: "bus",
      mode: "bus",
      routeId: segment.routeId,
      routeNumber: segment.routeLabel,
      routeLabel: segment.routeLabel,
      fromStopName: segment.stops[0]?.name,
      toStopName: segment.stops[segment.stops.length - 1]?.name,
      stops: segment.stops,
      durationMinutes: segment.durationMinutes,
      stopCount: segment.stopCount,
      polyline: segment.polyline,
    })),
  };

  return attachChildGuide(route);
}


function coordinateForPublicPoint(point) {
  const latitude = toNumber(point?.latitude ?? point?.coordinate?.latitude);
  const longitude = toNumber(point?.longitude ?? point?.coordinate?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function ferryTerminalPoint(terminal) {
  const coordinate = coordinateForPublicPoint(terminal);
  if (!coordinate) return null;
  return {
    id: terminal.id,
    stopId: terminal.id,
    name: terminal.name,
    title: terminal.name,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
  };
}

function shouldUseFerryRoute(from, to, route) {
  const fromTerminal = coordinateForPublicPoint(route.from);
  const toTerminal = coordinateForPublicPoint(route.to);
  if (!fromTerminal || !toTerminal) return false;

  const originWalk = distanceMeters(from, fromTerminal);
  const destinationWalk = distanceMeters(to, toTerminal);
  const reverseOriginWalk = distanceMeters(from, toTerminal);
  const reverseDestinationWalk = distanceMeters(to, fromTerminal);

  const maxAccessMeters = route.serviceType === "seasonal_passenger_boat" ? 2800 : 1800;
  const maxEgressMeters = route.serviceType === "seasonal_passenger_boat" ? 4200 : 1800;

  return (
    originWalk <= maxAccessMeters && destinationWalk <= maxEgressMeters &&
    originWalk + destinationWalk <= reverseOriginWalk + reverseDestinationWalk
  );
}

function buildFerryRouteOption(route, from, to, index = 0, options = {}) {
  const fromTerminal = ferryTerminalPoint(route.from);
  const toTerminal = ferryTerminalPoint(route.to);
  if (!fromTerminal || !toTerminal) return null;

  const fromPoint = coordinateForPublicPoint(from) || from;
  const toPoint = coordinateForPublicPoint(to) || to;
  const accessMeters = Math.max(0, Math.round(distanceMeters(fromPoint, fromTerminal.coordinate)));
  const egressMeters = Math.max(0, Math.round(distanceMeters(toTerminal.coordinate, toPoint)));
  const accessWalkMinutes = Math.max(0, Math.round(accessMeters / WALK_SPEED_M_PER_MIN));
  const egressWalkMinutes = Math.max(0, Math.round(egressMeters / WALK_SPEED_M_PER_MIN));
  const next = ferryService.getNextDepartures({ routeId: route.id, limit: 1, now: options.now || new Date() })[0] || null;
  const waitMinutes = Math.max(0, Number(next?.minutesUntil || 0));
  const ferryMinutes = Math.max(1, Number(route.durationMinutes || 1));
  const totalDurationMinutes = Math.max(1, accessWalkMinutes + waitMinutes + ferryMinutes + egressWalkMinutes);
  const ferryPolyline = [fromTerminal.coordinate, toTerminal.coordinate];
  const polyline = [fromPoint, fromTerminal.coordinate, toTerminal.coordinate, toPoint]
    .filter((point) => Number.isFinite(Number(point?.latitude)) && Number.isFinite(Number(point?.longitude)));

  const journeySteps = [];

  if (accessWalkMinutes > 0) {
    journeySteps.push({
      id: `${route.id}-walk-access`,
      type: "walk",
      mode: "walk",
      title: `Eik iki ${route.from.name}`,
      subtitle: `${accessWalkMinutes} min pėsčiomis`,
      minutes: accessWalkMinutes,
      durationMinutes: accessWalkMinutes,
      distanceMeters: accessMeters,
      polyline: [fromPoint, fromTerminal.coordinate],
      toStopName: route.from.name,
      toStop: fromTerminal,
    });
  }

  journeySteps.push({
    id: `${route.id}-ferry`,
    type: "ferry",
    mode: "ferry",
    routeId: route.id,
    routeNumber: route.routeCode,
    routeLabel: route.ferryLine || route.title,
    title: route.title,
    subtitle: next ? `${route.ferryLine || "Keltas"} • išvyksta ${next.departureTime}` : (route.ferryLine || "Keltas"),
    minutes: ferryMinutes,
    durationMinutes: ferryMinutes,
    departureTime: next?.departureTime || null,
    arrivalTime: next?.arrivalAt || null,
    fromStopName: route.from.name,
    toStopName: route.to.name,
    fromStop: fromTerminal,
    toStop: toTerminal,
    stops: [fromTerminal, toTerminal],
    stopCount: 2,
    polyline: ferryPolyline,
  });

  if (egressWalkMinutes > 0) {
    journeySteps.push({
      id: `${route.id}-walk-egress`,
      type: "walk",
      mode: "walk",
      title: `Eik iki tikslo`,
      subtitle: `${egressWalkMinutes} min pėsčiomis`,
      minutes: egressWalkMinutes,
      durationMinutes: egressWalkMinutes,
      distanceMeters: egressMeters,
      polyline: [toTerminal.coordinate, toPoint],
      fromStopName: route.to.name,
      fromStop: toTerminal,
    });
  }

  const routeLabelText = route.ferryLine || route.title;

  return attachChildGuide({
    id: `ferry-${route.id}-${index}`,
    title: route.title,
    subtitle: `${routeLabelText} • ${totalDurationMinutes} min`,
    mode: "ferry",
    routeId: route.id,
    ferryRouteId: route.id,
    ferryLine: route.ferryLine || null,
    pierType: String(route.ferryLine || route.id).toLowerCase().includes("naujoji") ? "new" : String(route.ferryLine || route.id).toLowerCase().includes("senoji") ? "old" : "nida",
    routeLabel: routeLabelText,
    routeNumbers: [],
    totalMinutes: totalDurationMinutes,
    totalDurationMinutes,
    walkingMinutes: accessWalkMinutes + egressWalkMinutes,
    totalWalkMinutes: accessWalkMinutes + egressWalkMinutes,
    totalBusMinutes: 0,
    etaMinutes: totalDurationMinutes,
    transfers: 0,
    transfersCount: 0,
    stopCount: 2,
    boardStopName: route.from.name,
    alightStopName: route.to.name,
    originStop: fromTerminal,
    destinationStop: toTerminal,
    transferStops: [],
    transferMessages: [],
    previewPoints: polyline,
    polyline,
    steps: journeySteps,
    journeySteps,
    departureText: next?.departureTime || null,
    arrivalText: next?.arrivalAt || null,
    journeyMessage: `Plauk ${routeLabelText} maršrutu iki „${route.to.name}“`,
    summary: {
      routeLabel: routeLabelText,
      routeNumbers: [],
      totalDurationMinutes,
      totalWalkMinutes: accessWalkMinutes + egressWalkMinutes,
      totalBusMinutes: 0,
      transfersCount: 0,
      stopCount: 2,
      boardStopName: route.from.name,
      alightStopName: route.to.name,
      etaMinutes: totalDurationMinutes,
      departureTime: next?.departureTime || null,
      arrivalTime: next?.arrivalAt || null,
      journeyMessage: `Plauk ${routeLabelText} maršrutu iki „${route.to.name}“`,
      optionType: "ferry",
      optionLabel: routeLabelText,
      routingQuality: {
        score: totalDurationMinutes,
        candidateType: "ferry_schedule",
        hasGtfsSchedule: false,
        hasFerrySchedule: true,
        hasWalkingGeometry: true,
      },
    },
    legs: [
      {
        id: route.id,
        type: "ferry",
        mode: "ferry",
        routeId: route.id,
        routeNumber: route.routeCode,
        routeLabel: routeLabelText,
        fromStopName: route.from.name,
        toStopName: route.to.name,
        fromStop: fromTerminal,
        toStop: toTerminal,
        stops: [fromTerminal, toTerminal],
        durationMinutes: ferryMinutes,
        stopCount: 2,
        polyline: ferryPolyline,
      },
    ],
  });
}

function buildFerryPlans(from, to, options = {}) {
  return ferryService
    .getRoutes()
    .filter((route) => shouldUseFerryRoute(from, to, route))
    .map((route, index) => buildFerryRouteOption(route, from, to, index, options))
    .filter(Boolean)
    .sort((a, b) => Number(a.totalDurationMinutes || 999) - Number(b.totalDurationMinutes || 999))
    .slice(0, 3);
}

function buildTransitCandidatesForStops(
  originStops,
  destinationStops,
  planTimeOptions,
  limit = 8,
) {
  return rankAndDedupeCandidates(
    [
      ...candidateDirectRoutes(originStops, destinationStops, planTimeOptions),
      ...candidateTransferRoutes(
        originStops,
        destinationStops,
        planTimeOptions,
      ),
    ],
    limit,
  );
}

function planSearchProfiles(from, to) {
  return [
    { limit: 8, radius: 2200, label: "nearby" },
    { limit: 12, radius: 3500, label: "expanded" },
    { limit: 16, radius: 5200, label: "wide" },
    { limit: 24, radius: 10000, label: "regional" },
    { limit: 32, radius: 25000, label: "regional-max" },
  ].map((profile) => ({
    ...profile,
    originStops: nearestStops(from, profile.limit, profile.radius),
    destinationStops: nearestStops(to, profile.limit, profile.radius),
  }));
}

async function plan(body = {}) {
  const defaultOrigin = { latitude: 55.7033, longitude: 21.1443 };
  const defaultDestination = { latitude: 55.68962, longitude: 21.14691 };

  const from = coordinateFromPlanInput(body, "from") || defaultOrigin;
  const to = coordinateFromPlanInput(body, "to") || defaultDestination;

  const engine = String(
    body.engine || process.env.TRANSIT_ENGINE || "legacy",
  ).toLowerCase();
  if ((engine === "otp" || engine === "otp2") && otpService.enabled()) {
    const timeModeForOtp = ["now", "depart", "arrive"].includes(
      String(body.timeMode),
    )
      ? String(body.timeMode)
      : "now";
    const travelDate = body.travelAt ? new Date(body.travelAt) : new Date();
    const otpResult = await otpService.plan({
      from,
      to,
      date: Number.isNaN(travelDate.getTime())
        ? null
        : travelDate.toISOString().slice(0, 10),
      time: Number.isNaN(travelDate.getTime())
        ? null
        : travelDate.toTimeString().slice(0, 5),
      arriveBy: timeModeForOtp === "arrive",
      timeoutMs: Number(process.env.OTP_TIMEOUT_MS || 9000),
    });

    if (
      otpResult?.ok &&
      Array.isArray(otpResult.routes) &&
      otpResult.routes.length
    ) {
      return {
        ...otpResult,
        meta: {
          ...(otpResult.meta || {}),
          engine: "otp2",
          from,
          to,
          fallbackAvailable: true,
        },
      };
    }

    if (
      String(process.env.TRANSIT_OTP_STRICT || "false").toLowerCase() === "true"
    ) {
      return {
        ok: false,
        source: "otp2",
        error: otpResult?.error || otpResult?.reason || "OTP_NO_ROUTES",
        routes: [],
        options: [],
        plan: null,
        meta: { engine: "otp2", from, to },
      };
    }
    // Fallback to legacy planner while OTP2 is being rolled out.
  }

  const destinationTitle =
    body.selectedDestination?.title ||
    body.destination?.title ||
    body.to?.title ||
    body.destinationTitle ||
    body.toTitle ||
    body.title ||
    "Tikslas";
  const timeMode = ["now", "depart", "arrive"].includes(String(body.timeMode))
    ? String(body.timeMode)
    : "now";
  const requestedSeconds = secondsFromRequestedTime(
    body.travelAt,
    nowSeconds(),
  );
  const planTimeOptions =
    timeMode === "arrive"
      ? {
          afterSeconds: Math.max(0, requestedSeconds - 4 * 3600),
          arriveBySeconds: requestedSeconds,
        }
      : {
          afterSeconds:
            timeMode === "depart" ? requestedSeconds : nowSeconds() - 120,
        };

  const ferryPlans = buildFerryPlans(from, to, { now: body.travelAt ? new Date(body.travelAt) : new Date() });

  const profiles = planSearchProfiles(from, to);
  let selectedProfile = profiles[0];
  let candidates = [];

  for (const profile of profiles) {
    const profileCandidates = buildTransitCandidatesForStops(
      profile.originStops,
      profile.destinationStops,
      planTimeOptions,
      8,
    );

    if (profileCandidates.length) {
      selectedProfile = profile;
      candidates = profileCandidates;
      break;
    }
  }

  const originStops = selectedProfile.originStops;
  const destinationStops = selectedProfile.destinationStops;

  const basePlans = candidates
    .slice(0, 4)
    .map((candidate, index) =>
      buildPlanFromCandidate(candidate, from, to, index),
    );

  const shouldEnrichWalkingGeometry =
    body.includeWalkingGeometry === true ||
    String(
      process.env.TRANSIT_INCLUDE_WALKING_GEOMETRY || "false",
    ).toLowerCase() === "true";

  const plans = shouldEnrichWalkingGeometry
    ? await Promise.all(
        basePlans.map((route) =>
          enrichPlanWithWalkingGeometry(route).then(attachChildGuide),
        ),
      )
    : basePlans.map(attachChildGuide);

  if (!plans.length && ferryPlans.length) {
    return {
      ok: true,
      source: "ferries+schedule",
      plan: ferryPlans[0],
      options: ferryPlans,
      routes: ferryPlans,
      meta: {
        routingVersion: FINAL_ROUTING_VERSION,
        routeOptionTypes: ferryPlans.map((route) => route.summary?.optionType || "ferry"),
        hasRealBusRoute: false,
        hasFerryRoute: true,
        walkingGeometryHydrated: false,
        originStops: originStops.length,
        destinationStops: destinationStops.length,
        searchProfile: selectedProfile?.label || "none",
        searchRadiusMeters: selectedProfile?.radius || null,
        timeMode,
        travelAt: body.travelAt || null,
        from,
        to,
      },
    };
  }

  if (!plans.length) {
    // Do not return absurd long walking-only plans such as 2474 min.
    // Apple/Google-style UX should either return real transit options or a clear
    // no-route state, while the UI may still offer walking separately later.
    return {
      ok: true,
      source: "gtfs-no-transit-route",
      plan: null,
      options: [],
      routes: [],
      message: "NO_TRANSIT_ROUTE_FOUND",
      meta: {
        routingVersion: FINAL_ROUTING_VERSION,
        routeOptionTypes: [],
        hasRealBusRoute: false,
        walkingGeometryHydrated: false,
        originStops: originStops.length,
        destinationStops: destinationStops.length,
        searchProfile: selectedProfile?.label || "none",
        searchRadiusMeters: selectedProfile?.radius || null,
      },
    };
  }

  const candidatePlans = [...plans, ...ferryPlans]
    .sort((a, b) => Number(a.totalDurationMinutes || 999) - Number(b.totalDurationMinutes || 999))
    .slice(0, 6);

  const polishedOptions = buildPolishedRouteOptions(candidatePlans);
  const formattedOptions = stableFormattedRoutes(
    polishedOptions.length ? polishedOptions : candidatePlans,
  );

  return {
    ok: true,
    source: "gtfs+stops.lt+ors",
    plan: formattedOptions[0],
    options: formattedOptions,
    routes: formattedOptions,
    meta: {
      originStops: originStops.length,
      destinationStops: destinationStops.length,
      candidates: candidates.length,
      searchProfile: selectedProfile?.label || "nearby",
      searchRadiusMeters: selectedProfile?.radius || 2200,
      routingVersion: FINAL_ROUTING_VERSION,
      routeOptionTypes: formattedOptions.map(
        (route) => route.summary?.optionType || route.optionType || "route",
      ),
      fields: [
        "journeySteps",
        "childGuide",
        "parentSummary",
        "legs",
        "stopCount",
        "transfersCount",
        "departureText",
        "arrivalText",
        "routingQuality",
        "optionType",
        "optionLabel",
      ],
      walkingGeometryHydrated: shouldEnrichWalkingGeometry,
      timeMode,
      travelAt: body.travelAt || null,
      from,
      to,
    },
  };
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(
      url,
      {
        timeout: 12000,
        headers: {
          "User-Agent": "Arbebus/1.0 live-buses backend",
          Accept: "text/plain,*/*",
        },
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`GPS feed returned HTTP ${res.statusCode}`));
          return;
        }
        res.setEncoding("utf8");
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve(body));
      },
    );
    req.on("timeout", () => req.destroy(new Error("GPS feed timeout")));
    req.on("error", reject);
  });
}

function normalizeCoordinate(value) {
  const number = Number(String(value).replace(",", "."));
  if (!Number.isFinite(number)) return null;
  if (Math.abs(number) > 100000) return number / 1000000;
  return number;
}

function isInKlaipeda(latitude, longitude) {
  return (
    latitude >= KLAIPEDA_BOUNDS.minLat &&
    latitude <= KLAIPEDA_BOUNDS.maxLat &&
    longitude >= KLAIPEDA_BOUNDS.minLon &&
    longitude <= KLAIPEDA_BOUNDS.maxLon
  );
}

function detectCoordinates(tokens) {
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const first = normalizeCoordinate(tokens[i]);
    const second = normalizeCoordinate(tokens[i + 1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
    if (isInKlaipeda(first, second))
      return {
        latitude: first,
        longitude: second,
        latIndex: i,
        lonIndex: i + 1,
      };
    if (isInKlaipeda(second, first))
      return {
        latitude: second,
        longitude: first,
        latIndex: i + 1,
        lonIndex: i,
      };
  }
  return null;
}

function detectRouteNumber(tokens, latIndex, lonIndex) {
  const candidates = tokens
    .map((token, index) => ({ token: String(token).trim(), index }))
    .filter(
      ({ token, index }) =>
        index !== latIndex &&
        index !== lonIndex &&
        /^[0-9]{1,3}[A-Za-z]?$/.test(token),
    );
  if (candidates.length === 0) return null;
  return candidates[0].token;
}

function detectVehicleId(tokens, fallback) {
  const vehicleLike = tokens.find((token) =>
    /^[A-Za-z0-9_-]{3,}$/.test(String(token).trim()),
  );
  return vehicleLike || fallback;
}

function detectBearing(tokens, latIndex, lonIndex) {
  const nums = tokens
    .map((token, index) => ({
      value: Number(String(token).replace(",", ".")),
      index,
    }))
    .filter(
      ({ value, index }) =>
        Number.isFinite(value) && index !== latIndex && index !== lonIndex,
    );
  const bearing = nums.find(({ value }) => value >= 0 && value <= 360);
  return bearing ? Math.round(bearing.value) : 0;
}

function sanitizeVehicleId(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function parseStructuredGpsFeed(text) {
  const fetchedAt = new Date().toISOString();
  const raw = String(text || "").replace(/^\uFEFF/, "");
  const tokens = parseCsvLine(raw.replace(/\r?\n/g, " "));
  const header = [
    "Transportas",
    "Marsrutas",
    "ReisoID",
    "MasinosNumeris",
    "Ilguma",
    "Platuma",
    "Greitis",
    "Azimutas",
    "ReisoPradziaMinutemis",
    "NuokrypisSekundemis",
    "KryptiesPavadinimas",
  ];

  const startsWithHeader = header.every(
    (name, index) => String(tokens[index] || "").trim() === name,
  );

  if (!startsWithHeader) return [];

  const buses = [];
  const seen = new Set();
  const width = header.length;

  for (let i = width; i + width - 1 < tokens.length; i += width) {
    const row = {};
    header.forEach((name, offset) => {
      row[name] = String(tokens[i + offset] ?? "").trim();
    });

    const longitude = normalizeCoordinate(row.Ilguma);
    const latitude = normalizeCoordinate(row.Platuma);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (!isInKlaipeda(latitude, longitude)) continue;

    const routeNumber = String(row.Marsrutas || "bus").trim();
    const tripId = sanitizeVehicleId(row.ReisoID);
    const plate = sanitizeVehicleId(row.MasinosNumeris);
    const vehicleId =
      plate ||
      tripId ||
      `${routeNumber}-${latitude.toFixed(5)}-${longitude.toFixed(5)}`;
    const id = `${vehicleId}-${routeNumber}`;

    // The same feed sometimes repeats a vehicle inside one response. Keep only
    // one stable record so React markers do not remount and jump.
    const seenKey = `${vehicleId}-${routeNumber}`;
    if (seen.has(seenKey)) continue;
    seen.add(seenKey);

    const speedKph = toNumber(row.Greitis);
    const bearing = toNumber(row.Azimutas);
    const delaySeconds = toNumber(row.NuokrypisSekundemis);
    const tripStartMinutes = toNumber(row.ReisoPradziaMinutemis);

    buses.push({
      id,
      vehicleId: String(vehicleId),
      number: String(routeNumber),
      route: String(routeNumber),
      routeId: String(routeNumber),
      routeNumber: String(routeNumber),
      vehicleLabel: String(plate || vehicleId),
      tripId: tripId || null,
      latitude,
      longitude,
      coordinate: { latitude, longitude },
      bearing: Number.isFinite(bearing) ? Math.round(bearing) : 0,
      heading: Number.isFinite(bearing) ? Math.round(bearing) : 0,
      speedKph: Number.isFinite(speedKph) ? speedKph : null,
      tripStart: Number.isFinite(tripStartMinutes) ? tripStartMinutes : null,
      delaySeconds: Number.isFinite(delaySeconds) ? delaySeconds : 0,
      directionName: row.KryptiesPavadinimas || null,
      raw: row,
      source: "stops.lt",
      fetchedAt,
    });
  }

  return buses;
}

function parseHeuristicGpsFeed(text) {
  const fetchedAt = new Date().toISOString();
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const buses = [];
  const seen = new Set();

  for (const line of lines) {
    const tokens = line
      .split(/[;,\t| ]+/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length < 3) continue;
    const coords = detectCoordinates(tokens);
    if (!coords) continue;
    const routeNumber =
      detectRouteNumber(tokens, coords.latIndex, coords.lonIndex) || "bus";
    const vehicleId = detectVehicleId(
      tokens.filter((token) => String(token).toLowerCase() !== "autobusai"),
      `${routeNumber}-${coords.latitude.toFixed(5)}-${coords.longitude.toFixed(5)}`,
    );
    const id = `${vehicleId}-${routeNumber}`;
    if (seen.has(id)) continue;
    seen.add(id);
    buses.push({
      id,
      vehicleId: String(vehicleId),
      number: String(routeNumber),
      route: String(routeNumber),
      routeId: String(routeNumber),
      routeNumber: String(routeNumber),
      vehicleLabel: String(vehicleId),
      latitude: coords.latitude,
      longitude: coords.longitude,
      coordinate: { latitude: coords.latitude, longitude: coords.longitude },
      bearing: detectBearing(tokens, coords.latIndex, coords.lonIndex),
      heading: detectBearing(tokens, coords.latIndex, coords.lonIndex),
      speedKph: null,
      raw: tokens,
      source: "stops.lt",
      fetchedAt,
    });
  }
  return buses;
}

function buildShapePointsByTripId(gtfs) {
  const map = new Map();

  if (!gtfs || !gtfs.tripsById || !gtfs.shapesByShapeId) return map;

  for (const trip of gtfs.tripsById.values()) {
    const tripId = String(trip.trip_id || "");
    const routeId = String(trip.route_id || "");
    const shapeId = String(trip.shape_id || "");

    if (!tripId || !shapeId) continue;

    const points = gtfs.shapesByShapeId.get(shapeId) || [];
    if (points.length >= 2) {
      map.set(tripId, points);
      if (routeId && !map.has(routeId)) map.set(routeId, points);
    }
  }

  return map;
}

function parseGpsFeed(text) {
  const structured = parseStructuredGpsFeed(text);
  if (structured.length > 5) return structured;
  return parseHeuristicGpsFeed(text);
}

function normalizeLiveRoute(value) {
  return String(value ?? "")
    .trim()
    .split("•")[0]
    .split(" ")[0]
    .replace(/^0+/, "")
    .toUpperCase();
}

function requestedLiveRouteNumbers(options = {}) {
  const raw =
    options.routeNumber ||
    options.route ||
    options.routeId ||
    options.routeLabel ||
    options.routes ||
    options.routeNumbers ||
    "";

  return String(raw).split(/[;,|]/).map(normalizeLiveRoute).filter(Boolean);
}

function liveBusMatchesRoutes(bus, routeNumbers = []) {
  if (!routeNumbers.length) return true;

  const values = [
    bus.routeNumber,
    bus.routeShortName,
    bus.routeLabel,
    bus.route,
    bus.number,
    bus.routeId,
  ].map(normalizeLiveRoute);

  return values.some((value) => value && routeNumbers.includes(value));
}

function liveBusMatchesVehicle(bus, vehicleId) {
  const requested = String(vehicleId || "").trim();
  if (!requested) return true;

  return [bus.id, bus.vehicleId, bus.vehicleLabel].some(
    (value) => String(value || "").trim() === requested,
  );
}

async function liveBuses(options = {}) {
  const now = Date.now();

  const requestedRoutes = requestedLiveRouteNumbers(options);
  const requestedVehicleId =
    options.vehicleId || options.vehicle || options.busId || null;

  const filterLiveResponse = (response) => {
    const allBuses = Array.isArray(response?.buses) ? response.buses : [];
    const filteredBuses = allBuses.filter(
      (bus) =>
        liveBusMatchesRoutes(bus, requestedRoutes) &&
        liveBusMatchesVehicle(bus, requestedVehicleId),
    );

    return {
      ...response,
      count: filteredBuses.length,
      buses: filteredBuses,
      vehicles: filteredBuses,
      allVehicleCount: allBuses.length,
      selectedRouteNumbers: requestedRoutes,
      selectedVehicleId: requestedVehicleId || null,
      noInfiniteLoading: true,
      stableResponse: true,
    };
  };

  if (liveCache.data && now - liveCache.fetchedAt < LIVE_CACHE_MS) {
    return filterLiveResponse(liveCache.data);
  }

  try {
    const gtfs = loadGtfs();
    const gtfsRealtime = await vehiclePositionsRealtime.getVehiclePositions({
      shapePointsByTripId: buildShapePointsByTripId(gtfs),
    });

    const buses = (gtfsRealtime.buses || []).map((bus) => {
      const trip = bus.tripId ? gtfs.tripsById.get(String(bus.tripId)) : null;
      const resolvedRouteId = String(
        bus.routeId || bus.route || bus.number || trip?.route_id || "",
      ).trim();

      const route =
        gtfs.routesById.get(resolvedRouteId) ||
        (trip?.route_id ? gtfs.routesById.get(String(trip.route_id)) : null);

      const routePublic = route ? publicRoute(route) : null;
      const displayNumber =
        routePublic?.routeShortName ||
        routePublic?.routeLabel ||
        resolvedRouteId ||
        bus.number ||
        "BUS";

      return {
        ...bus,
        number: displayNumber,
        route: displayNumber,
        routeId: route?.route_id ? String(route.route_id) : resolvedRouteId,
        routeNumber: displayNumber,
        routeLabel: routePublic?.routeLabel || displayNumber,
        routeShortName: routePublic?.routeShortName || displayNumber,
        routeLongName: routePublic?.routeLongName || "",
        routeColor: routePublic?.routeColor || null,
        routeTextColor: routePublic?.routeTextColor || null,
      };
    });

    const response = {
      ok: true,
      source: "gtfs-rt",
      count: buses.length,
      buses,
      vehicles: buses,
      fetchedAt: gtfsRealtime.fetchedAt || new Date().toISOString(),
      feedTimestamp: gtfsRealtime.feedTimestamp || null,
      meta: gtfsRealtime.meta || {},
    };

    liveCache = { fetchedAt: now, data: response };
    return filterLiveResponse(response);
  } catch (error) {
    // Safe fallback, so production app does not die if GTFS-RT protobuf feed is temporarily unavailable.
    try {
      const url = process.env.STOPS_LT_GPS_URL || DEFAULT_GPS_URL;
      const text = await requestText(url);
      const buses = parseGpsFeed(text);

      const response = {
        ok: true,
        source: "stops.lt-fallback",
        fallbackReason: error.message,
        count: buses.length,
        buses,
        vehicles: buses,
        fetchedAt: new Date().toISOString(),
      };

      liveCache = { fetchedAt: now, data: response };
      return filterLiveResponse(response);
    } catch (fallbackError) {
      // Last-resort response: keep API contract stable. Mobile should never lose
      // the whole map layer because an external live feed is temporarily down.
      const stale = liveCache.data;
      if (stale?.buses?.length) {
        return filterLiveResponse({
          ...stale,
          ok: true,
          stale: true,
          source: `${stale.source || "cache"}-stale`,
          fallbackReason: fallbackError.message || error.message,
        });
      }

      return filterLiveResponse({
        ok: true,
        source: "live-feed-unavailable",
        fallbackReason: fallbackError.message || error.message,
        count: 0,
        buses: [],
        vehicles: [],
        fetchedAt: new Date().toISOString(),
        noInfiniteLoading: true,
        stableResponse: true,
      });
    }
  }
}
async function liveEta(query = {}) {
  const routeId = normalizeLiveRoute(
    query.routeId || query.routeNumber || query.route || "",
  );
  const live = await liveBuses({ ...query, routeNumber: routeId });
  const stopCoordinate = toCoordinate({
    latitude: query.stopLat,
    longitude: query.stopLon,
  });
  const candidates = live.buses
    .filter((bus) => !routeId || liveBusMatchesRoutes(bus, [routeId]))
    .map((bus) => {
      const distance = stopCoordinate
        ? distanceMeters(bus.coordinate, stopCoordinate)
        : null;
      const etaMinutes =
        distance != null
          ? ETAEngine.calculateEtaMinutes(distance, bus.speedKph || 24)
          : 4;
      return { bus, distance, etaMinutes };
    })
    .sort((a, b) => a.etaMinutes - b.etaMinutes);
  const best = candidates[0] || {
    bus: live.buses[0] || null,
    distance: null,
    etaMinutes: 4,
  };
  return {
    ok: true,
    routeId: routeId || best.bus?.routeId || null,
    eta: {
      etaSeconds: best.etaMinutes * 60,
      etaMinutes: best.etaMinutes,
      distanceMeters: best.distance,
    },
    boardingState:
      best.etaMinutes <= 2
        ? "boarding_soon"
        : best.etaMinutes <= 6
          ? "on_the_way"
          : "later",
    vehicle: best.bus,
    message: best.bus
      ? "Live GPS ETA calculated from stops.lt feed"
      : "No live vehicle available",
  };
}

async function departures({ stopId, limit = 20 } = {}) {
  const gtfs = loadGtfs();
  if (!stopId) return { ok: false, error: "MISSING_STOP_ID", departures: [] };
  const stop = gtfs.stopsById.get(String(stopId));
  const stopTimes = gtfs.stopTimesByStopId.get(String(stopId)) || [];
  const currentSeconds = nowSeconds();
  const upcoming = stopTimes
    .map((stopTime) => {
      const departureSeconds = secondsFromGtfsTime(
        stopTime.departure_time || stopTime.arrival_time,
      );
      const trip = gtfs.tripsById.get(String(stopTime.trip_id));
      const route = trip ? gtfs.routesById.get(String(trip.route_id)) : null;
      return { stopTime, trip, route, departureSeconds };
    })
    .filter(
      (item) =>
        item.departureSeconds !== null &&
        item.departureSeconds >= currentSeconds - 60,
    )
    .sort((a, b) => a.departureSeconds - b.departureSeconds)
    .slice(0, Number(limit) || 20)
    .map((item) => {
      const countdownMinutes = Math.max(
        0,
        Math.round((item.departureSeconds - currentSeconds) / 60),
      );
      return {
        tripId: item.stopTime.trip_id,
        routeId: item.route?.route_id || item.trip?.route_id || null,
        routeLabel: item.route
          ? routeLabel(item.route)
          : item.trip?.route_id || null,
        routeColor: item.route?.route_color
          ? `#${String(item.route.route_color).replace("#", "")}`
          : null,
        headsign: item.trip?.trip_headsign || "",
        arrivalTime: item.stopTime.arrival_time,
        departureTime: item.stopTime.departure_time,
        countdownMinutes,
        stopSequence: Number(item.stopTime.stop_sequence || 0),
      };
    });
  return {
    ok: true,
    source: "gtfs",
    stopId: String(stopId),
    stop: stopToPublic(stop),
    count: upcoming.length,
    departures: upcoming,
  };
}

async function vehicle({ id } = {}) {
  const live = await liveBuses();
  const found =
    live.buses.find(
      (bus) =>
        String(bus.id) === String(id) ||
        String(bus.vehicleId) === String(id) ||
        String(bus.vehicleLabel) === String(id),
    ) || null;
  if (!found)
    return { ok: false, error: "VEHICLE_NOT_FOUND", id, vehicle: null };
  const nearest = nearestStops(found.coordinate, 1, 5000)[0] || null;
  return {
    ok: true,
    source: "stops.lt+gtfs",
    vehicle: found,
    nearestStop: nearest,
    departures: nearest
      ? (await departures({ stopId: nearest.id, limit: 6 })).departures
      : [],
  };
}

function shape(shapeId) {
  const gtfs = loadGtfs();
  if (shapeId && gtfs.shapesByShapeId.has(String(shapeId))) {
    return {
      ok: true,
      source: "gtfs",
      shapeId: String(shapeId),
      points: simplifyPoints(gtfs.shapesByShapeId.get(String(shapeId)), 350),
    };
  }
  return {
    ok: true,
    source: "fallback",
    points: [
      { latitude: 55.7033, longitude: 21.1443 },
      { latitude: 55.696, longitude: 21.146 },
      { latitude: 55.68962, longitude: 21.14691 },
    ],
  };
}

function loadStationAccessData() {
  try {
    if (!fs.existsSync(STATION_ACCESS_PATH)) return [];
    const raw = fs
      .readFileSync(STATION_ACCESS_PATH, "utf8")
      .replace(/^\uFEFF/, "");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function makeFallbackStationAccess(stop) {
  const publicStop = stopToPublic(stop);
  if (!publicStop) return [];

  return [
    {
      id: `${publicStop.stopId}-main-access`,
      type: "entrance",
      title: publicStop.name,
      description:
        "Pagrindinis patekimas į stotelę pagal GTFS stotelės koordinates.",
      code: "A",
      priority: 1,
      latitude: publicStop.latitude,
      longitude: publicStop.longitude,
      coordinate: publicStop.coordinate,
      source: "gtfs-fallback",
    },
  ];
}

async function stationAccess({ stopId } = {}) {
  const gtfs = loadGtfs();
  const id = String(stopId || "").trim();

  if (!id) {
    return {
      ok: false,
      error: "MISSING_STOP_ID",
      stationAccess: [],
      accessPoints: [],
    };
  }

  const stop = gtfs.stopsById.get(id);
  const accessData = loadStationAccessData();
  const configured = accessData.find((item) => String(item.stopId) === id);

  const configuredPoints = Array.isArray(configured?.accessPoints)
    ? configured.accessPoints
        .map((point, index) => {
          const coordinate = toCoordinate(point);
          if (!coordinate) return null;
          return {
            id: String(point.id || `${id}-access-${index}`),
            type: String(point.type || "entrance"),
            title: String(point.title || point.name || `Įėjimas ${index + 1}`),
            description: point.description || null,
            code: point.code || null,
            priority: Number(point.priority || index + 1),
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            coordinate,
            source: "stations/entrances.json",
          };
        })
        .filter(Boolean)
    : [];

  const fallbackPoints = configuredPoints.length
    ? []
    : makeFallbackStationAccess(stop);
  const accessPoints = [...configuredPoints, ...fallbackPoints].sort(
    (a, b) => Number(a.priority || 999) - Number(b.priority || 999),
  );

  return {
    ok: true,
    source: configuredPoints.length ? "stations+gtfs" : "gtfs-fallback",
    stopId: id,
    stop: stopToPublic(stop),
    count: accessPoints.length,
    accessPoints,
    stationAccess: accessPoints,
  };
}

module.exports = {
  plan,
  liveBuses,
  liveEta,
  shape,
  departures,
  vehicle,
  stationAccess,
  parseGpsFeed,
  loadGtfs,
  nearestStops,
  distanceMeters,
};
