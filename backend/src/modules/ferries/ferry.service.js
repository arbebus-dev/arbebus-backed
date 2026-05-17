const { FERRY_ROUTES, FERRY_TERMINALS } = require("./ferrySchedule.data");

const FERRY_TIME_ZONE = "Europe/Vilnius";

function minutesFromTime(value) {
  const [hh, mm] = String(value || "").split(":").map((part) => Number(part));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getZonedParts(date = new Date(), timeZone = FERRY_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const values = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  let hour = Number(values.hour);
  if (hour === 24) hour = 0;

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour,
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function addLocalDays(parts, dayOffset = 0) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getTimeZoneOffsetMinutes(date, timeZone = FERRY_TIME_ZONE) {
  const parts = getZonedParts(date, timeZone);
  const zonedAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((zonedAsUtcMs - date.getTime()) / 60000);
}

function localDateTimeToUtcDate(localDate, minutes, timeZone = FERRY_TIME_ZONE) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const localAsUtcMs = Date.UTC(localDate.year, localDate.month - 1, localDate.day, hour, minute, 0, 0);

  let utcDate = new Date(localAsUtcMs);
  let offsetMinutes = getTimeZoneOffsetMinutes(utcDate, timeZone);
  utcDate = new Date(localAsUtcMs - offsetMinutes * 60000);

  // Second pass handles DST boundary days safely.
  offsetMinutes = getTimeZoneOffsetMinutes(utcDate, timeZone);
  return new Date(localAsUtcMs - offsetMinutes * 60000);
}

function formatLocalDate(localDate) {
  return `${localDate.year}-${pad2(localDate.month)}-${pad2(localDate.day)}`;
}

function formatLocalDateTime(localDate, time) {
  return `${formatLocalDate(localDate)}T${time}:00`;
}

function normalizeRoute(route) {
  return {
    ...route,
    departures: route.schedule,
    polyline: [
      { latitude: route.from.latitude, longitude: route.from.longitude },
      { latitude: route.to.latitude, longitude: route.to.longitude },
    ],
  };
}

function isSeasonActive(route, now = new Date(), timeZone = FERRY_TIME_ZONE) {
  if (!route.season) return true;
  const local = getZonedParts(now, timeZone);
  const currentKey = `${pad2(local.month)}-${pad2(local.day)}`;
  return currentKey >= route.season.from && currentKey <= route.season.to;
}

function getRoutes() {
  return FERRY_ROUTES.map(normalizeRoute);
}

function getTerminals() {
  return Object.values(FERRY_TERMINALS);
}

function getSchedule(routeId, options = {}) {
  const now = options.now || new Date();
  const timeZone = options.timeZone || FERRY_TIME_ZONE;
  const routes = routeId
    ? FERRY_ROUTES.filter((route) => route.id === routeId || route.routeCode === routeId)
    : FERRY_ROUTES;

  return routes.map((route) => ({
    id: route.id,
    routeCode: route.routeCode,
    title: route.title,
    from: route.from,
    to: route.to,
    via: route.via || [],
    durationMinutes: route.durationMinutes,
    operator: route.operator,
    serviceType: route.serviceType,
    season: route.season || null,
    activeNow: isSeasonActive(route, now, timeZone),
    sourceName: route.sourceName,
    sourceUrl: route.sourceUrl,
    sourceNote: route.sourceNote,
    timeZone,
    departures: route.schedule,
  }));
}

function coerceDate(value) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getNextDepartures({ routeId, limit = 8, now = new Date(), timeZone = FERRY_TIME_ZONE } = {}) {
  const safeNow = now instanceof Date ? now : coerceDate(now);
  const localNow = getZonedParts(safeNow, timeZone);
  const currentMinutes = localNow.hour * 60 + localNow.minute;
  const maxItems = Math.max(1, Math.min(Number(limit) || 8, 30));
  const candidates = [];

  for (const route of FERRY_ROUTES) {
    if (routeId && route.id !== routeId && route.routeCode !== routeId) continue;

    for (const departure of route.schedule) {
      const minutes = minutesFromTime(departure);
      if (minutes == null) continue;

      const dayOffset = minutes >= currentMinutes ? 0 : 1;
      const localDate = addLocalDays(localNow, dayOffset);
      const departureDate = localDateTimeToUtcDate(localDate, minutes, timeZone);
      const msUntil = departureDate.getTime() - safeNow.getTime();
      const arrivalDate = new Date(departureDate.getTime() + route.durationMinutes * 60000);

      candidates.push({
        routeId: route.id,
        routeCode: route.routeCode,
        title: route.title,
        from: route.from,
        to: route.to,
        via: route.via || [],
        departureTime: departure,
        departureLocalDate: formatLocalDate(localDate),
        departureAtLocal: formatLocalDateTime(localDate, departure),
        departureAt: departureDate.toISOString(),
        minutesUntil: Math.max(0, Math.round(msUntil / 60000)),
        durationMinutes: route.durationMinutes,
        arrivalAt: arrivalDate.toISOString(),
        operator: route.operator,
        serviceType: route.serviceType,
        activeNow: isSeasonActive(route, safeNow, timeZone),
        sourceName: route.sourceName,
        sourceUrl: route.sourceUrl,
        sourceNote: route.sourceNote,
        timeZone,
        serverNow: safeNow.toISOString(),
        localNow: `${localNow.year}-${pad2(localNow.month)}-${pad2(localNow.day)}T${pad2(localNow.hour)}:${pad2(localNow.minute)}:${pad2(localNow.second)}`,
      });
    }
  }

  return candidates
    .sort((a, b) => a.minutesUntil - b.minutesUntil)
    .slice(0, maxItems);
}

function getOverview(options = {}) {
  const now = options.now || new Date();
  const timeZone = options.timeZone || FERRY_TIME_ZONE;
  const local = getZonedParts(now, timeZone);

  return {
    ok: true,
    module: "ferries",
    updatedAt: new Date().toISOString(),
    timeZone,
    localNow: `${local.year}-${pad2(local.month)}-${pad2(local.day)}T${pad2(local.hour)}:${pad2(local.minute)}:${pad2(local.second)}`,
    routes: getRoutes(),
    terminals: getTerminals(),
    nextDepartures: getNextDepartures({ limit: 6, now, timeZone }),
  };
}

module.exports = {
  FERRY_TIME_ZONE,
  getOverview,
  getRoutes,
  getTerminals,
  getSchedule,
  getNextDepartures,
};
