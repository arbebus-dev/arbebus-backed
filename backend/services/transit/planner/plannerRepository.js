const { query } = require('../../../db/pool');

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

  const result = await query(sql, [point.longitude, point.latitude, radiusMeters, limit]);
  return result.rows;
}

async function getDirectJourneys({ originStopIds, destinationStopIds, serviceDate, limit = 6 }) {
  if (!originStopIds.length || !destinationStopIds.length) return [];

  const sql = `
    SELECT
      os.trip_id,
      t.route_id,
      r.route_short_name,
      r.route_long_name,
      r.route_type,
      t.trip_headsign,
      t.direction_id,
      t.shape_id,
      os.stop_id AS origin_stop_id,
      ds.stop_id AS destination_stop_id,
      os.stop_sequence AS origin_sequence,
      ds.stop_sequence AS destination_sequence,
      os.departure_seconds AS origin_departure_seconds,
      ds.arrival_seconds AS destination_arrival_seconds,
      (ds.stop_sequence - os.stop_sequence) AS stop_count
    FROM transit.stop_times os
    JOIN transit.stop_times ds
      ON ds.trip_id = os.trip_id
     AND ds.stop_sequence > os.stop_sequence
    JOIN transit.trips t
      ON t.trip_id = os.trip_id
    JOIN transit.routes r
      ON r.route_id = t.route_id
    JOIN transit.service_days sdv
      ON sdv.service_id = t.service_id
     AND sdv.service_date = $3::date
    WHERE os.stop_id = ANY($1::text[])
      AND ds.stop_id = ANY($2::text[])
    ORDER BY
      CASE WHEN COALESCE(r.route_type, 3) = 2 THEN 0 ELSE 1 END,
      stop_count ASC,
      origin_departure_seconds ASC NULLS LAST
    LIMIT $4
  `;

  const result = await query(sql, [originStopIds, destinationStopIds, serviceDate, limit]);
  return result.rows;
}

async function getTransferJourneys({ originStopIds, destinationStopIds, serviceDate, limit = 6, maxTransferWaitSeconds = 5400 }) {
  if (!originStopIds.length || !destinationStopIds.length) return [];

  const sql = `
    WITH first_leg AS (
      SELECT
        t1.trip_id,
        t1.route_id,
        t1.trip_headsign,
        t1.direction_id,
        t1.shape_id,
        r1.route_short_name,
        r1.route_long_name,
        r1.route_type,
        os.stop_id AS origin_stop_id,
        xfer.stop_id AS transfer_stop_id,
        os.stop_sequence AS origin_sequence,
        xfer.stop_sequence AS transfer_sequence,
        os.departure_seconds AS origin_departure_seconds,
        xfer.arrival_seconds AS transfer_arrival_seconds,
        (xfer.stop_sequence - os.stop_sequence) AS stop_count_to_transfer
      FROM transit.stop_times os
      JOIN transit.stop_times xfer
        ON xfer.trip_id = os.trip_id
       AND xfer.stop_sequence > os.stop_sequence
      JOIN transit.trips t1
        ON t1.trip_id = os.trip_id
      JOIN transit.routes r1
        ON r1.route_id = t1.route_id
      JOIN transit.service_days sd1
        ON sd1.service_id = t1.service_id
       AND sd1.service_date = $3::date
      WHERE os.stop_id = ANY($1::text[])
    ),
    second_leg AS (
      SELECT
        t2.trip_id,
        t2.route_id,
        t2.trip_headsign,
        t2.direction_id,
        t2.shape_id,
        r2.route_short_name,
        r2.route_long_name,
        r2.route_type,
        xfer.stop_id AS transfer_stop_id,
        ds.stop_id AS destination_stop_id,
        xfer.stop_sequence AS transfer_sequence,
        ds.stop_sequence AS destination_sequence,
        xfer.departure_seconds AS transfer_departure_seconds,
        ds.arrival_seconds AS destination_arrival_seconds,
        (ds.stop_sequence - xfer.stop_sequence) AS stop_count_from_transfer
      FROM transit.stop_times xfer
      JOIN transit.stop_times ds
        ON ds.trip_id = xfer.trip_id
       AND ds.stop_sequence > xfer.stop_sequence
      JOIN transit.trips t2
        ON t2.trip_id = xfer.trip_id
      JOIN transit.routes r2
        ON r2.route_id = t2.route_id
      JOIN transit.service_days sd2
        ON sd2.service_id = t2.service_id
       AND sd2.service_date = $3::date
      WHERE ds.stop_id = ANY($2::text[])
    )
    SELECT
      f.trip_id AS first_trip_id,
      f.route_id AS first_route_id,
      f.route_short_name AS first_route_short_name,
      f.route_long_name AS first_route_long_name,
      f.route_type AS first_route_type,
      f.trip_headsign AS first_headsign,
      f.direction_id AS first_direction_id,
      f.shape_id AS first_shape_id,
      f.origin_stop_id,
      f.transfer_stop_id,
      s.transfer_departure_seconds,
      f.transfer_arrival_seconds,
      f.origin_departure_seconds,
      f.stop_count_to_transfer,
      s.trip_id AS second_trip_id,
      s.route_id AS second_route_id,
      s.route_short_name AS second_route_short_name,
      s.route_long_name AS second_route_long_name,
      s.route_type AS second_route_type,
      s.trip_headsign AS second_headsign,
      s.direction_id AS second_direction_id,
      s.shape_id AS second_shape_id,
      s.destination_stop_id,
      s.destination_arrival_seconds,
      s.stop_count_from_transfer,
      (f.stop_count_to_transfer + s.stop_count_from_transfer) AS total_stop_count,
      s_origin.stop_name AS origin_stop_name,
      s_origin.stop_lat AS origin_stop_lat,
      s_origin.stop_lon AS origin_stop_lon,
      s_transfer.stop_name AS transfer_stop_name,
      s_transfer.stop_lat AS transfer_stop_lat,
      s_transfer.stop_lon AS transfer_stop_lon,
      s_dest.stop_name AS destination_stop_name,
      s_dest.stop_lat AS destination_stop_lat,
      s_dest.stop_lon AS destination_stop_lon
    FROM first_leg f
    JOIN second_leg s
      ON s.transfer_stop_id = f.transfer_stop_id
     AND s.route_id <> f.route_id
     AND s.transfer_departure_seconds >= f.transfer_arrival_seconds
     AND s.transfer_departure_seconds <= f.transfer_arrival_seconds + $5
    JOIN transit.stops s_origin ON s_origin.stop_id = f.origin_stop_id
    JOIN transit.stops s_transfer ON s_transfer.stop_id = f.transfer_stop_id
    JOIN transit.stops s_dest ON s_dest.stop_id = s.destination_stop_id
    ORDER BY
      CASE WHEN COALESCE(f.route_type, 3) = 2 OR COALESCE(s.route_type, 3) = 2 THEN 0 ELSE 1 END,
      total_stop_count ASC,
      f.origin_departure_seconds ASC NULLS LAST
    LIMIT $4
  `;

  const result = await query(sql, [originStopIds, destinationStopIds, serviceDate, limit, maxTransferWaitSeconds]);
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

  const result = await query(sql, [shapeId]);
  return result.rows;
}

module.exports = {
  getNearbyStops,
  getDirectJourneys,
  getTransferJourneys,
  getShapePoints,
};
