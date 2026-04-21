const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { handleTransitPlan } = require('./services/transit/planner/plannerController');
const { fetchLiveVehicles } = require('./services/transit/klaipedaGateway');
const { getPool } = require('./db/pool');

const app = express();

if (env.ENABLE_CORS) {
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN }));
}

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.send('Arbebus backend is running 🚀');
});

app.get('/health', async (_req, res) => {
  const now = new Date().toISOString();
  try {
    const pool = getPool();
    const [routesRes, tripsRes, stopsRes, routeTypesRes, importRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM transit.routes'),
      pool.query('SELECT COUNT(*)::int AS count FROM transit.trips'),
      pool.query('SELECT COUNT(*)::int AS count FROM transit.stops'),
      pool.query(`SELECT COALESCE(route_type, -1)::text AS route_type, COUNT(*)::int AS count FROM transit.routes GROUP BY COALESCE(route_type, -1) ORDER BY route_type`),
      pool.query(`SELECT source_url, created_at FROM transit.import_runs ORDER BY created_at DESC LIMIT 1`),
    ]);

    const routeTypeCounts = routeTypesRes.rows.reduce((acc, row) => {
      acc[row.route_type] = Number(row.count || 0);
      return acc;
    }, {});

    const sourceUrl = importRes.rows[0]?.source_url || env.GTFS_SOURCE_URL || null;
    const hasRail = Object.prototype.hasOwnProperty.call(routeTypeCounts, '2');

    res.json({
      ok: true,
      service: 'arbebus-backend',
      mode: 'db_transit_planner',
      now,
      dbOk: true,
      gtfs: {
        feedCode: env.GTFS_FEED_CODE,
        feedRegion: env.GTFS_FEED_REGION,
        source: sourceUrl,
        sources: env.GTFS_SOURCE_URLS,
        importedAt: importRes.rows[0]?.created_at || null,
        hasRail,
        stopsCount: Number(stopsRes.rows[0]?.count || 0),
        routesCount: Number(routesRes.rows[0]?.count || 0),
        tripsCount: Number(tripsRes.rows[0]?.count || 0),
        routeTypeCounts,
      },
      warnings: hasRail ? [] : ['GTFS feed currently has no route_type=2 (train) routes in database'],
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      service: 'arbebus-backend',
      mode: 'db_transit_planner',
      now,
      dbOk: false,
      error: error.message || 'Health check failed',
    });
  }
});

app.get('/live-buses', async (_req, res) => {
  try {
    const vehicles = await fetchLiveVehicles();
    res.json({ ok: true, vehicles, count: vehicles.length });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Failed to fetch live vehicles', vehicles: [] });
  }
});

app.post('/transit/plan', handleTransitPlan);

app.listen(env.PORT, env.HOST, () => {
  console.log(`Arbebus backend running on http://${env.HOST}:${env.PORT}`);
});
