const { getPool } = require("../db/pool");
const { csaRoute } = require("./csaEngine");

const MAX_WALK = Number(process.env.MAX_WALKING_METERS || 500);

// =======================
// UTILS
// =======================

function haversine(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) *
      Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function secondsNow() {
  const now = new Date();
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
}

// =======================
// STOPS
// =======================

async function nearestStops(lat, lon) {
  const pool = getPool();

  const { rows } = await pool.query(`
    SELECT stop_id, stop_name, stop_lat, stop_lon
    FROM transit.stops
  `);

  return rows
    .map((s) => ({
      ...s,
      distance: haversine(
        { lat, lon },
        { lat: Number(s.stop_lat), lon: Number(s.stop_lon) }
      ),
    }))
    .filter((s) => s.distance <= MAX_WALK)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
}

// =======================
// GROUP SEGMENTS INTO RIDES
// =======================

function groupSegments(segments) {
  if (!segments.length) return [];

  const rides = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.trip_id === current.trip_id) {
      current.to = seg.to;
      current.arr = seg.arr;
    } else {
      rides.push(current);
      current = { ...seg };
    }
  }

  rides.push(current);
  return rides;
}

// =======================
// MAIN ROUTE
// =======================

async function planRoute(origin, destination) {
  const originStops = await nearestStops(origin.lat, origin.lon);
  const destStops = await nearestStops(destination.lat, destination.lon);

  if (!originStops.length || !destStops.length) {
    return {
      ok: false,
      reason: "NO_NEARBY_STOPS",
      steps: [
        {
          type: "walk",
          text: "No nearby stops found",
        },
      ],
    };
  }

  const result = await csaRoute(
    originStops.map((s) => s.stop_id),
    destStops.map((s) => s.stop_id),
    secondsNow()
  );

  // ❗ ČIA buvo tavo bugas
  if (!result || !result.segments || result.segments.length === 0) {
    return {
      ok: false,
      reason: "NO_ROUTE",
      steps: [
        {
          type: "walk",
          text: "No transit route found",
        },
      ],
    };
  }

  const rides = groupSegments(result.segments);

  const steps = [];

  // WALK TO FIRST STOP
  steps.push({
    type: "walk",
    from: "Your location",
    to: originStops[0].stop_name,
    distance: Math.round(originStops[0].distance),
  });

  // RIDES
  for (const ride of rides) {
    steps.push({
      type: "ride",
      tripId: ride.trip_id,
      fromStopId: ride.from,
      toStopId: ride.to,
      departure: ride.dep,
      arrival: ride.arr,
    });
  }

  // WALK TO DESTINATION
  steps.push({
    type: "walk",
    from: destStops[0].stop_name,
    to: "Destination",
    distance: Math.round(destStops[0].distance),
  });

  return {
    ok: true,
    steps,
    meta: {
      originStops: originStops.length,
      destStops: destStops.length,
      rides: rides.length,
      arrivalTime: result.arrivalTime,
    },
  };
}

// =======================

module.exports = {
  planRoute,
};