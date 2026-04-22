const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { fetchLiveVehicles } = require('./services/transit/klaipedaGateway');
const { getPool } = require('./db/pool');
const { handleTransitPlan } = require('./services/transit/planner/plannerController');
const { buildNewsFeed } = require('./services/newsService');
const {
  startLeaveAlertEngine,
  registerExpoPushToken,
  createOrReplaceLeaveAlert,
  cancelLeaveAlert,
  listActiveLeaveAlerts,
} = require('./services/leaveAlertEngine');

const app = express();

if (env.ENABLE_CORS) {
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    })
  );
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
      pool.query(`
        SELECT COALESCE(route_type, -1)::text AS route_type, COUNT(*)::int AS count
        FROM transit.routes
        GROUP BY COALESCE(route_type, -1)
        ORDER BY route_type
      `),
      pool.query(`
        SELECT source_url, created_at
        FROM transit.import_runs
        ORDER BY created_at DESC
        LIMIT 1
      `),
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
      leaveAlerts: {
        active: listActiveLeaveAlerts().length,
      },
      warnings: hasRail
        ? []
        : ['GTFS feed currently has no route_type=2 (train) routes in database'],
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
    res.json(vehicles);
  } catch (error) {
    res.status(500).json([]);
  }
});

app.post('/transit/plan', handleTransitPlan);

app.get('/news', async (_req, res) => {
  try {
    const payload = await buildNewsFeed();
    res.json(payload);
  } catch (error) {
    console.error('GET /news error:', error.message);
    res.status(500).json({
      ok: false,
      generatedAt: new Date().toISOString(),
      meta: {
        partial: true,
        sections: {
          world: 'error',
          transport: 'fallback',
          deal: 'fallback',
          update: 'fallback',
        },
        errors: [{ section: 'news', message: error.message }],
      },
      items: [],
    });
  }
});

app.post('/push/register', async (req, res) => {
  try {
    const { deviceId, expoPushToken, platform } = req.body || {};

    if (!deviceId || !expoPushToken) {
      return res.status(400).json({
        ok: false,
        error: 'deviceId and expoPushToken are required',
      });
    }

    const tokenRecord = await registerExpoPushToken({
      deviceId,
      expoPushToken,
      platform: platform || 'unknown',
    });

    res.json({ ok: true, token: tokenRecord });
  } catch (error) {
    console.error('POST /push/register error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/leave-alerts', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await createOrReplaceLeaveAlert(payload);
    res.json({ ok: true, alert: result });
  } catch (error) {
    console.error('POST /leave-alerts error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete('/leave-alerts/:alertId', async (req, res) => {
  try {
    const removed = await cancelLeaveAlert(req.params.alertId);
    res.json({ ok: true, removed });
  } catch (error) {
    console.error('DELETE /leave-alerts/:alertId error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/leave-alerts', (_req, res) => {
  res.json({ ok: true, items: listActiveLeaveAlerts() });
});

startLeaveAlertEngine();

app.listen(env.PORT, env.HOST, () => {
  console.log(`🚀 Running on http://${env.HOST}:${env.PORT}`);
});
