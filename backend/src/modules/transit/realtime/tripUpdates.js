/* eslint-env node */
const { fetchFeed, feedTimestampSeconds } = require("./gtfsRT.client");

const DEFAULT_URL = "https://www.stops.lt/klaipeda/trip_updates.pb";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanRouteNumber(value) {
  return String(value ?? "").trim().replace(/^0+/, "").toUpperCase();
}

function stopTimeUpdateToPublic(update) {
  const arrivalDelay = toNumber(update?.arrival?.delay);
  const departureDelay = toNumber(update?.departure?.delay);

  return {
    stopId: update?.stopId || update?.stop_id || null,
    stopSequence: update?.stopSequence ?? update?.stop_sequence ?? null,
    arrival: update?.arrival
      ? {
          delay: Number.isFinite(arrivalDelay) ? arrivalDelay : null,
          time: update.arrival.time ? Number(update.arrival.time) : null,
        }
      : null,
    departure: update?.departure
      ? {
          delay: Number.isFinite(departureDelay) ? departureDelay : null,
          time: update.departure.time ? Number(update.departure.time) : null,
        }
      : null,
  };
}

async function getTripUpdates() {
  const url =
    process.env.GTFS_RT_TRIP_UPDATES_URL ||
    process.env.KKT_GTFS_RT_TRIP_UPDATES_URL ||
    DEFAULT_URL;

  const feed = await fetchFeed(url);
  const feedTs = feedTimestampSeconds(feed);

  const updates = feed.entities
    .map((entity) => {
      const update = entity.tripUpdate || entity.trip_update;
      if (!update?.trip) return null;

      const trip = update.trip;

      return {
        id: entity.id || trip.tripId || trip.trip_id || null,
        tripId: trip.tripId || trip.trip_id || null,
        routeId: cleanRouteNumber(trip.routeId || trip.route_id || ""),
        directionId: trip.directionId ?? trip.direction_id ?? null,
        startTime: trip.startTime || trip.start_time || null,
        startDate: trip.startDate || trip.start_date || null,
        vehicleId: update.vehicle?.id || update.vehicle?.label || null,
        timestamp: Number(update.timestamp || feedTs),
        delaySeconds: toNumber(update.delay),
        stopTimeUpdates: Array.isArray(update.stopTimeUpdate || update.stop_time_update)
          ? (update.stopTimeUpdate || update.stop_time_update).map(stopTimeUpdateToPublic)
          : [],
      };
    })
    .filter(Boolean);

  return {
    ok: true,
    source: "gtfs-rt",
    url,
    count: updates.length,
    updates,
    tripUpdates: updates,
    fetchedAt: feed.fetchedAt,
    feedTimestamp: feedTs,
    meta: {
      byteLength: feed.byteLength,
      entityCount: feed.entities.length,
    },
  };
}

module.exports = { getTripUpdates };
