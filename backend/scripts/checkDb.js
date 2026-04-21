require('dotenv').config();
const { getPool } = require('../db/pool');

async function main() {
  const pool = getPool();

  const checks = {
    postgis: await pool.query('SELECT version() AS version'),
    stops: await pool.query('SELECT COUNT(*)::int AS count FROM transit.stops'),
    routes: await pool.query('SELECT COUNT(*)::int AS count FROM transit.routes'),
    trips: await pool.query('SELECT COUNT(*)::int AS count FROM transit.trips'),
    stopTimes: await pool.query('SELECT COUNT(*)::int AS count FROM transit.stop_times'),
  };

  console.log(JSON.stringify({
    ok: true,
    postgisVersion: checks.postgis.rows[0]?.version || null,
    stops: checks.stops.rows[0]?.count || 0,
    routes: checks.routes.rows[0]?.count || 0,
    trips: checks.trips.rows[0]?.count || 0,
    stopTimes: checks.stopTimes.rows[0]?.count || 0,
  }, null, 2));

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
