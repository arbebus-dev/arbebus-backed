const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { initializeMonitoring, performanceMiddleware, errorMiddleware, monitorApiCall } = require('./monitoring');

// Initialize monitoring
initializeMonitoring();

const { fetchLiveVehicles } = require('./services/transit/klaipedaGateway');
const { pickBestVehicleForStop } = require('./services/transit/etaEstimator');
const { getPool } = require('./db/pool');
const { handleTransitPlan } = require('./services/transit/planner/plannerController');
const { getShapePoints } = require('./services/transit/planner/plannerRepository');
const { buildNewsFeed } = require('./services/newsService');
const { searchPlaces } = require('./places/placesSearchService');
const {
  startLeaveAlertEngine,
  registerExpoPushToken,
  createOrReplaceLeaveAlert,
  cancelLeaveAlert,
  listActiveLeaveAlerts,
} = require('./services/leaveAlertEngine');

const app = express();

// Add monitoring middleware
app.use(performanceMiddleware);

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
      leaveAlerts: { active: listActiveLeaveAlerts().length },
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
    res.json(vehicles);
  } catch {
    res.status(500).json([]);
  }
});

app.get('/transit/live-eta', async (req, res) => {
  try {
    const routeId = String(req.query.routeId || req.query.route || '').trim();

    const stop = {
      id: req.query.stopId ? String(req.query.stopId) : null,
      name: req.query.stopName ? String(req.query.stopName) : 'Įlipimo stotelė',
      latitude: Number(req.query.stopLat ?? req.query.latitude),
      longitude: Number(req.query.stopLon ?? req.query.longitude),
    };

    const destinationStop = {
      id: req.query.destinationStopId ? String(req.query.destinationStopId) : null,
      name: req.query.destinationStopName ? String(req.query.destinationStopName) : '',
      latitude: Number(req.query.destinationStopLat),
      longitude: Number(req.query.destinationStopLon),
    };

    const headsign = req.query.headsign ? String(req.query.headsign) : null;

    if (!routeId || !Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude)) {
      return res.status(400).json({
        ok: false,
        routeId,
        eta: null,
        error: 'routeId, stopLat and stopLon are required',
      });
    }

    const vehicles = await fetchLiveVehicles();

    const best = pickBestVehicleForStop({
      vehicles,
      routeId,
      stop,
      destinationStop:
        Number.isFinite(destinationStop.latitude) && Number.isFinite(destinationStop.longitude)
          ? destinationStop
          : null,
      headsign,
      limit: 3,
    });

    if (!best) {
      return res.json({
        ok: true,
        routeId,
        stop,
        eta: null,
        boardingState: 'unknown',
        message: 'Šiuo metu nerasta live autobuso šiam maršrutui.',
        vehiclesChecked: vehicles.length,
      });
    }

    const etaMinutes = Math.max(1, Math.round(best.etaSeconds / 60));

    res.json({
      ok: true,
      routeId,
      stop,
      eta: {
        etaSeconds: best.etaSeconds,
        etaMinutes,
        distanceMeters: best.candidates?.[0]?.distanceMeters ?? null,
      },
      boardingState:
        best.etaSeconds <= 3 * 60
          ? 'boarding_soon'
          : best.etaSeconds <= 10 * 60
            ? 'on_the_way'
            : 'later',
      vehicle: {
        id: best.vehicle.id,
        vehicleId: best.vehicle.vehicleId,
        vehicleLabel: best.vehicle.vehicleLabel,
        routeId: best.vehicle.routeId,
        route: best.vehicle.route,
        latitude: best.vehicle.latitude,
        longitude: best.vehicle.longitude,
        heading: best.vehicle.heading,
        speedKph: best.vehicle.speedKph,
        directionName: best.vehicle.directionName,
        delaySeconds: best.vehicle.delaySeconds,
        fetchedAt: best.vehicle.fetchedAt || best.vehicle.fetchedAtIso,
      },
      candidates: best.candidates || [],
      vehiclesChecked: vehicles.length,
    });
  } catch (error) {
    console.error('GET /transit/live-eta error:', error.message);
    res.status(500).json({
      ok: false,
      eta: null,
      error: error.message || 'Live ETA failed',
    });
  }
});

app.get('/places/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 30);

  if (q.length < 2) return res.json({ ok: true, items: [], results: [], places: [] });

  try {
    const items = await searchPlaces({ q, lat, lon, limit });
    res.json({ ok: true, items, results: items, places: items });
  } catch (error) {
    console.error('GET /places/search error:', error.message);
    res.status(500).json({ ok: false, items: [], results: [], places: [], error: error.message });
  }
});

app.get('/stops/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 30);

  if (q.length < 2) return res.json({ ok: true, items: [] });

  try {
    const pool = getPool();
    const hasPoint = Number.isFinite(lat) && Number.isFinite(lon);
    const params = hasPoint ? [q, lon, lat, limit] : [q, limit];

    const sql = hasPoint
      ? `
        SELECT stop_id AS id, stop_name AS name, stop_lat AS latitude, stop_lon AS longitude,
          ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($2, $3), 4326)) AS distance_meters
        FROM transit.stops
        WHERE stop_name ILIKE '%' || $1 || '%' OR stop_code ILIKE '%' || $1 || '%' OR stop_id ILIKE '%' || $1 || '%'
        ORDER BY distance_meters ASC, stop_name ASC
        LIMIT $4
      `
      : `
        SELECT stop_id AS id, stop_name AS name, stop_lat AS latitude, stop_lon AS longitude, 0 AS distance_meters
        FROM transit.stops
        WHERE stop_name ILIKE '%' || $1 || '%' OR stop_code ILIKE '%' || $1 || '%' OR stop_id ILIKE '%' || $1 || '%'
        ORDER BY stop_name ASC
        LIMIT $2
      `;

    const result = await pool.query(sql, params);

    res.json({
      ok: true,
      items: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        distanceMeters: Number(row.distance_meters || 0),
      })),
    });
  } catch (error) {
    console.error('GET /stops/search error:', error.message);
    res.status(500).json({ ok: false, items: [], error: error.message });
  }
});

app.post('/transit/plan', monitorApiCall('transit.plan'), handleTransitPlan);

app.get('/transit/shape/:shapeId', async (req, res) => {
  const shapeId = String(req.params.shapeId || '').trim();

  if (!shapeId) {
    return res.status(400).json({ ok: false, shapeId, points: [], error: 'shapeId is required' });
  }

  try {
    const rows = await getShapePoints(shapeId);
    const points = rows
      .map((row) => ({
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      }))
      .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

    res.json({ ok: true, shapeId, points });
  } catch (error) {
    console.error('GET /transit/shape/:shapeId error:', error.message);
    res.status(500).json({ ok: false, shapeId, points: [], error: error.message });
  }
});

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
        sections: { world: 'error', transport: 'fallback', deal: 'fallback', update: 'fallback' },
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
      return res.status(400).json({ ok: false, error: 'deviceId and expoPushToken are required' });
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

// Add error handling middleware (must be last)
app.use(errorMiddleware);

app.listen(env.PORT, env.HOST, () => {
  console.log(`🚀 Running on http://${env.HOST}:${env.PORT}`);
});