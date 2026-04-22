const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { fetchLiveVehicles } = require('./services/transit/klaipedaGateway');
const { getPool } = require('./db/pool');
const { planRoute } = require('./services/transitRouter');

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

    const [routesRes, tripsRes, stopsRes, routeTypesRes, importRes] =
      await Promise.all([
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
    res.json({
      ok: true,
      vehicles,
      count: vehicles.length,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to fetch live vehicles',
      vehicles: [],
    });
  }
});

app.post('/transit/plan', async (req, res) => {
  try {
    const body = req.body || {};

    const origin = body.origin
      ? {
          lat: Number(body.origin.latitude ?? body.origin.lat),
          lon: Number(body.origin.longitude ?? body.origin.lon),
        }
      : null;

    const destination = body.destination
      ? {
          lat: Number(body.destination.latitude ?? body.destination.lat),
          lon: Number(body.destination.longitude ?? body.destination.lon),
        }
      : null;

    if (
      !origin ||
      !destination ||
      !Number.isFinite(origin.lat) ||
      !Number.isFinite(origin.lon) ||
      !Number.isFinite(destination.lat) ||
      !Number.isFinite(destination.lon)
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid origin/destination',
        plan: null,
        options: [],
      });
    }

    const result = await planRoute(origin, destination);

    if (!result?.ok) {
      return res.json({
        ok: true,
        plan: null,
        options: [],
        meta: {
          reason: result?.reason || 'NO_ROUTE',
        },
      });
    }

    const walkSteps = result.steps.filter((s) => s.type === 'walk');
    const rideSteps = result.steps.filter((s) => s.type === 'ride');

    const firstWalk = walkSteps[0] || null;
    const lastWalk = walkSteps[walkSteps.length - 1] || null;
    const firstRide = rideSteps[0] || null;

    const totalWalkDistance = walkSteps.reduce(
      (sum, step) => sum + Number(step.distance || 0),
      0
    );
    const totalWalkMinutes = Math.max(1, Math.round(totalWalkDistance / 80));

    const totalDurationMinutes = result.meta?.arrivalTime
      ? Math.max(1, Math.round(result.meta.arrivalTime / 60))
      : 15;

    const totalBusMinutes = Math.max(1, totalDurationMinutes - totalWalkMinutes);

    const journeySteps = result.steps.map((step) => {
      if (step.type === 'walk') {
        return {
          icon: 'walk',
          title: step.to ? `Eik iki ${step.to}` : 'Eik pėsčiomis',
          subtitle: step.distance ? `${step.distance} m` : undefined,
          mode: 'walk',
          type: 'walk',
        };
      }

      return {
        icon: 'bus',
        title: `Važiuok ${step.tripId || 'transportu'}`,
        subtitle: `${step.fromStopId || '?'} → ${step.toStopId || '?'}`,
        mode: 'bus',
        type: 'ride',
        fromStopId: step.fromStopId,
        toStopId: step.toStopId,
        routeId: step.tripId,
      };
    });

    const plan = {
      id: `csa-${Date.now()}`,
      mode: 'bus',
      routeId: firstRide?.tripId || 'transit',
      summary: {
        totalDurationMinutes,
        totalWalkMinutes,
        totalBusMinutes,
        boardStopName: firstWalk?.to || 'Board stop',
        alightStopName: lastWalk?.from || 'Arrival stop',
        routeLabel: firstRide?.tripId || 'Transit',
        etaMinutes: null,
        stopCount: result.meta?.rides || 1,
        transfersCount: Math.max(0, (result.meta?.rides || 1) - 1),
        modes: ['bus'],
      },
      originStop: {
        id: 'origin-stop',
        name: firstWalk?.to || 'Origin stop',
        latitude: origin.lat,
        longitude: origin.lon,
        distanceMeters: firstWalk?.distance || 0,
      },
      destinationStop: {
        id: 'destination-stop',
        name: lastWalk?.from || 'Destination stop',
        latitude: destination.lat,
        longitude: destination.lon,
        distanceMeters: lastWalk?.distance || 0,
      },
      previewPoints: [
        {
          latitude: origin.lat,
          longitude: origin.lon,
        },
        {
          latitude: destination.lat,
          longitude: destination.lon,
        },
      ],
      journeySteps,
    };

    return res.json({
      ok: true,
      plan,
      options: [],
      meta: {
        reason: 'CSA_OK',
        ...result.meta,
      },
    });
  } catch (error) {
    console.error('CSA transit route error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'CSA route failed',
      plan: null,
      options: [],
    });
  }
});

app.listen(env.PORT, env.HOST, () => {
  console.log(`Arbebus backend running on http://${env.HOST}:${env.PORT}`);
});