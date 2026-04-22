const { getPool } = require("../db/pool");

// =======================
// CONFIG
// =======================

const MAX_LOOKAHEAD = 6 * 3600; // 6 valandos
const MAX_SCANS = 500000;

// =======================
// CACHE
// =======================

let cachedConnections = null;

// =======================
// UTILS
// =======================

function timeToSeconds(t) {
  if (!t || typeof t !== "string") return null;

  const parts = t.split(":").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }

  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

// =======================
// BUILD CONNECTIONS
// =======================

async function buildConnections() {
  if (cachedConnections) return cachedConnections;

  const pool = getPool();

  const { rows } = await pool.query(`
    SELECT
      trip_id,
      stop_id,
      arrival_time,
      departure_time,
      stop_sequence
    FROM transit.stop_times
    ORDER BY trip_id, stop_sequence
  `);

  const connections = [];

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];

    if (prev.trip_id !== curr.trip_id) continue;

    const dep = timeToSeconds(prev.departure_time);
    const arr = timeToSeconds(curr.arrival_time);

    if (dep == null || arr == null) continue;

    connections.push({
      from: prev.stop_id,
      to: curr.stop_id,
      dep,
      arr,
      trip_id: curr.trip_id,
      from_sequence: Number(prev.stop_sequence),
      to_sequence: Number(curr.stop_sequence),
    });
  }

  // svarbiausia CSA dalis
  connections.sort((a, b) => a.dep - b.dep);

  cachedConnections = connections;

  console.log(`✅ CSA connections built: ${connections.length}`);

  return connections;
}

// =======================
// CSA ROUTE
// =======================

async function csaRoute(originStops, destStops, departureTime) {
  const connections = await buildConnections();

  const earliest = {};
  const previousConnection = {};
  const destinationSet = new Set(destStops);

  // pradžia
  for (const stopId of originStops) {
    earliest[stopId] = departureTime;
  }

  let scanned = 0;

  for (const conn of connections) {
    // ignoruojam praeitį
    if (conn.dep < departureTime) continue;

    // stabdom jei per toli į ateitį
    if (conn.dep > departureTime + MAX_LOOKAHEAD) break;

    scanned++;
    if (scanned > MAX_SCANS) {
      console.warn("⚠️ CSA scan limit reached");
      break;
    }

    const arrivalAtFrom = earliest[conn.from];
    if (arrivalAtFrom === undefined) continue;

    if (arrivalAtFrom > conn.dep) continue;

    const bestKnownArrival = earliest[conn.to];

    if (bestKnownArrival === undefined || conn.arr < bestKnownArrival) {
      earliest[conn.to] = conn.arr;
      previousConnection[conn.to] = conn;
    }
  }

  // =======================
  // FIND BEST DESTINATION
  // =======================

  let bestStop = null;
  let bestTime = Infinity;

  for (const stopId of destinationSet) {
    const arr = earliest[stopId];

    if (arr !== undefined && arr < bestTime) {
      bestTime = arr;
      bestStop = stopId;
    }
  }

  if (!bestStop) {
    return null;
  }

  // =======================
  // RECONSTRUCT PATH
  // =======================

  const path = [];
  let currentStop = bestStop;

  while (previousConnection[currentStop]) {
    const conn = previousConnection[currentStop];
    path.unshift(conn);
    currentStop = conn.from;
  }

  return {
    arrivalTime: bestTime,
    segments: path,
  };
}

// =======================

module.exports = {
  csaRoute,
};