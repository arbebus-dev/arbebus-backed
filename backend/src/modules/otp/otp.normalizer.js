/* eslint-env node */
function minutes(msOrSeconds) {
  const n = Number(msOrSeconds || 0);
  if (!Number.isFinite(n)) return 0;
  // OTP duration is usually seconds; timestamps are epoch ms.
  return Math.max(0, Math.round(n / 60));
}

function dateText(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
}

function coord(point = {}) {
  const latitude = Number(point.lat ?? point.latitude);
  const longitude = Number(point.lon ?? point.lng ?? point.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function stopId(place = {}) {
  return place.stop?.gtfsId || place.stop?.code || null;
}

function legTitle(leg = {}) {
  if (leg.mode === 'WALK') return `Eik iki ${leg.to?.name || 'tikslo'}`;
  const route = leg.route?.shortName || leg.route?.longName || 'autobusą';
  return `Važiuok autobusu ${route}`;
}

function normalizeLeg(leg = {}, index = 0) {
  const from = coord(leg.from);
  const to = coord(leg.to);
  const routeNumber = leg.route?.shortName || leg.route?.longName || null;
  const type = leg.mode === 'WALK' ? 'walk' : 'ride';
  const durationMinutes = minutes(leg.duration);
  return {
    id: `otp-leg-${index}`,
    type,
    mode: type === 'walk' ? 'walk' : 'bus',
    title: legTitle(leg),
    subtitle: type === 'walk'
      ? `${Math.round(Number(leg.distance || 0))} m • ${durationMinutes} min`
      : `${leg.from?.name || ''} → ${leg.to?.name || ''} • ${durationMinutes} min`,
    routeId: leg.route?.gtfsId || null,
    routeNumber,
    routeLabel: routeNumber,
    fromStopId: stopId(leg.from),
    toStopId: stopId(leg.to),
    fromStopName: leg.from?.name || null,
    toStopName: leg.to?.name || null,
    stopName: leg.from?.name || null,
    durationMinutes,
    minutes: durationMinutes,
    distanceMeters: Math.round(Number(leg.distance || 0)),
    departureTime: dateText(leg.startTime),
    arrivalTime: dateText(leg.endTime),
    polyline: [from, to].filter(Boolean),
    stops: (leg.intermediateStops || []).map((s) => ({
      id: stopId(s) || s.name,
      stopId: stopId(s) || s.name,
      name: s.name,
      title: s.name,
      ...coord(s),
      coordinate: coord(s),
    })).filter((s) => s.coordinate),
    headsign: leg.trip?.tripHeadsign || null,
  };
}

function normalizeItinerary(itinerary = {}, index = 0) {
  const steps = (itinerary.legs || []).map(normalizeLeg);
  const routeNumbers = Array.from(new Set(steps.map((s) => s.routeNumber).filter(Boolean)));
  const transitSteps = steps.filter((s) => s.type !== 'walk');
  const walkSteps = steps.filter((s) => s.type === 'walk');
  const polyline = steps.flatMap((s) => s.polyline || []);
  const totalDurationMinutes = minutes(itinerary.duration);
  return {
    id: `otp-${index}`,
    title: routeNumbers.length ? `Autobusas ${routeNumbers.join(' + ')}` : 'Maršrutas',
    mode: routeNumbers.length ? 'bus' : 'walk',
    routeId: transitSteps[0]?.routeId || null,
    routeLabel: routeNumbers[0] || null,
    routeNumbers,
    totalDurationMinutes,
    totalMinutes: totalDurationMinutes,
    totalWalkMinutes: Math.round((Number(itinerary.walkDistance || 0) || 0) / 78),
    walkingMinutes: Math.round((Number(itinerary.walkDistance || 0) || 0) / 78),
    totalBusMinutes: transitSteps.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0),
    etaMinutes: totalDurationMinutes,
    transfers: Number(itinerary.transfers || Math.max(0, transitSteps.length - 1)),
    transfersCount: Number(itinerary.transfers || Math.max(0, transitSteps.length - 1)),
    stopCount: transitSteps.reduce((sum, s) => sum + (s.stops?.length || 0), 0),
    boardStopName: transitSteps[0]?.fromStopName || null,
    alightStopName: transitSteps[transitSteps.length - 1]?.toStopName || null,
    previewPoints: polyline,
    polyline,
    steps,
    journeySteps: steps,
    legs: transitSteps,
    departureText: dateText(itinerary.startTime),
    arrivalText: dateText(itinerary.endTime),
    summary: {
      routeNumbers,
      totalDurationMinutes,
      transfersCount: Number(itinerary.transfers || Math.max(0, transitSteps.length - 1)),
      boardStopName: transitSteps[0]?.fromStopName || null,
      alightStopName: transitSteps[transitSteps.length - 1]?.toStopName || null,
      departureTime: dateText(itinerary.startTime),
      arrivalTime: dateText(itinerary.endTime),
    },
    routingQuality: { score: 90, candidateType: 'otp', hasGtfsSchedule: true, hasWalkingGeometry: true },
  };
}

function normalizeOtpPlan(otpPayload = {}) {
  const itineraries = otpPayload.itineraries || otpPayload.raw?.data?.plan?.itineraries || [];
  const routes = itineraries.map(normalizeItinerary);
  return {
    ok: routes.length > 0,
    source: 'otp2',
    plan: routes[0] || null,
    options: routes,
    routes,
    meta: { engine: 'otp2', itineraries: routes.length },
  };
}

module.exports = { normalizeOtpPlan };
