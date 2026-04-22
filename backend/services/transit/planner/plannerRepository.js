const { getPool } = require('../../../db/pool');

function dbQuery(sql, params = []) {
  const pool = getPool();
  return pool.query(sql, params);
}

async function getNearbyStops(point, radiusMeters, limit = 8) {
  const sql = `
    SELECT
      stop_id AS id,
      stop_name AS name,
      stop_lat AS latitude,
      stop_lon AS longitude,
      ST_DistanceSphere(
        geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
      ) AS distance_meters
    FROM transit.stops
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )
    ORDER BY distance_meters ASC
    LIMIT $4
  `;

  const result = await dbQuery(sql, [
    point.longitude,
    point.latitude,
    radiusMeters,
    limit,
  ]);

  return result.rows;
}

async function getWalkingTransfers(stopIds, radiusMeters = 350, limitPerStop = 24) {
  if (!Array.isArray(stopIds) || !stopIds.length) return [];

  const sql = `
    WITH origins AS (
      SELECT DISTINCT unnest($1::text[]) AS stop_id
    ),
    ranked AS (
      SELECT
        s1.stop_id AS from_stop_id,
        s1.stop_name AS from_stop_name,
        s1.stop_lat AS from_stop_lat,
        s1.stop_lon AS from_stop_lon,
        s2.stop_id AS to_stop_id,
        s2.stop_name AS to_stop_name,
        s2.stop_lat AS to_stop_lat,
        s2.stop_lon AS to_stop_lon,
        ST_DistanceSphere(s1.geom, s2.geom) AS walk_meters,
        ROW_NUMBER() OVER (
          PARTITION BY s1.stop_id
          ORDER BY ST_DistanceSphere(s1.geom, s2.geom) ASC, s2.stop_id ASC
        ) AS rn
      FROM origins o
      JOIN transit.stops s1 ON s1.stop_id = o.stop_id
      JOIN transit.stops s2
        ON s2.stop_id <> s1.stop_id
       AND ST_DWithin(s1.geom::geography, s2.geom::geography, $2)
    )
    SELECT *
    FROM ranked
    WHERE rn <= $3
    ORDER BY from_stop_id ASC, walk_meters ASC
  `;

  const result = await dbQuery(sql, [stopIds, radiusMeters, limitPerStop]);
  return result.rows;
}

async function getCandidateBoardings(frontierEntries, serviceDate, perStopLimit = 10, horizonSeconds = 21600) {
  if (!Array.isArray(frontierEntries) || !frontierEntries.length) return [];

  const values = [];
  const params = [serviceDate, perStopLimit, horizonSeconds];
  let paramIndex = params.length;

  for (const entry of frontierEntries) {
    paramIndex += 1;
    const stopParam = `$${paramIndex}`;
    params.push(entry.stopId);

    paramIndex += 1;
    const timeParam = `$${paramIndex}`;
    params.push(Math.max(0, Math.floor(Number(entry.earliestArrivalSeconds || 0))));

    values.push(`(${stopParam}::text, ${timeParam}::int)`);
  }

  const sql = `
    WITH frontier(stop_id, earliest_arrival_seconds) AS (
      VALUES ${values.join(', ')}
    ),
    ranked AS (
      SELECT
        f.stop_id AS board_stop_id,
        f.earliest_arrival_seconds,
        st.trip_id,
        st.stop_sequence AS board_sequence,
        st.departure_seconds AS board_departure_seconds,
        st.arrival_seconds AS board_arrival_seconds,
        tr.route_id,
        tr.trip_headsign,
        tr.direction_id,
        tr.shape_id,
        tr.service_id,
        r.route_short_name,
        r.route_long_name,
        r.route_type,
        ROW_NUMBER() OVER (
          PARTITION BY f.stop_id
          ORDER BY st.departure_seconds ASC, st.trip_id ASC
        ) AS rn
      FROM frontier f
      JOIN transit.stop_times st
        ON st.stop_id = f.stop_id
       AND st.departure_seconds IS NOT NULL
       AND st.departure_seconds >= f.earliest_arrival_seconds
       AND st.departure_seconds <= f.earliest_arrival_seconds + $3
      JOIN transit.trips tr ON tr.trip_id = st.trip_id
      JOIN transit.routes r ON r.route_id = tr.route_id
      JOIN transit.service_days sd
        ON sd.service_id = tr.service_id
       AND sd.service_date = $1::date
    )
    SELECT *
    FROM ranked
    WHERE rn <= $2
    ORDER BY board_departure_seconds ASC, route_type ASC NULLS LAST
  `;

  const result = await dbQuery(sql, params);
  return result.rows;
}

async function getTripStopSequences(tripIds, minBoardSequenceByTrip = {}) {
  if (!Array.isArray(tripIds) || !tripIds.length) return [];

  const boardTripIds = Object.keys(minBoardSequenceByTrip || {});
  let sequenceFilter = '';
  let params = [tripIds];

  if (boardTripIds.length) {
    const tripSeqValues = [];
    params = [tripIds];
    let idx = 1;

    for (const tripId of boardTripIds) {
      idx += 1;
      const tripParam = `$${idx}`;
      params.push(tripId);

      idx += 1;
      const seqParam = `$${idx}`;
      params.push(Math.max(0, Number(minBoardSequenceByTrip[tripId] || 0)));

      tripSeqValues.push(`(${tripParam}::text, ${seqParam}::int)`);
    }

    sequenceFilter = `
      JOIN (VALUES ${tripSeqValues.join(', ')}) AS mins(trip_id, min_board_sequence)
        ON mins.trip_id = st.trip_id
       AND st.stop_sequence >= mins.min_board_sequence
    `;
  }

  const sql = `
    SELECT
      st.trip_id,
      st.stop_id,
      st.stop_sequence,
      st.arrival_seconds,
      st.departure_seconds,
      s.stop_name,
      s.stop_lat,
      s.stop_lon,
      tr.route_id,
      tr.trip_headsign,
      tr.direction_id,
      tr.shape_id,
      r.route_short_name,
      r.route_long_name,
      r.route_type
    FROM transit.stop_times st
    ${sequenceFilter}
    JOIN transit.stops s ON s.stop_id = st.stop_id
    JOIN transit.trips tr ON tr.trip_id = st.trip_id
    JOIN transit.routes r ON r.route_id = tr.route_id
    WHERE st.trip_id = ANY($1::text[])
    ORDER BY st.trip_id ASC, st.stop_sequence ASC
  `;

  const result = await dbQuery(sql, params);
  return result.rows;
}

async function getShapePoints(shapeId) {
  if (!shapeId) return [];

  const sql = `
    SELECT
      shape_pt_lat AS latitude,
      shape_pt_lon AS longitude,
      shape_pt_sequence AS sequence
    FROM transit.shape_points
    WHERE shape_id = $1
    ORDER BY shape_pt_sequence ASC
  `;

  const result = await dbQuery(sql, [shapeId]);
  return result.rows;
}

module.exports = {
  getNearbyStops,
  getWalkingTransfers,
  getCandidateBoardings,
  getTripStopSequences,
  getShapePoints,
};