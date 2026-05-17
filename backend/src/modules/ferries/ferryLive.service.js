const { FERRY_ROUTES } = require("./ferrySchedule.data");
const ferryService = require("./ferry.service");

const LIVE_SOURCE = "schedule_estimate";
const FERRY_TIME_ZONE = ferryService.FERRY_TIME_ZONE || "Europe/Vilnius";

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coordinateOf(point) {
  const latitude = toFiniteNumber(point?.latitude ?? point?.coordinate?.latitude);
  const longitude = toFiniteNumber(point?.longitude ?? point?.coordinate?.longitude);
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

function interpolateCoordinate(from, to, progress) {
  const start = coordinateOf(from);
  const end = coordinateOf(to);
  if (!start || !end) return null;

  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * clamped,
    longitude: start.longitude + (end.longitude - start.longitude) * clamped,
  };
}

function bearingDegrees(from, to) {
  const start = coordinateOf(from);
  const end = coordinateOf(to);
  if (!start || !end) return 0;

  const lat1 = (start.latitude * Math.PI) / 180;
  const lat2 = (end.latitude * Math.PI) / 180;
  const dLon = ((end.longitude - start.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

function pierTypeForRoute(route) {
  const line = String(route?.ferryLine || route?.id || route?.routeCode || "").toLowerCase();
  if (line.includes("senoji") || line.includes("old")) return "old";
  if (line.includes("naujoji") || line.includes("new")) return "new";
  if (line.includes("nida") || line.includes("seasonal")) return "nida";
  return "ferry";
}

function pierNameForType(type) {
  if (type === "old") return "Senoji perkėla";
  if (type === "new") return "Naujoji perkėla";
  if (type === "nida") return "Klaipėda–Nida";
  return "Keltas";
}

function coerceDate(value) {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function sailingPositionForRoute(route, now, timeZone) {
  const departures = ferryService.getNextDepartures({
    routeId: route.id,
    limit: Math.max(8, route.schedule?.length || 8),
    now,
    timeZone,
  });

  const durationMs = Math.max(1, Number(route.durationMinutes || 1)) * 60 * 1000;

  for (const departure of departures) {
    const departureMs = Date.parse(departure.departureAt);
    const arrivalMs = Date.parse(departure.arrivalAt);

    if (!Number.isFinite(departureMs) || !Number.isFinite(arrivalMs)) continue;

    if (now.getTime() >= departureMs && now.getTime() <= arrivalMs) {
      const progress = Math.max(0, Math.min(1, (now.getTime() - departureMs) / durationMs));
      const coordinate = interpolateCoordinate(route.from, route.to, progress);
      if (!coordinate) continue;

      return {
        coordinate,
        progress,
        departure,
        status: "sailing",
        minutesUntilDeparture: 0,
        minutesUntilArrival: Math.max(0, Math.ceil((arrivalMs - now.getTime()) / 60000)),
      };
    }
  }

  const nextDeparture = departures[0] || null;
  const coordinate = coordinateOf(route.from);

  return {
    coordinate,
    progress: 0,
    departure: nextDeparture,
    status: "docked",
    minutesUntilDeparture: Math.max(0, Number(nextDeparture?.minutesUntil ?? 0)),
    minutesUntilArrival: null,
  };
}

function liveFerryFromRoute(route, now, timeZone) {
  const state = sailingPositionForRoute(route, now, timeZone);
  if (!state.coordinate) return null;

  const pierType = pierTypeForRoute(route);
  const heading = bearingDegrees(route.from, route.to);

  return {
    id: `live-${route.id}`,
    routeId: route.id,
    routeCode: route.routeCode,
    title: route.title,
    pierType,
    pierName: route.ferryLine || pierNameForType(pierType),
    ferryLine: route.ferryLine || pierNameForType(pierType),
    from: route.from,
    to: route.to,
    via: route.via || [],
    latitude: state.coordinate.latitude,
    longitude: state.coordinate.longitude,
    coordinate: state.coordinate,
    heading,
    bearing: heading,
    progress: Number(state.progress.toFixed(4)),
    status: state.status,
    departureTime: state.departure?.departureTime || null,
    departureAt: state.departure?.departureAt || null,
    arrivalAt: state.departure?.arrivalAt || null,
    minutesUntilDeparture: state.minutesUntilDeparture,
    minutesUntilArrival: state.minutesUntilArrival,
    durationMinutes: route.durationMinutes,
    operator: route.operator,
    serviceType: route.serviceType,
    source: LIVE_SOURCE,
    isRealtime: false,
    timeZone,
    updatedAt: now.toISOString(),
  };
}

function getLiveFerries({ now = new Date(), timeZone = FERRY_TIME_ZONE, routeId } = {}) {
  const safeNow = coerceDate(now);
  const routes = FERRY_ROUTES.filter((route) => !routeId || route.id === routeId || route.routeCode === routeId);

  return routes
    .map((route) => liveFerryFromRoute(route, safeNow, timeZone))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "sailing" ? -1 : 1;
      return String(a.pierName).localeCompare(String(b.pierName));
    });
}

module.exports = {
  getLiveFerries,
  LIVE_SOURCE,
};
