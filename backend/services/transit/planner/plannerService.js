const {
  getNearbyStops,
  getDirectJourneys,
  getTransferJourneys,
  getShapePoints,
} = require('./plannerRepository');
const { estimateWalkMinutes, getDistanceMeters } = require('./geo');

const SEARCH_PROFILES = [
  { originRadius: 700, destinationRadius: 700, limit: 8, transferMaxSeconds: 3600 },
  { originRadius: 1500, destinationRadius: 1500, limit: 14, transferMaxSeconds: 5400 },
  { originRadius: 4000, destinationRadius: 4000, limit: 18, transferMaxSeconds: 7200 },
  { originRadius: 12000, destinationRadius: 12000, limit: 24, transferMaxSeconds: 10800 },
];

function toCoordinate(latitude, longitude) {
  return { latitude: Number(latitude), longitude: Number(longitude) };
}
function normalizeNearbyStop(stop) {
  return {
    id: stop.id,
    name: stop.name,
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude),
    distanceMeters: Number(stop.distance_meters || 0),
  };
}
function secondsToMinutes(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds)) return null;
  return Math.max(1, Math.round(deltaSeconds / 60));
}
function uiStep(icon, title, subtitle, extra = {}) { return { icon, title, subtitle, ...extra }; }
function stopToCoord(stop) { return { latitude: Number(stop.latitude), longitude: Number(stop.longitude) }; }
function shapeRowsToCoords(rows) { return rows.map((row) => ({ latitude: Number(row.latitude), longitude: Number(row.longitude) })); }
function dedupeCoords(coords) {
  const result = []; let lastKey = null;
  for (const point of coords) {
    if (!point) continue;
    const key = `${Number(point.latitude).toFixed(6)}:${Number(point.longitude).toFixed(6)}`;
    if (key === lastKey) continue;
    result.push({ latitude: Number(point.latitude), longitude: Number(point.longitude) });
    lastKey = key;
  }
  return result;
}
function modeFromRouteType(routeType) { return Number(routeType) === 2 ? 'train' : 'bus'; }
function rideTitle(mode) { return mode === 'train' ? 'Važiuok traukiniu' : 'Važiuok autobusu'; }
function boardTitle(mode, routeLabel) { return mode === 'train' ? `Lipk į traukinį ${routeLabel}` : `Lipk į autobusą ${routeLabel}`; }
function compactRouteLabel(row, prefix = '') {
  const shortName = row[`${prefix}route_short_name`] || row[`${prefix}route_id`] || row.route_short_name || row.route_id;
  const longName = row[`${prefix}route_long_name`] || row.route_long_name || null;
  return longName && longName !== shortName ? `${shortName} • ${longName}` : shortName;
}
function uniqueModes(modes) { return Array.from(new Set((modes || []).filter(Boolean))); }
function planModeFromModes(modes) { const m = uniqueModes(modes); return m.length > 1 ? 'mixed' : (m[0] || 'bus'); }
async function buildPreviewPoints({ origin, destination, stops = [], shapeIds = [] }) {
  const segments = [origin];
  for (const stop of stops) segments.push(stopToCoord(stop));
  for (const shapeId of shapeIds) {
    const rows = await getShapePoints(shapeId);
    if (rows.length) segments.push(...shapeRowsToCoords(rows));
  }
  segments.push(destination);
  return dedupeCoords(segments);
}
async function buildDirectPlan({ origin, destination, originStopMap, destinationStopMap, row }) {
  const originStop = originStopMap.get(row.origin_stop_id);
  const destinationStop = destinationStopMap.get(row.destination_stop_id);
  if (!originStop || !destinationStop) return null;
  const segmentMode = modeFromRouteType(row.route_type);
  const walkToStopMinutes = estimateWalkMinutes(getDistanceMeters(origin, originStop));
  const walkFromStopMinutes = estimateWalkMinutes(getDistanceMeters(destinationStop, destination));
  const rideMinutes = secondsToMinutes(Number(row.destination_arrival_seconds) - Number(row.origin_departure_seconds)) || Math.max(3, Number(row.stop_count || 1) * 2);
  const routeLabel = compactRouteLabel(row);
  const modes = [segmentMode];
  return {
    id: `direct-${row.trip_id}-${row.origin_stop_id}-${row.destination_stop_id}`,
    mode: planModeFromModes(modes),
    routeId: row.route_id,
    summary: {
      totalDurationMinutes: walkToStopMinutes + rideMinutes + walkFromStopMinutes,
      totalWalkMinutes: walkToStopMinutes + walkFromStopMinutes,
      totalBusMinutes: rideMinutes,
      boardStopName: originStop.name,
      alightStopName: destinationStop.name,
      routeLabel,
      etaMinutes: null,
      stopCount: Number(row.stop_count || 0),
      transfersCount: 0,
      directionCode: row.direction_id != null ? String(row.direction_id) : null,
      headsign: row.trip_headsign || row.route_long_name || null,
      journeyMessage: `${routeLabel} nuo ${originStop.name} iki ${destinationStop.name}`,
      modes,
    },
    originStop,
    destinationStop,
    previewPoints: await buildPreviewPoints({ origin, destination, stops: [originStop, destinationStop], shapeIds: [row.shape_id] }),
    journeySteps: [
      uiStep('walk', 'Eik iki stotelės', `Iki „${originStop.name}“ • ${walkToStopMinutes} min pėsčiomis`, { type: 'walk', mode: 'walk', instruction: `Eik iki stotelės „${originStop.name}“` }),
      uiStep(segmentMode === 'train' ? 'train' : 'bus', boardTitle(segmentMode, routeLabel), row.trip_headsign || 'Tiesioginis maršrutas', { type: 'board', mode: segmentMode, stopId: originStop.id, stopName: originStop.name, routeId: row.route_id }),
      uiStep(segmentMode === 'train' ? 'train' : 'bus', rideTitle(segmentMode), `Iki „${destinationStop.name}“ • ${rideMinutes} min`, { type: 'ride', mode: segmentMode, fromStopId: originStop.id, toStopId: destinationStop.id, stopCount: Number(row.stop_count || 0) }),
      uiStep('flag-checkered', 'Išlipk', `„${destinationStop.name}“`, { type: 'alight', stopId: destinationStop.id, stopName: destinationStop.name }),
      uiStep('walk', 'Eik iki tikslo', `${walkFromStopMinutes} min pėsčiomis`, { type: 'walk', mode: 'walk', instruction: 'Eik iki galutinio taško' }),
    ],
    liveVehicle: null,
  };
}
async function buildTransferPlan({ origin, destination, originStopMap, destinationStopMap, row }) {
  const originStop = originStopMap.get(row.origin_stop_id);
  const destinationStop = destinationStopMap.get(row.destination_stop_id);
  const transferStop = { id: row.transfer_stop_id, name: row.transfer_stop_name, latitude: Number(row.transfer_stop_lat), longitude: Number(row.transfer_stop_lon), distanceMeters: 0 };
  if (!originStop || !destinationStop) return null;
  const firstMode = modeFromRouteType(row.first_route_type);
  const secondMode = modeFromRouteType(row.second_route_type);
  const walkToStopMinutes = estimateWalkMinutes(getDistanceMeters(origin, originStop));
  const walkFromStopMinutes = estimateWalkMinutes(getDistanceMeters(destinationStop, destination));
  const firstRideMinutes = secondsToMinutes(Number(row.transfer_arrival_seconds) - Number(row.origin_departure_seconds)) || Math.max(3, Number(row.stop_count_to_transfer || 1) * 2);
  const secondRideMinutes = secondsToMinutes(Number(row.destination_arrival_seconds) - Number(row.transfer_departure_seconds)) || Math.max(3, Number(row.stop_count_from_transfer || 1) * 2);
  const transferWaitMinutes = secondsToMinutes(Number(row.transfer_departure_seconds) - Number(row.transfer_arrival_seconds)) || 1;
  const firstRouteLabel = compactRouteLabel(row, 'first_');
  const secondRouteLabel = compactRouteLabel(row, 'second_');
  const modes = uniqueModes([firstMode, secondMode]);
  return {
    id: `transfer-${row.first_trip_id}-${row.second_trip_id}-${row.origin_stop_id}-${row.destination_stop_id}`,
    mode: planModeFromModes(modes),
    routeId: row.first_route_id,
    summary: {
      totalDurationMinutes: walkToStopMinutes + firstRideMinutes + transferWaitMinutes + secondRideMinutes + walkFromStopMinutes,
      totalWalkMinutes: walkToStopMinutes + walkFromStopMinutes,
      totalBusMinutes: firstRideMinutes + secondRideMinutes,
      boardStopName: originStop.name,
      alightStopName: destinationStop.name,
      routeLabel: `${firstRouteLabel} → ${secondRouteLabel}`,
      etaMinutes: null,
      stopCount: Number(row.total_stop_count || 0),
      transfersCount: 1,
      directionCode: row.first_direction_id != null ? String(row.first_direction_id) : null,
      headsign: row.first_headsign || null,
      journeyMessage: `Iš ${originStop.name} važiuok ${firstRouteLabel}, persėsk „${transferStop.name}“, tada ${secondRouteLabel}`,
      modes,
    },
    originStop,
    destinationStop,
    previewPoints: await buildPreviewPoints({ origin, destination, stops: [originStop, transferStop, destinationStop], shapeIds: [row.first_shape_id, row.second_shape_id] }),
    journeySteps: [
      uiStep('walk', 'Eik iki stotelės', `Iki „${originStop.name}“ • ${walkToStopMinutes} min pėsčiomis`, { type: 'walk', mode: 'walk', instruction: `Eik iki stotelės „${originStop.name}“` }),
      uiStep(firstMode === 'train' ? 'train' : 'bus', boardTitle(firstMode, firstRouteLabel), row.first_headsign || 'Pirmas segmentas', { type: 'board', mode: firstMode, stopId: originStop.id, stopName: originStop.name, routeId: row.first_route_id }),
      uiStep(firstMode === 'train' ? 'train' : 'bus', rideTitle(firstMode), `Iki „${transferStop.name}“ • ${firstRideMinutes} min`, { type: 'ride', mode: firstMode, fromStopId: originStop.id, toStopId: transferStop.id, stopCount: Number(row.stop_count_to_transfer || 0) }),
      uiStep('swap-horizontal', 'Persėsk', `„${transferStop.name}“ • laukimas ${transferWaitMinutes} min`, { type: 'transfer', mode: 'transfer', stopId: transferStop.id, stopName: transferStop.name }),
      uiStep(secondMode === 'train' ? 'train' : 'bus', boardTitle(secondMode, secondRouteLabel), row.second_headsign || `Iki „${destinationStop.name}“`, { type: 'board', mode: secondMode, stopId: transferStop.id, stopName: transferStop.name, routeId: row.second_route_id }),
      uiStep(secondMode === 'train' ? 'train' : 'bus', rideTitle(secondMode), `Iki „${destinationStop.name}“ • ${secondRideMinutes} min`, { type: 'ride', mode: secondMode, fromStopId: transferStop.id, toStopId: destinationStop.id, stopCount: Number(row.stop_count_from_transfer || 0) }),
      uiStep('flag-checkered', 'Išlipk', `„${destinationStop.name}“`, { type: 'alight', stopId: destinationStop.id, stopName: destinationStop.name }),
      uiStep('walk', 'Eik iki tikslo', `${walkFromStopMinutes} min pėsčiomis`, { type: 'walk', mode: 'walk', instruction: 'Eik iki galutinio taško' }),
    ],
    liveVehicle: null,
  };
}
function dedupePlans(options) {
  const seen = new Set(); const unique = [];
  for (const option of options) {
    const key = `${option.summary.routeLabel}|${option.summary.boardStopName}|${option.summary.alightStopName}|${option.summary.totalDurationMinutes}`;
    if (seen.has(key)) continue;
    seen.add(key); unique.push(option);
  }
  return unique;
}
async function planJourneyWithProfile({ origin, destination, serviceDate, profile }) {
  const nearbyOriginStops = (await getNearbyStops(origin, profile.originRadius, profile.limit)).map(normalizeNearbyStop);
  const nearbyDestinationStops = (await getNearbyStops(destination, profile.destinationRadius, profile.limit)).map(normalizeNearbyStop);
  if (!nearbyOriginStops.length || !nearbyDestinationStops.length) {
    return { plan: null, options: [], meta: { reason: 'NO_NEARBY_STOPS', serviceDate, nearbyOriginStops, nearbyDestinationStops, searchProfile: profile } };
  }
  const originStopMap = new Map(nearbyOriginStops.map((stop) => [stop.id, stop]));
  const destinationStopMap = new Map(nearbyDestinationStops.map((stop) => [stop.id, stop]));
  const directRows = await getDirectJourneys({ originStopIds: nearbyOriginStops.map((stop) => stop.id), destinationStopIds: nearbyDestinationStops.map((stop) => stop.id), serviceDate, limit: 8 });
  const directOptions = [];
  for (const row of directRows) { const plan = await buildDirectPlan({ origin, destination, originStopMap, destinationStopMap, row }); if (plan) directOptions.push(plan); }
  const transferRows = await getTransferJourneys({ originStopIds: nearbyOriginStops.map((stop) => stop.id), destinationStopIds: nearbyDestinationStops.map((stop) => stop.id), serviceDate, limit: 8, maxTransferWaitSeconds: profile.transferMaxSeconds });
  const transferOptions = [];
  for (const row of transferRows) { const plan = await buildTransferPlan({ origin, destination, originStopMap, destinationStopMap, row }); if (plan) transferOptions.push(plan); }
  const options = dedupePlans([...directOptions, ...transferOptions]).sort((a,b)=>Number(a.summary.totalDurationMinutes||9999)-Number(b.summary.totalDurationMinutes||9999)).slice(0,4);
  return { plan: options[0] || null, options, meta: { serviceDate, reason: options.length ? 'OK' : 'NO_JOURNEY_FOUND', nearbyOriginStops, nearbyDestinationStops, searchProfile: profile } };
}
async function planJourney({ origin, destination, serviceDate }) {
  let lastResult = null;
  for (const profile of SEARCH_PROFILES) {
    const result = await planJourneyWithProfile({ origin, destination, serviceDate, profile });
    lastResult = result;
    if (result.options.length) return result;
  }
  return lastResult || { plan: null, options: [], meta: { serviceDate, reason: 'NO_JOURNEY_FOUND', nearbyOriginStops: [], nearbyDestinationStops: [] } };
}
function validateCoordinate(point) { return point && Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)); }
async function planJourneyFromRequest(body) {
  const origin = body?.origin; const destination = body?.destination;
  if (!validateCoordinate(origin) || !validateCoordinate(destination)) {
    const error = new Error('origin and destination coordinates are required'); error.statusCode = 400; throw error;
  }
  return planJourney({ origin: toCoordinate(origin.latitude, origin.longitude), destination: toCoordinate(destination.latitude, destination.longitude), serviceDate: String(body?.serviceDate || new Date().toISOString().slice(0, 10)) });
}
module.exports = { planJourney, planJourneyFromRequest };
