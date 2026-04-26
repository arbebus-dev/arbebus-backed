const { env } = require('../../../config/env');
const {
  getNearbyStops,
  getWalkingTransfers,
  getCandidateBoardings,
  getTripStopSequences,
  getShapePoints,
} = require('./plannerRepository');
const { getDistanceMeters } = require('./geo');

const SEARCH_PROFILES = [
  { originRadius: 700, destinationRadius: 900, stopLimit: 6, transferRadius: 350, maxTransfers: 1, perStopBoardLimit: 4, horizonSeconds: 2 * 3600 },
  { originRadius: 1400, destinationRadius: 1800, stopLimit: 10, transferRadius: 450, maxTransfers: 2, perStopBoardLimit: 6, horizonSeconds: 4 * 3600 },
  { originRadius: 2800, destinationRadius: 3500, stopLimit: 14, transferRadius: 550, maxTransfers: 2, perStopBoardLimit: 8, horizonSeconds: 6 * 3600 },
];

const LOCAL_TZ = 'Europe/Vilnius';
const WALKING_SPEED_MPS = 1.2;

function nowInVilniusParts() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: LOCAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date()).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

function toCoordinate(latitude, longitude) {
  return { latitude: Number(latitude), longitude: Number(longitude) };
}

function normalizeNearbyStop(stop) {
  return {
    id: stop.id,
    name: stop.name,
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude),
    distanceMeters: Number(stop.distance_meters || stop.distanceMeters || 0),
  };
}

function uniqueModes(modes) {
  return Array.from(new Set((modes || []).filter(Boolean)));
}

function modeFromRouteType(routeType) {
  return Number(routeType) === 2 ? 'train' : 'bus';
}

function planModeFromModes(modes) {
  const unique = uniqueModes(modes);
  return unique.length > 1 ? 'mixed' : unique[0] || 'bus';
}

function secondsToMinutes(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds)) return null;
  return Math.max(1, Math.round(deltaSeconds / 60));
}

function routeLabelFromRow(row) {
  const shortName = row.route_short_name || row.route_id || 'PT';
  const longName = row.route_long_name || null;
  return longName && longName !== shortName ? `${shortName} • ${longName}` : String(shortName);
}

function stopToCoord(stop) {
  return { latitude: Number(stop.latitude), longitude: Number(stop.longitude) };
}

function dedupeCoords(coords) {
  const result = [];
  const seen = new Set();

  for (const point of coords) {
    if (!point) continue;

    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const key = `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push({ latitude, longitude });
  }

  return result;
}

function shapeRowsToCoords(rows) {
  return rows.map((row) => ({
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  }));
}

function nearestPointIndex(points, target) {
  if (!points.length || !target) return -1;

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i += 1) {
    const distance = getDistanceMeters(points[i], target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function sliceShapeBetweenStops(shapePoints, fromStop, toStop) {
  if (!Array.isArray(shapePoints) || shapePoints.length < 2 || !fromStop || !toStop) {
    return [];
  }

  const fromCoord = stopToCoord(fromStop);
  const toCoord = stopToCoord(toStop);

  let fromIndex = nearestPointIndex(shapePoints, fromCoord);
  let toIndex = nearestPointIndex(shapePoints, toCoord);

  if (fromIndex < 0 || toIndex < 0) return [];

  if (fromIndex > toIndex) {
    const temp = fromIndex;
    fromIndex = toIndex;
    toIndex = temp;
  }

  const sliced = shapePoints.slice(fromIndex, toIndex + 1);

  if (sliced.length < 2) return [];
  return sliced;
}

async function buildPreviewPoints({ origin, destination, legs }) {
  const points = [origin];

  for (const leg of legs) {
    if (leg.type === 'walk') {
      if (leg.fromCoord) points.push(leg.fromCoord);
      if (leg.fromStop) points.push(stopToCoord(leg.fromStop));
      if (leg.toStop) points.push(stopToCoord(leg.toStop));
      if (leg.toCoord) points.push(leg.toCoord);
      continue;
    }

    if (leg.type === 'ride') {
      const fromStopCoord = leg.fromStop ? stopToCoord(leg.fromStop) : null;
      const toStopCoord = leg.toStop ? stopToCoord(leg.toStop) : null;

      if (fromStopCoord) points.push(fromStopCoord);

      const shapeRows = await getShapePoints(leg.shapeId);
      const shapePoints = shapeRowsToCoords(shapeRows);
      const slicedShape = sliceShapeBetweenStops(shapePoints, leg.fromStop, leg.toStop);

      if (slicedShape.length) {
        points.push(...slicedShape);
      } else {
        if (fromStopCoord) points.push(fromStopCoord);
        if (toStopCoord) points.push(toStopCoord);
      }

      if (toStopCoord) points.push(toStopCoord);
    }
  }

  points.push(destination);
  return dedupeCoords(points);
}

function buildWalkingTransfersMap(rows) {
  const map = new Map();
  const maxWalkingMeters = Number(env.MAX_WALKING_METERS || 500);

  for (const row of rows) {
    const walkMeters = Number(row.walk_meters || 0);
    if (walkMeters > maxWalkingMeters) continue;

    const item = {
      fromStopId: row.from_stop_id,
      toStopId: row.to_stop_id,
      fromStopName: row.from_stop_name,
      toStopName: row.to_stop_name,
      fromStopLat: Number(row.from_stop_lat),
      fromStopLon: Number(row.from_stop_lon),
      toStopLat: Number(row.to_stop_lat),
      toStopLon: Number(row.to_stop_lon),
      walkMeters,
      walkSeconds: Math.max(60, Math.round(walkMeters / WALKING_SPEED_MPS)),
    };

    if (!map.has(item.fromStopId)) map.set(item.fromStopId, []);
    map.get(item.fromStopId).push(item);
  }

  return map;
}

function makeStopMeta(stop) {
  return {
    id: stop.id,
    name: stop.name,
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude),
    distanceMeters: Number(stop.distanceMeters || 0),
  };
}

function createBestStateMap(initialStops, origin, departureSeconds) {
  const map = new Map();

  for (const stop of initialStops) {
    const walkSeconds = Math.max(60, Math.round(Number(stop.distanceMeters || 0) / WALKING_SPEED_MPS));
    const arrivalSeconds = departureSeconds + walkSeconds;

    map.set(stop.id, {
      stop: makeStopMeta(stop),
      arrivalSeconds,
      ridesUsed: 0,
      prev: {
        type: 'access_walk',
        fromCoord: origin,
        toStopId: stop.id,
        toStopName: stop.name,
        distanceMeters: Number(stop.distanceMeters || 0),
        durationSeconds: walkSeconds,
      },
    });
  }

  return map;
}

function applyWalkingClosure(bestByStop, frontierStopIds, transferMap) {
  const queue = [...frontierStopIds];
  const marked = new Set();

  while (queue.length) {
    const stopId = queue.shift();
    const state = bestByStop.get(stopId);
    if (!state) continue;

    const transfers = transferMap.get(stopId) || [];

    for (const transfer of transfers) {
      const candidateArrival = state.arrivalSeconds + transfer.walkSeconds;
      const current = bestByStop.get(transfer.toStopId);

      if (!current || candidateArrival < current.arrivalSeconds - 30) {
        bestByStop.set(transfer.toStopId, {
          stop: {
            id: transfer.toStopId,
            name: transfer.toStopName,
            latitude: transfer.toStopLat,
            longitude: transfer.toStopLon,
            distanceMeters: 0,
          },
          arrivalSeconds: candidateArrival,
          ridesUsed: state.ridesUsed,
          prev: {
            type: 'transfer_walk',
            fromStopId: stopId,
            fromStopName: state.stop.name,
            toStopId: transfer.toStopId,
            toStopName: transfer.toStopName,
            distanceMeters: transfer.walkMeters,
            durationSeconds: transfer.walkSeconds,
          },
        });

        if (!marked.has(transfer.toStopId)) {
          marked.add(transfer.toStopId);
          queue.push(transfer.toStopId);
        }
      }
    }
  }

  return Array.from(marked);
}

function chooseBoardingsPerTrip(boardings, bestByStop) {
  const bestByTrip = new Map();

  for (const row of boardings) {
    const reached = bestByStop.get(row.board_stop_id);
    if (!reached) continue;

    const existing = bestByTrip.get(row.trip_id);
    if (!existing || Number(row.board_departure_seconds) < Number(existing.board_departure_seconds)) {
      bestByTrip.set(row.trip_id, row);
    }
  }

  return Array.from(bestByTrip.values());
}

function groupTripRows(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.trip_id)) map.set(row.trip_id, []);
    map.get(row.trip_id).push(row);
  }

  return map;
}

function buildDestinationCandidate(bestByStop, destinationStops, destination, currentBest) {
  let best = currentBest || null;

  for (const stop of destinationStops) {
    const state = bestByStop.get(stop.id);
    if (!state) continue;

    const finalWalkMeters = getDistanceMeters(stop, destination);
    const maxFinalWalk = Math.max(Number(env.MAX_WALKING_METERS || 500) * 2.5, 1200);
    if (finalWalkMeters > maxFinalWalk) continue;

    const finalWalkSeconds = Math.max(60, Math.round(finalWalkMeters / WALKING_SPEED_MPS));
    const totalArrival = state.arrivalSeconds + finalWalkSeconds;

    if (!best || totalArrival < best.totalArrivalSeconds) {
      best = {
        stop,
        state,
        finalWalkMeters,
        finalWalkSeconds,
        totalArrivalSeconds: totalArrival,
      };
    }
  }

  return best;
}

function reconstructLegs(bestByStop, destinationCandidate, origin, destination) {
  const legs = [];
  let state = destinationCandidate.state;

  while (state?.prev) {
    const prev = state.prev;

    if (prev.type === 'ride') {
      legs.push({
        type: 'ride',
        mode: modeFromRouteType(prev.routeType),
        routeId: prev.routeId,
        routeLabel: prev.routeLabel,
        headsign: prev.headsign,
        shapeId: prev.shapeId,
        departureSeconds: prev.boardDepartureSeconds,
        arrivalSeconds: state.arrivalSeconds,
        stopCount: Number(prev.stopCount || 0),
        fromStop: prev.fromStop,
        toStop: state.stop,
      });

      state = bestByStop.get(prev.fromStop.id);
      continue;
    }

    if (prev.type === 'transfer_walk') {
      legs.push({
        type: 'walk',
        walkKind: 'transfer',
        distanceMeters: prev.distanceMeters,
        durationSeconds: prev.durationSeconds,
        fromStop: { id: prev.fromStopId, name: prev.fromStopName },
        toStop: state.stop,
      });

      state = bestByStop.get(prev.fromStopId);
      continue;
    }

    if (prev.type === 'access_walk') {
      legs.push({
        type: 'walk',
        walkKind: 'access',
        distanceMeters: prev.distanceMeters,
        durationSeconds: prev.durationSeconds,
        fromCoord: origin,
        toStop: state.stop,
      });

      state = null;
      break;
    }
  }

  legs.reverse();

  legs.push({
    type: 'walk',
    walkKind: 'egress',
    distanceMeters: destinationCandidate.finalWalkMeters,
    durationSeconds: destinationCandidate.finalWalkSeconds,
    fromStop: destinationCandidate.stop,
    toCoord: destination,
  });

  return legs;
}

function legsToJourneySteps(legs) {
  const steps = [];

  for (const leg of legs) {
    if (leg.type === 'walk') {
      const walkMinutes = secondsToMinutes(leg.durationSeconds) || 1;

      if (leg.walkKind === 'access') {
        steps.push({
          icon: 'walk',
          title: 'Eik iki stotelės',
          subtitle: `Iki „${leg.toStop.name}“ • ${walkMinutes} min pėsčiomis`,
          type: 'walk',
          mode: 'walk',
          stopId: leg.toStop.id,
          stopName: leg.toStop.name,
          durationMinutes: walkMinutes,
          minutes: walkMinutes,
        });
      } else if (leg.walkKind === 'transfer') {
        steps.push({
          icon: 'walk',
          title: 'Pereik iki kitos stotelės',
          subtitle: `Iki „${leg.toStop.name}“ • ${walkMinutes} min pėsčiomis`,
          type: 'transfer',
          mode: 'walk',
          stopId: leg.toStop.id,
          stopName: leg.toStop.name,
          durationMinutes: walkMinutes,
          minutes: walkMinutes,
        });
      } else {
        steps.push({
          icon: 'walk',
          title: 'Eik iki tikslo',
          subtitle: `${walkMinutes} min pėsčiomis`,
          type: 'walk',
          mode: 'walk',
          durationMinutes: walkMinutes,
          minutes: walkMinutes,
        });
      }

      continue;
    }

    if (leg.type === 'ride') {
      const modeIcon = leg.mode === 'train' ? 'train' : 'bus';
      const rideMinutes = secondsToMinutes(leg.arrivalSeconds - leg.departureSeconds) || 1;

      steps.push({
        icon: modeIcon,
        title: leg.mode === 'train' ? `Lipk į traukinį ${leg.routeLabel}` : `Lipk į autobusą ${leg.routeLabel}`,
        subtitle: leg.headsign || `Nuo „${leg.fromStop.name}“`,
        type: 'board',
        mode: leg.mode,
        stopId: leg.fromStop.id,
        stopName: leg.fromStop.name,
        routeId: leg.routeId,
        routeNumber: leg.routeLabel,
      });

      steps.push({
        icon: modeIcon,
        title: leg.mode === 'train' ? 'Važiuok traukiniu' : 'Važiuok autobusu',
        subtitle: `Iki „${leg.toStop.name}“ • ${rideMinutes} min • ${leg.stopCount} st.`,
        type: 'ride',
        mode: leg.mode,
        fromStopId: leg.fromStop.id,
        fromStopName: leg.fromStop.name,
        toStopId: leg.toStop.id,
        toStopName: leg.toStop.name,
        stopCount: leg.stopCount,
        durationMinutes: rideMinutes,
        minutes: rideMinutes,
        routeId: leg.routeId,
        routeNumber: leg.routeLabel,
      });

      steps.push({
        icon: 'flag-checkered',
        title: 'Išlipk',
        subtitle: `„${leg.toStop.name}“`,
        type: 'alight',
        stopId: leg.toStop.id,
        stopName: leg.toStop.name,
      });
    }
  }

  return steps;
}

async function enrichPlanWithLiveVehicle(plan) {
  return plan;
}

async function buildPlanFromDestinationCandidate({ origin, destination, destinationCandidate }) {
  const legs = reconstructLegs(destinationCandidate.bestByStop, destinationCandidate, origin, destination);

  const rideLegs = legs.filter((leg) => leg.type === 'ride');
  const walkLegs = legs.filter((leg) => leg.type === 'walk');
  const modes = uniqueModes(rideLegs.map((leg) => leg.mode));

  const firstRide = rideLegs[0];
  const lastRide = rideLegs[rideLegs.length - 1];

  const totalWalkMinutes = walkLegs.reduce((sum, leg) => sum + (secondsToMinutes(leg.durationSeconds) || 0), 0);
  const totalRideMinutes = rideLegs.reduce((sum, leg) => sum + (secondsToMinutes(leg.arrivalSeconds - leg.departureSeconds) || 0), 0);
  const totalDurationMinutes = totalWalkMinutes + totalRideMinutes;

  const previewPoints = await buildPreviewPoints({ origin, destination, legs });
  const journeySteps = legsToJourneySteps(legs);

  const basePlan = {
    id: `plan-${firstRide?.routeId || 'walk'}-${destinationCandidate.stop.id}-${Math.round(destinationCandidate.totalArrivalSeconds)}`,
    mode: rideLegs.length ? planModeFromModes(modes) : 'walk',
    routeId: firstRide?.routeId || 'walk',
    summary: {
      totalDurationMinutes,
      totalWalkMinutes,
      totalBusMinutes: totalRideMinutes,
      boardStopName: firstRide?.fromStop?.name || destinationCandidate.stop.name,
      alightStopName: lastRide?.toStop?.name || destinationCandidate.stop.name,
      routeLabel: rideLegs.length ? rideLegs.map((leg) => leg.routeLabel).join(' → ') : 'Pėsčiomis',
      etaMinutes: totalDurationMinutes,
      stopCount: rideLegs.reduce((sum, leg) => sum + Number(leg.stopCount || 0), 0),
      transfersCount: Math.max(0, rideLegs.length - 1),
      directionCode: firstRide?.headsign || null,
      headsign: firstRide?.headsign || null,
      journeyMessage: rideLegs.length
        ? `Eik iki „${firstRide.fromStop.name}“, tada ${rideLegs.map((leg) => leg.routeLabel).join(' → ')}, išlipk „${lastRide.toStop.name}“`
        : 'Eik pėsčiomis iki tikslo',
      modes,
    },
    originStop: firstRide?.fromStop || destinationCandidate.state.stop,
    destinationStop: destinationCandidate.stop,
    previewPoints,
    journeySteps,
    liveVehicle: null,
  };

  return enrichPlanWithLiveVehicle(basePlan);
}

function normalizeRequestCoordinate(point) {
  if (!point) return null;

  const latitude = Number(point.latitude ?? point.lat);
  const longitude = Number(point.longitude ?? point.lon ?? point.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

function validateCoordinate(point) {
  return Boolean(normalizeRequestCoordinate(point));
}

async function runTimedSearch({ origin, destination, serviceDate, departureSeconds, profile }) {
  const nearbyOriginStops = (await getNearbyStops(origin, profile.originRadius, profile.stopLimit)).map(normalizeNearbyStop);
  const nearbyDestinationStops = (await getNearbyStops(destination, profile.destinationRadius, profile.stopLimit)).map(normalizeNearbyStop);

  if (!nearbyOriginStops.length || !nearbyDestinationStops.length) {
    return {
      plan: null,
      options: [],
      meta: { reason: 'NO_NEARBY_STOPS', serviceDate, departureSeconds, nearbyOriginStops, nearbyDestinationStops, searchProfile: profile },
    };
  }

  const allCandidateStopIds = Array.from(new Set([...nearbyOriginStops, ...nearbyDestinationStops].map((stop) => stop.id)));

  const transferRows = await getWalkingTransfers(
    allCandidateStopIds,
    Math.min(profile.transferRadius, Number(env.MAX_WALKING_METERS || 500)),
    24
  );

  const transferMap = buildWalkingTransfersMap(transferRows);

  const bestByStop = createBestStateMap(nearbyOriginStops, origin, departureSeconds);

  let frontierStopIds = nearbyOriginStops.map((stop) => stop.id);
  frontierStopIds = frontierStopIds.concat(applyWalkingClosure(bestByStop, frontierStopIds, transferMap));

  let bestDestination = buildDestinationCandidate(bestByStop, nearbyDestinationStops, destination, null);

  const maxTransfers = Math.min(profile.maxTransfers, Number(env.MAX_TRANSFERS || 3));

  for (let rideCount = 0; rideCount <= maxTransfers; rideCount += 1) {
    const frontierEntries = frontierStopIds
      .map((stopId) => ({ stopId, earliestArrivalSeconds: bestByStop.get(stopId)?.arrivalSeconds }))
      .filter((entry) => Number.isFinite(entry.earliestArrivalSeconds));

    if (!frontierEntries.length) break;

    const boardings = await getCandidateBoardings(frontierEntries, serviceDate, profile.perStopBoardLimit, profile.horizonSeconds);
    if (!boardings.length) break;

    const chosenBoardings = chooseBoardingsPerTrip(boardings, bestByStop);

    const minBoardSequenceByTrip = {};
    for (const row of chosenBoardings) {
      minBoardSequenceByTrip[row.trip_id] = Number(row.board_sequence || 0);
    }

    const tripRows = await getTripStopSequences(chosenBoardings.map((row) => row.trip_id), minBoardSequenceByTrip);

    const tripMap = groupTripRows(tripRows);
    const nextFrontier = new Set();

    for (const boarding of chosenBoardings) {
      const reachedState = bestByStop.get(boarding.board_stop_id);
      if (!reachedState) continue;
      if (reachedState.ridesUsed > rideCount) continue;

      const tripStops = tripMap.get(boarding.trip_id) || [];
      const boardSequence = Number(boarding.board_sequence || 0);
      const boardDepartureSeconds = Number(boarding.board_departure_seconds || 0);
      const routeLabel = routeLabelFromRow(boarding);
      const boardStop = reachedState.stop;

      for (const stopRow of tripStops) {
        const stopSequence = Number(stopRow.stop_sequence || 0);
        const arrivalSeconds = Number(stopRow.arrival_seconds);

        if (stopSequence <= boardSequence || !Number.isFinite(arrivalSeconds)) continue;

        const current = bestByStop.get(stopRow.stop_id);
        const nextArrivalSeconds = arrivalSeconds;

        if (!current || nextArrivalSeconds < current.arrivalSeconds - 30) {
          bestByStop.set(stopRow.stop_id, {
            stop: {
              id: stopRow.stop_id,
              name: stopRow.stop_name,
              latitude: Number(stopRow.stop_lat),
              longitude: Number(stopRow.stop_lon),
              distanceMeters: 0,
            },
            arrivalSeconds: nextArrivalSeconds,
            ridesUsed: rideCount + 1,
            prev: {
              type: 'ride',
              routeId: boarding.route_id,
              routeLabel,
              routeType: boarding.route_type,
              headsign: boarding.trip_headsign || stopRow.trip_headsign || null,
              shapeId: boarding.shape_id,
              boardDepartureSeconds,
              stopCount: stopSequence - boardSequence,
              fromStop: boardStop,
            },
          });

          nextFrontier.add(stopRow.stop_id);
        }
      }
    }

    const closureStops = applyWalkingClosure(bestByStop, Array.from(nextFrontier), transferMap);
    frontierStopIds = Array.from(new Set([...nextFrontier, ...closureStops]));

    bestDestination = buildDestinationCandidate(bestByStop, nearbyDestinationStops, destination, bestDestination);
  }

  if (!bestDestination) {
    return {
      plan: null,
      options: [],
      meta: { reason: 'NO_JOURNEY_FOUND', serviceDate, departureSeconds, nearbyOriginStops, nearbyDestinationStops, searchProfile: profile },
    };
  }

  bestDestination.bestByStop = bestByStop;

  const plan = await buildPlanFromDestinationCandidate({
    origin,
    destination,
    destinationCandidate: bestDestination,
  });

  return {
    plan,
    options: [plan],
    meta: {
      reason: 'OK',
      serviceDate,
      departureSeconds,
      nearbyOriginStops,
      nearbyDestinationStops,
      searchProfile: profile,
    },
  };
}

async function planJourney({ origin, destination, serviceDate, departureSeconds }) {
  let lastResult = null;

  for (const profile of SEARCH_PROFILES) {
    const startedAt = Date.now();

    const result = await runTimedSearch({
      origin,
      destination,
      serviceDate,
      departureSeconds,
      profile,
    });

    lastResult = result;

    if (result.plan) {
      return {
        plan: result.plan,
        options: [result.plan],
        meta: {
          ...(result.meta || {}),
          reason: 'OK',
          responseMs: Date.now() - startedAt,
        },
      };
    }

    if (Date.now() - startedAt > 4500) break;
  }

  return (
    lastResult || {
      plan: null,
      options: [],
      meta: { reason: 'NO_JOURNEY_FOUND', serviceDate, departureSeconds },
    }
  );
}

async function planJourneyFromRequest(body) {
  const origin = normalizeRequestCoordinate(body?.origin ?? body?.from);
  const destination = normalizeRequestCoordinate(body?.destination ?? body?.to);

  if (!validateCoordinate(origin) || !validateCoordinate(destination)) {
    const error = new Error('origin and destination coordinates are required');
    error.statusCode = 400;
    throw error;
  }

  const localNow = nowInVilniusParts();
  const serviceDate = String(body?.serviceDate || localNow.date);
  const departureSeconds = Number(body?.departureSeconds || (serviceDate === localNow.date ? localNow.seconds : 0));

  return planJourney({
    origin: toCoordinate(origin.latitude, origin.longitude),
    destination: toCoordinate(destination.latitude, destination.longitude),
    serviceDate,
    departureSeconds,
  });
}

module.exports = {
  planJourney,
  planJourneyFromRequest,
};