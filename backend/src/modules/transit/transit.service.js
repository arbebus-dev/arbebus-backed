/* eslint-env node */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const orsClient = require('../routing/ors.client');

const KLAIPEDA_BOUNDS = {
  minLat: 55.55,
  maxLat: 55.85,
  minLon: 20.95,
  maxLon: 21.35,
};

const GTFS_DIR = path.resolve(__dirname, '../../data/gtfs');
const LIVE_CACHE_MS = Number(process.env.LIVE_BUSES_CACHE_MS || 7000);
const DEFAULT_GPS_URL = 'https://www.stops.lt/klaipeda/gps_full.txt';
const WALK_SPEED_M_PER_MIN = 78;
const BUS_AVG_SPEED_M_PER_MIN = 430;

let liveCache = { fetchedAt: 0, data: null };
let gtfsCache = null;

function readFileSafe(fileName) {
  const filePath = path.join(GTFS_DIR, fileName);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
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

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function toNumber(value) {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function routeLabel(route) {
  return String(route?.route_short_name || route?.route_long_name || route?.route_id || '').trim();
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
    name: String(stop.stop_name ?? stop.name ?? 'Stotelė'),
    title: String(stop.stop_name ?? stop.name ?? 'Stotelė'),
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
    routeLongName: route.route_long_name || '',
    routeColor: route.route_color ? `#${String(route.route_color).replace('#', '')}` : null,
    routeTextColor: route.route_text_color ? `#${String(route.route_text_color).replace('#', '')}` : null,
  };
}

function secondsFromGtfsTime(time) {
  const parts = String(time || '').split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const [hours, minutes, seconds = 0] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

function gtfsTimeFromSeconds(value) {
  const safe = Math.max(0, Math.round(value));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function nowSeconds() {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toCoordinate(input, fallback) {
  const latitude = Number(input?.latitude ?? input?.lat ?? input?.stop_lat ?? input?.coordinate?.latitude ?? fallback?.latitude);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng ?? input?.stop_lon ?? input?.coordinate?.longitude ?? fallback?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function makeWalkPolyline(from, to) {
  if (!from || !to) return [];
  return [from, to];
}

async function getWalkingRoute(from, to) {
  if (!from || !to) return { polyline: makeWalkPolyline(from, to), distanceMeters: 0, durationMinutes: 0, provider: 'fallback' };
  const result = await orsClient.walkingDirections({ from, to });
  const polyline = Array.isArray(result?.polyline) && result.polyline.length >= 2
    ? result.polyline
    : makeWalkPolyline(from, to);
  return {
    ...result,
    polyline,
    distanceMeters: Number.isFinite(Number(result?.distanceMeters)) ? Number(result.distanceMeters) : Math.round(distanceMeters(from, to)),
    durationMinutes: Number.isFinite(Number(result?.durationMinutes)) ? Number(result.durationMinutes) : Math.max(1, Math.round(distanceMeters(from, to) / WALK_SPEED_M_PER_MIN)),
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
  const steps = await Promise.all(plan.journeySteps.map(async (step) => {
    if (step?.type !== 'walk' || !Array.isArray(step.polyline) || step.polyline.length < 2) return step;
    const from = toCoordinate(step.polyline[0]);
    const to = toCoordinate(step.polyline[step.polyline.length - 1]);
    if (!from || !to) return step;
    const walk = await getWalkingRoute(from, to);
    return {
      ...step,
      polyline: walk.polyline,
      distanceMeters: Math.round(walk.distanceMeters || step.distanceMeters || distanceMeters(from, to)),
      durationMinutes: walk.durationMinutes || step.durationMinutes,
      minutes: walk.durationMinutes || step.minutes,
      provider: walk.provider,
      subtitle: `${Math.round(walk.distanceMeters || step.distanceMeters || 0)} m • ${walk.durationMinutes || step.durationMinutes || step.minutes || 1} min`,
    };
  }));

  const accessWalk = steps.find((step) => step.id?.includes('walk-access'));
  const egressWalk = steps.find((step) => step.id?.includes('walk-egress'));
  const totalWalkMinutes = steps
    .filter((step) => step.type === 'walk')
    .reduce((sum, step) => sum + Number(step.durationMinutes || step.minutes || 0), 0);
  const totalWalkMeters = steps
    .filter((step) => step.type === 'walk')
    .reduce((sum, step) => sum + Number(step.distanceMeters || 0), 0);
  const polyline = rebuildPolylineFromSteps(steps, plan.polyline || plan.previewPoints || []);
  const totalDurationMinutes = Math.max(1, Number(plan.totalBusMinutes || 0) + totalWalkMinutes + Number(plan.summary?.transferWaitMinutes || 0));

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
    walkingProvider: 'ors-with-fallback',
    accessWalkProvider: accessWalk?.provider || null,
    egressWalkProvider: egressWalk?.provider || null,
    summary: {
      ...(plan.summary || {}),
      totalWalkMinutes,
      totalDurationMinutes,
      walkingProvider: 'ors-with-fallback',
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

  const stops = parseCsv(readFileSafe('stops.txt'));
  const routes = parseCsv(readFileSafe('routes.txt'));
  const trips = parseCsv(readFileSafe('trips.txt'));
  const stopTimes = parseCsv(readFileSafe('stop_times.txt'));
  const shapes = parseCsv(readFileSafe('shapes.txt'));

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
    const routeId = String(trip.route_id || '');
    if (!tripsByRouteId.has(routeId)) tripsByRouteId.set(routeId, []);
    tripsByRouteId.get(routeId).push(trip);
  }

  for (const stopTime of stopTimes) {
    const stopId = String(stopTime.stop_id || '');
    const tripId = String(stopTime.trip_id || '');
    if (!stopId || !tripId) continue;

    if (!stopTimesByStopId.has(stopId)) stopTimesByStopId.set(stopId, []);
    stopTimesByStopId.get(stopId).push(stopTime);

    if (!stopTimesByTripId.has(tripId)) stopTimesByTripId.set(tripId, []);
    stopTimesByTripId.get(tripId).push(stopTime);
  }

  for (const list of stopTimesByTripId.values()) {
    list.sort((a, b) => Number(a.stop_sequence || 0) - Number(b.stop_sequence || 0));
  }

  for (const list of stopTimesByStopId.values()) {
    list.sort((a, b) => String(a.departure_time || a.arrival_time).localeCompare(String(b.departure_time || b.arrival_time)));
  }

  for (const trip of trips) {
    const routeId = String(trip.route_id || '');
    const tripTimes = stopTimesByTripId.get(String(trip.trip_id)) || [];
    if (!routeId || !tripTimes.length) continue;
    if (!stopsByRouteId.has(routeId)) stopsByRouteId.set(routeId, new Set());
    for (const stopTime of tripTimes) {
      const stopId = String(stopTime.stop_id || '');
      if (!stopId) continue;
      stopsByRouteId.get(routeId).add(stopId);
      if (!routeIdsByStopId.has(stopId)) routeIdsByStopId.set(stopId, new Set());
      routeIdsByStopId.get(stopId).add(routeId);
    }
  }

  for (const shape of shapes) {
    const shapeId = String(shape.shape_id || '');
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
  return routeIds.map((id) => publicRoute(gtfs.routesById.get(id))).filter(Boolean);
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

function shapeForTrip(trip, fallbackStops = []) {
  const gtfs = loadGtfs();
  const shapeId = String(trip?.shape_id || '');
  if (shapeId && gtfs.shapesByShapeId.has(shapeId)) {
    return simplifyPoints(gtfs.shapesByShapeId.get(shapeId), 220);
  }
  return fallbackStops.map((stop) => stop.coordinate).filter(Boolean);
}

function findTripSegment(routeId, fromStopId, toStopId, afterSeconds = nowSeconds() - 120) {
  const gtfs = loadGtfs();
  const trips = gtfs.tripsByRouteId.get(String(routeId)) || [];
  let best = null;

  for (const trip of trips) {
    const times = gtfs.stopTimesByTripId.get(String(trip.trip_id)) || [];
    let fromIndex = -1;
    let toIndex = -1;

    for (let i = 0; i < times.length; i += 1) {
      if (String(times[i].stop_id) === String(fromStopId) && fromIndex < 0) fromIndex = i;
      if (fromIndex >= 0 && String(times[i].stop_id) === String(toStopId)) {
        toIndex = i;
        break;
      }
    }

    if (fromIndex < 0 || toIndex <= fromIndex) continue;

    const fromTime = times[fromIndex];
    const toTime = times[toIndex];
    const departureSeconds = secondsFromGtfsTime(fromTime.departure_time || fromTime.arrival_time);
    const arrivalSeconds = secondsFromGtfsTime(toTime.arrival_time || toTime.departure_time);
    if (departureSeconds == null || arrivalSeconds == null) continue;
    if (departureSeconds < afterSeconds) continue;

    const segmentStops = times.slice(fromIndex, toIndex + 1).map(tripStopPublic).filter(Boolean);
    const route = gtfs.routesById.get(String(routeId));
    const durationMinutes = Math.max(1, Math.round((arrivalSeconds - departureSeconds) / 60));
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

    if (!best || candidate.departureSeconds < best.departureSeconds) best = candidate;
  }

  return best;
}

function candidateDirectRoutes(originStops, destinationStops) {
  const gtfs = loadGtfs();
  const after = nowSeconds() - 120;
  const options = [];

  for (const origin of originStops) {
    const originRoutes = Array.from(gtfs.routeIdsByStopId.get(String(origin.id)) || []);
    for (const destination of destinationStops) {
      const destinationRouteIds = new Set(Array.from(gtfs.routeIdsByStopId.get(String(destination.id)) || []));
      const sharedRoutes = originRoutes.filter((routeId) => destinationRouteIds.has(routeId));

      for (const routeId of sharedRoutes) {
        const segment = findTripSegment(routeId, origin.id, destination.id, after);
        if (!segment) continue;
        const walkingMeters = Number(origin.distanceMeters || 0) + Number(destination.distanceMeters || 0);
        const walkingMinutes = Math.max(1, Math.round(walkingMeters / WALK_SPEED_M_PER_MIN));
        const totalMinutes = walkingMinutes + segment.durationMinutes;
        options.push({ type: 'direct', origin, destination, segments: [segment], walkingMeters, walkingMinutes, totalMinutes });
      }
    }
  }

  return options.sort((a, b) => a.totalMinutes - b.totalMinutes).slice(0, 4);
}

function candidateTransferRoutes(originStops, destinationStops) {
  const gtfs = loadGtfs();
  const after = nowSeconds() - 120;
  const options = [];

  for (const origin of originStops.slice(0, 4)) {
    const originRouteIds = Array.from(gtfs.routeIdsByStopId.get(String(origin.id)) || []).slice(0, 16);
    for (const destination of destinationStops.slice(0, 4)) {
      const destinationRouteIds = Array.from(gtfs.routeIdsByStopId.get(String(destination.id)) || []).slice(0, 16);

      for (const firstRouteId of originRouteIds) {
        const firstRouteStops = gtfs.stopsByRouteId.get(String(firstRouteId));
        if (!firstRouteStops) continue;

        for (const secondRouteId of destinationRouteIds) {
          if (String(firstRouteId) === String(secondRouteId)) continue;
          const secondRouteStops = gtfs.stopsByRouteId.get(String(secondRouteId));
          if (!secondRouteStops) continue;

          const transferStopIds = [];
          for (const stopId of firstRouteStops) {
            if (secondRouteStops.has(stopId)) transferStopIds.push(stopId);
            if (transferStopIds.length >= 16) break;
          }

          for (const transferStopId of transferStopIds) {
            const leg1 = findTripSegment(firstRouteId, origin.id, transferStopId, after);
            if (!leg1) continue;
            const leg2 = findTripSegment(secondRouteId, transferStopId, destination.id, leg1.arrivalSeconds + 120);
            if (!leg2) continue;
            const transferStop = stopToPublic(gtfs.stopsById.get(String(transferStopId)));
            if (!transferStop) continue;
            const walkingMeters = Number(origin.distanceMeters || 0) + Number(destination.distanceMeters || 0);
            const walkingMinutes = Math.max(1, Math.round(walkingMeters / WALK_SPEED_M_PER_MIN));
            const waitMinutes = Math.max(0, Math.round((leg2.departureSeconds - leg1.arrivalSeconds) / 60));
            const totalMinutes = walkingMinutes + leg1.durationMinutes + waitMinutes + leg2.durationMinutes;
            options.push({
              type: 'transfer',
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

  return options.sort((a, b) => a.totalMinutes - b.totalMinutes).slice(0, 4);
}

function fallbackOption(from, to, destinationTitle) {
  const meters = Math.round(distanceMeters(from, to));
  const totalDurationMinutes = Math.max(8, Math.round(meters / BUS_AVG_SPEED_M_PER_MIN));
  const walkingMinutes = Math.max(2, Math.round(Math.min(meters, 900) / WALK_SPEED_M_PER_MIN));
  const busMinutes = Math.max(6, totalDurationMinutes - walkingMinutes);
  const routeNumber = meters > 5000 ? '8' : '6';
  const originStop = { id: 'nearest-stop', name: 'Artimiausia stotelė', title: 'Artimiausia stotelė', ...from, coordinate: from, distanceMeters: 220 };
  const destinationStop = { id: 'destination-stop', name: destinationTitle, title: destinationTitle, ...to, coordinate: to, distanceMeters: 180 };
  const polyline = [from, to];

  return {
    id: `fallback-${routeNumber}`,
    title: `Autobusas ${routeNumber}`,
    mode: 'bus',
    routeId: routeNumber,
    routeLabel: routeNumber,
    routeNumbers: [routeNumber],
    totalDurationMinutes,
    totalMinutes: totalDurationMinutes,
    totalWalkMinutes: walkingMinutes,
    walkingMinutes,
    totalBusMinutes: busMinutes,
    transfers: 0,
    transfersCount: 0,
    stopCount: Math.max(3, Math.round(meters / 650)),
    boardStopName: originStop.name,
    alightStopName: destinationTitle,
    originStop,
    destinationStop,
    previewPoints: polyline,
    polyline,
    steps: [],
    journeySteps: [],
    summary: {
      routeLabel: routeNumber,
      routeNumbers: [routeNumber],
      totalDurationMinutes,
      totalWalkMinutes: walkingMinutes,
      totalBusMinutes: busMinutes,
      transfersCount: 0,
      stopCount: Math.max(3, Math.round(meters / 650)),
      boardStopName: originStop.name,
      alightStopName: destinationTitle,
      etaMinutes: 4,
      journeyMessage: `Važiuok autobusu ${routeNumber} iki „${destinationTitle}“`,
    },
  };
}

function buildPlanFromCandidate(candidate, from, to, index = 0) {
  const routeNumbers = candidate.segments.map((segment) => String(segment.routeLabel || segment.routeId));
  const routeLabelText = routeNumbers.join(' → ');
  const originStop = candidate.origin;
  const destinationStop = candidate.destination;
  const accessWalkMinutes = Math.max(1, Math.round(Number(originStop.distanceMeters || 0) / WALK_SPEED_M_PER_MIN));
  const egressWalkMinutes = Math.max(1, Math.round(Number(destinationStop.distanceMeters || 0) / WALK_SPEED_M_PER_MIN));
  const firstDeparture = candidate.segments[0]?.departureTime || null;
  const lastArrival = candidate.segments[candidate.segments.length - 1]?.arrivalTime || null;
  const busMinutes = candidate.segments.reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const stopCount = candidate.segments.reduce((sum, segment) => sum + segment.stopCount, 0);
  const transfersCount = Math.max(0, candidate.segments.length - 1);
  const polyline = [from, originStop.coordinate, ...candidate.segments.flatMap((segment) => segment.polyline), destinationStop.coordinate, to]
    .filter(Boolean)
    .filter((point, pointIndex, arr) => pointIndex === 0 || distanceMeters(point, arr[pointIndex - 1]) > 4);

  const journeySteps = [];
  journeySteps.push({
    id: `walk-access-${index}`,
    type: 'walk',
    mode: 'walk',
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
      type: 'board',
      mode: 'bus',
      title: `Lipk į autobusą ${segment.routeLabel}`,
      subtitle: `${boardStop?.name || originStop.name} • ${segment.departureTime}${segment.headsign ? ` • ${segment.headsign}` : ''}`,
      routeId: segment.routeId,
      routeNumber: segment.routeLabel,
      routeLabel: segment.routeLabel,
      stopId: boardStop?.id || segment.fromStopId,
      stopName: boardStop?.name || originStop.name,
      departureTime: segment.departureTime,
      headsign: segment.headsign,
      polyline: [boardStop?.coordinate || originStop.coordinate],
    });
    journeySteps.push({
      id: `ride-${index}-${segmentIndex}`,
      type: 'ride',
      mode: 'bus',
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
      departureTime: segment.departureTime,
      arrivalTime: segment.arrivalTime,
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
        type: 'transfer',
        mode: 'walk',
        title: `Persėsk stotelėje „${transfer?.name || alightStop?.name || 'Persėdimas'}“`,
        subtitle: `Lauk ${wait} min • kitas autobusas ${candidate.segments[segmentIndex + 1].routeLabel}`,
        transferFromRoute: segment.routeLabel,
        transferToRoute: candidate.segments[segmentIndex + 1].routeLabel,
        transferWaitMinutes: wait,
        stopId: transfer?.id,
        stopName: transfer?.name,
        durationMinutes: wait,
        minutes: wait,
        polyline: transfer?.coordinate ? [transfer.coordinate, transfer.coordinate] : [],
      });
    }
  });

  journeySteps.push({
    id: `walk-egress-${index}`,
    type: 'walk',
    mode: 'walk',
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
  const etaMinutes = Math.max(0, Math.round((candidate.segments[0]?.departureSeconds - nowSeconds()) / 60));

  return {
    id: `${candidate.type}-${routeNumbers.join('-')}-${index}`,
    title: transfersCount ? `Autobusai ${routeLabelText}` : `Autobusas ${routeLabelText}`,
    mode: transfersCount ? 'mixed' : 'bus',
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
    boardingState: etaMinutes <= 2 ? 'boarding_soon' : etaMinutes <= 6 ? 'on_the_way' : 'later',
    transfers: transfersCount,
    transfersCount,
    stopCount,
    boardStopName: originStop.name,
    alightStopName: destinationStop.name,
    originStop,
    destinationStop,
    transferStops: candidate.transferStop ? [candidate.transferStop] : [],
    transferMessages: candidate.transferStop ? [`Persėsk: ${candidate.transferStop.name}`] : [],
    previewPoints: polyline,
    polyline: simplifyPoints(polyline, 250),
    steps: journeySteps,
    journeySteps,
    departureText: firstDeparture,
    arrivalText: lastArrival,
    headsign: candidate.segments[0]?.headsign || null,
    journeyMessage: transfersCount
      ? `Važiuok ${routeLabelText} su persėdimu ties „${candidate.transferStop?.name || 'persėdimo stotele'}“`
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
        ? `Važiuok ${routeLabelText} su persėdimu ties „${candidate.transferStop?.name || 'persėdimo stotele'}“`
        : `Važiuok autobusu ${routeLabelText} iki „${destinationStop.name}“`,
    },
    legs: candidate.segments.map((segment) => ({
      id: segment.trip.trip_id,
      type: 'bus',
      mode: 'bus',
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
}

async function plan(body = {}) {
  const from = toCoordinate(body.origin) || toCoordinate(body.from) || { latitude: 55.7033, longitude: 21.1443 };
  const to = toCoordinate(body.destination) || toCoordinate(body.to) || toCoordinate(body.selectedDestination) || { latitude: 55.68962, longitude: 21.14691 };
  const destinationTitle = body.selectedDestination?.title || body.destination?.title || body.to?.title || 'Tikslas';

  const originStops = nearestStops(from, 6, 2200);
  const destinationStops = nearestStops(to, 6, 2200);
  let candidates = [
    ...candidateDirectRoutes(originStops, destinationStops),
    ...candidateTransferRoutes(originStops, destinationStops),
  ].sort((a, b) => a.totalMinutes - b.totalMinutes);

  const plans = await Promise.all(
    candidates
      .slice(0, 4)
      .map((candidate, index) => buildPlanFromCandidate(candidate, from, to, index))
      .map((route) => enrichPlanWithWalkingGeometry(route))
  );

  if (!plans.length) {
    const fallback = await enrichPlanWithWalkingGeometry(fallbackOption(from, to, destinationTitle));
    return { ok: true, source: 'fallback', plan: fallback, options: [fallback], routes: [fallback] };
  }

  return {
    ok: true,
    source: 'gtfs+stops.lt+ors',
    plan: plans[0],
    options: plans,
    routes: plans,
    meta: {
      originStops: originStops.length,
      destinationStops: destinationStops.length,
      candidates: candidates.length,
    },
  };
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(
      url,
      {
        timeout: 12000,
        headers: { 'User-Agent': 'Arbebus/1.0 live-buses backend', Accept: 'text/plain,*/*' },
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`GPS feed returned HTTP ${res.statusCode}`));
          return;
        }
        res.setEncoding('utf8');
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve(body));
      },
    );
    req.on('timeout', () => req.destroy(new Error('GPS feed timeout')));
    req.on('error', reject);
  });
}

function normalizeCoordinate(value) {
  const number = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  if (Math.abs(number) > 100000) return number / 1000000;
  return number;
}

function isInKlaipeda(latitude, longitude) {
  return latitude >= KLAIPEDA_BOUNDS.minLat && latitude <= KLAIPEDA_BOUNDS.maxLat && longitude >= KLAIPEDA_BOUNDS.minLon && longitude <= KLAIPEDA_BOUNDS.maxLon;
}

function detectCoordinates(tokens) {
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const first = normalizeCoordinate(tokens[i]);
    const second = normalizeCoordinate(tokens[i + 1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) continue;
    if (isInKlaipeda(first, second)) return { latitude: first, longitude: second, latIndex: i, lonIndex: i + 1 };
    if (isInKlaipeda(second, first)) return { latitude: second, longitude: first, latIndex: i + 1, lonIndex: i };
  }
  return null;
}

function detectRouteNumber(tokens, latIndex, lonIndex) {
  const candidates = tokens
    .map((token, index) => ({ token: String(token).trim(), index }))
    .filter(({ token, index }) => index !== latIndex && index !== lonIndex && /^[0-9]{1,3}[A-Za-z]?$/.test(token));
  if (candidates.length === 0) return null;
  return candidates[0].token;
}

function detectVehicleId(tokens, fallback) {
  const vehicleLike = tokens.find((token) => /^[A-Za-z0-9_-]{3,}$/.test(String(token).trim()));
  return vehicleLike || fallback;
}

function detectBearing(tokens, latIndex, lonIndex) {
  const nums = tokens
    .map((token, index) => ({ value: Number(String(token).replace(',', '.')), index }))
    .filter(({ value, index }) => Number.isFinite(value) && index !== latIndex && index !== lonIndex);
  const bearing = nums.find(({ value }) => value >= 0 && value <= 360);
  return bearing ? Math.round(bearing.value) : 0;
}

function parseGpsFeed(text) {
  const fetchedAt = new Date().toISOString();
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const buses = [];
  const seen = new Set();

  for (const line of lines) {
    const tokens = line.split(/[;,\t| ]+/).map((token) => token.trim()).filter(Boolean);
    if (tokens.length < 3) continue;
    const coords = detectCoordinates(tokens);
    if (!coords) continue;
    const routeNumber = detectRouteNumber(tokens, coords.latIndex, coords.lonIndex) || 'bus';
    const vehicleId = detectVehicleId(tokens, `${routeNumber}-${coords.latitude.toFixed(5)}-${coords.longitude.toFixed(5)}`);
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
      source: 'stops.lt',
      fetchedAt,
    });
  }
  return buses;
}

async function liveBuses() {
  const now = Date.now();
  if (liveCache.data && now - liveCache.fetchedAt < LIVE_CACHE_MS) return liveCache.data;
  const url = process.env.STOPS_LT_GPS_URL || DEFAULT_GPS_URL;
  const text = await requestText(url);
  const buses = parseGpsFeed(text);
  const response = { ok: true, source: 'stops.lt', count: buses.length, buses, vehicles: buses, fetchedAt: new Date().toISOString() };
  liveCache = { fetchedAt: now, data: response };
  return response;
}

async function liveEta(query = {}) {
  const live = await liveBuses();
  const routeId = String(query.routeId || query.routeNumber || '').replace(/^0+/, '');
  const stopCoordinate = toCoordinate({ latitude: query.stopLat, longitude: query.stopLon });
  const candidates = live.buses
    .filter((bus) => !routeId || String(bus.routeId).replace(/^0+/, '') === routeId)
    .map((bus) => {
      const distance = stopCoordinate ? distanceMeters(bus.coordinate, stopCoordinate) : null;
      const etaMinutes = distance != null ? Math.max(1, Math.round(distance / BUS_AVG_SPEED_M_PER_MIN)) : 4;
      return { bus, distance, etaMinutes };
    })
    .sort((a, b) => a.etaMinutes - b.etaMinutes);
  const best = candidates[0] || { bus: live.buses[0] || null, distance: null, etaMinutes: 4 };
  return {
    ok: true,
    routeId: routeId || best.bus?.routeId || null,
    eta: { etaSeconds: best.etaMinutes * 60, etaMinutes: best.etaMinutes, distanceMeters: best.distance },
    boardingState: best.etaMinutes <= 2 ? 'boarding_soon' : best.etaMinutes <= 6 ? 'on_the_way' : 'later',
    vehicle: best.bus,
    message: best.bus ? 'Live GPS ETA calculated from stops.lt feed' : 'No live vehicle available',
  };
}

async function departures({ stopId, limit = 20 } = {}) {
  const gtfs = loadGtfs();
  if (!stopId) return { ok: false, error: 'MISSING_STOP_ID', departures: [] };
  const stop = gtfs.stopsById.get(String(stopId));
  const stopTimes = gtfs.stopTimesByStopId.get(String(stopId)) || [];
  const currentSeconds = nowSeconds();
  const upcoming = stopTimes
    .map((stopTime) => {
      const departureSeconds = secondsFromGtfsTime(stopTime.departure_time || stopTime.arrival_time);
      const trip = gtfs.tripsById.get(String(stopTime.trip_id));
      const route = trip ? gtfs.routesById.get(String(trip.route_id)) : null;
      return { stopTime, trip, route, departureSeconds };
    })
    .filter((item) => item.departureSeconds !== null && item.departureSeconds >= currentSeconds - 60)
    .sort((a, b) => a.departureSeconds - b.departureSeconds)
    .slice(0, Number(limit) || 20)
    .map((item) => {
      const countdownMinutes = Math.max(0, Math.round((item.departureSeconds - currentSeconds) / 60));
      return {
        tripId: item.stopTime.trip_id,
        routeId: item.route?.route_id || item.trip?.route_id || null,
        routeLabel: item.route ? routeLabel(item.route) : item.trip?.route_id || null,
        routeColor: item.route?.route_color ? `#${String(item.route.route_color).replace('#', '')}` : null,
        headsign: item.trip?.trip_headsign || '',
        arrivalTime: item.stopTime.arrival_time,
        departureTime: item.stopTime.departure_time,
        countdownMinutes,
        stopSequence: Number(item.stopTime.stop_sequence || 0),
      };
    });
  return { ok: true, source: 'gtfs', stopId: String(stopId), stop: stopToPublic(stop), count: upcoming.length, departures: upcoming };
}

async function vehicle({ id } = {}) {
  const live = await liveBuses();
  const found = live.buses.find((bus) => String(bus.id) === String(id) || String(bus.vehicleId) === String(id) || String(bus.vehicleLabel) === String(id)) || null;
  if (!found) return { ok: false, error: 'VEHICLE_NOT_FOUND', id, vehicle: null };
  const nearest = nearestStops(found.coordinate, 1, 5000)[0] || null;
  return {
    ok: true,
    source: 'stops.lt+gtfs',
    vehicle: found,
    nearestStop: nearest,
    departures: nearest ? (await departures({ stopId: nearest.id, limit: 6 })).departures : [],
  };
}

function shape(shapeId) {
  const gtfs = loadGtfs();
  if (shapeId && gtfs.shapesByShapeId.has(String(shapeId))) {
    return { ok: true, source: 'gtfs', shapeId: String(shapeId), points: simplifyPoints(gtfs.shapesByShapeId.get(String(shapeId)), 350) };
  }
  return { ok: true, source: 'fallback', points: [{ latitude: 55.7033, longitude: 21.1443 }, { latitude: 55.696, longitude: 21.146 }, { latitude: 55.68962, longitude: 21.14691 }] };
}

module.exports = {
  plan,
  liveBuses,
  liveEta,
  shape,
  departures,
  vehicle,
  parseGpsFeed,
  loadGtfs,
  nearestStops,
  distanceMeters,
};
