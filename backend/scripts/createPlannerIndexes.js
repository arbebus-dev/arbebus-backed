const { getPool } = require("../db/pool");

async function main() {
  const pool = getPool();

  console.log("Creating planner indexes...");

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_stop_times_stop_departure
    ON transit.stop_times (stop_id, departure_seconds);

    CREATE INDEX IF NOT EXISTS idx_stop_times_trip_sequence
    ON transit.stop_times (trip_id, stop_sequence);

    CREATE INDEX IF NOT EXISTS idx_trips_trip_id
    ON transit.trips (trip_id);

    CREATE INDEX IF NOT EXISTS idx_trips_service_id
    ON transit.trips (service_id);

    CREATE INDEX IF NOT EXISTS idx_routes_route_id
    ON transit.routes (route_id);

    CREATE INDEX IF NOT EXISTS idx_service_days_service_date
    ON transit.service_days (service_id, service_date);

    CREATE INDEX IF NOT EXISTS idx_shape_points_shape_sequence
    ON transit.shape_points (shape_id, shape_pt_sequence);

    CREATE INDEX IF NOT EXISTS idx_stops_stop_id
    ON transit.stops (stop_id);

    CREATE INDEX IF NOT EXISTS idx_stops_geom_gist
    ON transit.stops USING GIST (geom);
  `);

  console.log("Planner indexes created successfully ✅");
  await pool.end();
}

main().catch((error) => {
  console.error("Planner indexes failed ❌", error);
  process.exit(1);
});