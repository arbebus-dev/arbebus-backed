const { FERRY_ROUTES, FERRY_TERMINALS } = require("./ferrySchedule.data");

function minutesFromTime(value) {
  const [hh, mm] = String(value || "").split(":").map((part) => Number(part));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function dateForMinutes(baseDate, minutes, dayOffset = 0) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setMinutes(minutes);
  return date;
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

function isSeasonActive(route, now = new Date()) {
  if (!route.season) return true;
  const year = now.getFullYear();
  const from = new Date(`${year}-${route.season.from}T00:00:00`);
  const to = new Date(`${year}-${route.season.to}T23:59:59`);
  return now >= from && now <= to;
}

function getRoutes() {
  return FERRY_ROUTES.map(normalizeRoute);
}

function getTerminals() {
  return Object.values(FERRY_TERMINALS);
}

function getSchedule(routeId) {
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
    activeNow: isSeasonActive(route),
    sourceName: route.sourceName,
    sourceUrl: route.sourceUrl,
    sourceNote: route.sourceNote,
    departures: route.schedule,
  }));
}

function getNextDepartures({ routeId, limit = 8, now = new Date() } = {}) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const maxItems = Math.max(1, Math.min(Number(limit) || 8, 30));
  const candidates = [];

  for (const route of FERRY_ROUTES) {
    if (routeId && route.id !== routeId && route.routeCode !== routeId) continue;

    for (const departure of route.schedule) {
      const minutes = minutesFromTime(departure);
      if (minutes == null) continue;

      const todayOffset = minutes >= currentMinutes ? 0 : 1;
      const departureDate = dateForMinutes(now, minutes, todayOffset);
      const msUntil = departureDate.getTime() - now.getTime();

      candidates.push({
        routeId: route.id,
        routeCode: route.routeCode,
        title: route.title,
        from: route.from,
        to: route.to,
        via: route.via || [],
        departureTime: departure,
        departureAt: departureDate.toISOString(),
        minutesUntil: Math.max(0, Math.round(msUntil / 60000)),
        durationMinutes: route.durationMinutes,
        arrivalAt: new Date(departureDate.getTime() + route.durationMinutes * 60000).toISOString(),
        operator: route.operator,
        serviceType: route.serviceType,
        activeNow: isSeasonActive(route, now),
        sourceName: route.sourceName,
        sourceUrl: route.sourceUrl,
        sourceNote: route.sourceNote,
      });
    }
  }

  return candidates
    .sort((a, b) => a.minutesUntil - b.minutesUntil)
    .slice(0, maxItems);
}

function getOverview() {
  return {
    ok: true,
    module: "ferries",
    updatedAt: new Date().toISOString(),
    routes: getRoutes(),
    terminals: getTerminals(),
    nextDepartures: getNextDepartures({ limit: 6 }),
  };
}

module.exports = {
  getOverview,
  getRoutes,
  getTerminals,
  getSchedule,
  getNextDepartures,
};
