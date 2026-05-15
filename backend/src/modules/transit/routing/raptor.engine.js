/* eslint-env node */
function scoreJourney(route) {
  const duration = Number(route?.totalDurationMinutes ?? route?.totalMinutes ?? 9999);
  const transfers = Number(route?.transfersCount ?? route?.transfers ?? 99);
  const walk = Number(route?.totalWalkMinutes ?? route?.walkingMinutes ?? 9999);
  return duration + transfers * 6 + walk * 0.45;
}

function selectRouteOptions(routes = []) {
  const valid = routes.filter(Boolean);
  const buckets = [
    { optionType: "fastest", optionLabel: "Greičiausias", sort: (a, b) => Number(a.totalDurationMinutes || a.totalMinutes || 9999) - Number(b.totalDurationMinutes || b.totalMinutes || 9999) },
    { optionType: "less_walk", optionLabel: "Mažiau ėjimo", sort: (a, b) => Number(a.totalWalkMinutes || a.walkingMinutes || 9999) - Number(b.totalWalkMinutes || b.walkingMinutes || 9999) },
    { optionType: "less_transfer", optionLabel: "Mažiau persėdimų", sort: (a, b) => Number(a.transfersCount || a.transfers || 99) - Number(b.transfersCount || b.transfers || 99) },
  ];
  const seen = new Set();
  const out = [];
  for (const bucket of buckets) {
    const route = [...valid].sort(bucket.sort)[0];
    if (!route) continue;
    const signature = [route.routeLabel, route.boardStopName, route.alightStopName, route.transfersCount].join('|');
    if (seen.has(signature)) continue;
    seen.add(signature);
    out.push({ ...route, ...bucket });
  }
  return out.length ? out : [...valid].sort((a, b) => scoreJourney(a) - scoreJourney(b)).slice(0, 3);
}

module.exports = { scoreJourney, selectRouteOptions };
