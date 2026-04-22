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
      stop_id: s.stop_id,
      stop_name: s.stop_name,
      stop_lat: Number(s.stop_lat),
      stop_lon: Number(s.stop_lon),
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
  if (!segments || !segments.length) return [];

  const rides = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.trip_id === current.trip_id) {
      current.to = seg.to;
      current.arr = seg.arr;
      current.to_sequence = seg.to_sequence;
    } else {
      rides.push(current);
      current = { ...seg };
    }
  }

  rides.push(current);
  return rides;
}

// =======================
// LOOKUP STOP NAMES
// =======================

async function getStopNames(stopIds) {
  if (!stopIds.length) return {};

  const pool = getPool();
  const uniqueStopIds = [...new Set(stopIds)];

  const { rows } = await pool.query(
    `
      SELECT stop_id, stop_name
      FROM transit.stops
      WHERE stop_id = ANY($1)
    `,
    [uniqueStopIds]
  );

  return rows.reduce((acc, row) => {
    acc[row.stop_id] = row.stop_name;
    return acc;
  }, {});
}

// =======================
// LOOKUP ROUTE LABELS BY TRIP
// =======================

async function getTripRouteLabels(tripIds) {
  if (!tripIds.length) return {};

  const pool = getPool();
  const uniqueTripIds = [...new Set(tripIds)];

  const { rows } = await pool.query(
    `
      SELECT
        t.trip_id,
        r.route_short_name,
        r.route_long_name,
        r.route_type
      FROM transit.trips t
      JOIN transit.routes r ON r.route_id = t.route_id
      WHERE t.trip_id = ANY($1)
    `,
    [uniqueTripIds]
  );

  return rows.reduce((acc, row) => {
    acc[row.trip_id] = {
      routeLabel: row.route_short_name || row.route_long_name || row.trip_id,
      routeType: row.route_type,
      routeLongName: row.route_long_name || null,
    };
    return acc;
  }, {});
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
      meta: {
        originStopsChecked: originStops.length,
        destinationStopsChecked: destStops.length,
      },
    };
  }

  const rides = groupSegments(result.segments);

  const stopIds = [
    ...rides.flatMap((r) => [r.from, r.to]),
    originStops[0]?.stop_id,
    destStops[0]?.stop_id,
  ].filter(Boolean);

  const tripIds = rides.map((r) => r.trip_id).filter(Boolean);

  const stopNames = await getStopNames(stopIds);
  const tripRouteLabels = await getTripRouteLabels(tripIds);

  const steps = [];

  // WALK TO FIRST STOP
  steps.push({
    type: "walk",
    from: "Your location",
    to: originStops[0].stop_name,
    distance: Math.round(originStops[0].distance),
  });

  // RIDES + TRANSFERS
  rides.forEach((ride, index) => {
    const tripMeta = tripRouteLabels[ride.trip_id] || {};
    const fromStopName = stopNames[ride.from] || ride.from;
    const toStopName = stopNames[ride.to] || ride.to;

    steps.push({
      type: "ride",
      tripId: ride.trip_id,
      routeLabel: tripMeta.routeLabel || ride.trip_id,
      routeType: tripMeta.routeType ?? 3,
      fromStopId: ride.from,
      toStopId: ride.to,
      fromStopName,
      toStopName,
      departure: ride.dep,
      arrival: ride.arr,
    });

    const nextRide = rides[index + 1];
    if (nextRide) {
      const transferFromName = stopNames[ride.to] || ride.to;
      const transferToName = stopNames[nextRide.from] || nextRide.from;

      if (ride.to !== nextRide.from) {
        steps.push({
          type: "walk",
          from: transferFromName,
          to: transferToName,
          distance: 100,
        });
      }
    }
  });

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
      firstBoardStop: originStops[0]?.stop_name || null,
      finalAlightStop: destStops[0]?.stop_name || null,
    },
  };
}

// =======================

module.exports = {
  planRoute,
};