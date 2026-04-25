require('./config/env');

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { getPool } = require('./db/pool');
const { handleTransitPlan } = require('./services/transit/planner/plannerController');
const { fetchLiveVehicles } = require('./services/transit/klaipedaGateway');

const app = express();

if (env.ENABLE_CORS) {
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN }));
}

app.use(express.json({ limit: '1mb' }));

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeStop(row, index = 0) {
  const latitude = toNumber(row.latitude ?? row.stop_lat ?? row.lat);
  const longitude = toNumber(row.longitude ?? row.stop_lon ?? row.lon ?? row.lng);
  if (latitude === null || longitude === null) return null;
  return {
    id: String(row.id ?? row.stop_id ?? `stop-${index}`),
    stop_id: String(row.stop_id ?? row.id ?? `stop-${index}`),
    name: String(row.name ?? row.stop_name ?? row.title ?? 'Stotelė'),
    stop_name: String(row.stop_name ?? row.name ?? row.title ?? 'Stotelė'),
    latitude,
    longitude,
    distanceMeters: toNumber(row.distance_meters ?? row.distanceMeters) ?? undefined,
  };
}

function loadFallbackStops(query) {
  const files = [
    path.resolve(__dirname, 'services/data/stops.json'),
    path.resolve(__dirname, 'services/data/gtfs/stops.txt'),
  ];

  const q = String(query || '').trim().toLowerCase();

  try {
    if (fs.existsSync(files[0])) {
      const raw = JSON.parse(fs.readFileSync(files[0], 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.stops || [];
      return list
        .map(normalizeStop)
        .filter(Boolean)
        .filter((stop) => !q || stop.name.toLowerCase().includes(q))
        .slice(0, 20);
    }
  } catch (error) {
    console.warn('Fallback stops.json failed:', error.message);
  }

  try {
    if (!fs.existsSync(files[1])) return [];
    const [headerLine, ...lines] = fs.readFileSync(files[1], 'utf8').split(/\r?\n/);
    const headers = headerLine.split(',').map((h) => h.trim());
    const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
    return lines
      .filter(Boolean)
      .map((line, i) => {
        const cols = line.split(',');
        return normalizeStop({
          stop_id: cols[idx.stop_id],
          stop_name: cols[idx.stop_name],
          stop_lat: cols[idx.stop_lat],
          stop_lon: cols[idx.stop_lon],
        }, i);
      })
      .filter(Boolean)
      .filter((stop) => !q || stop.name.toLowerCase().includes(q))
      .slice(0, 20);
  } catch (error) {
    console.warn('Fallback GTFS stops failed:', error.message);
    return [];
  }
}

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'Arbebus backend', version: 'v1-real-routes' });
});

app.get('/health', async (_req, res) => {
  try {
    let database = 'not_checked';
    if (process.env.DATABASE_URL) {
      const result = await getPool().query('SELECT 1 AS ok');
      database = result.rows[0]?.ok === 1 ? 'ok' : 'unknown';
    }
    res.json({ ok: true, database, time: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get('/live-buses', async (_req, res) => {
  const vehicles = await fetchLiveVehicles();
  res.json({ ok: true, count: vehicles.length, buses: vehicles, vehicles });
});

app.get('/stops/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);
  const limit = Math.min(30, Math.max(1, Number(req.query.limit || 12)));

  if (!q || q.length < 2) {
    return res.json({ ok: true, stops: [] });
  }

  try {
    const pool = getPool();
    const params = [`%${q}%`, q, limit];
    let distanceSelect = 'NULL::double precision AS distance_meters';
    let orderBy = `CASE WHEN stop_name ILIKE $1 THEN 0 ELSE 1 END, stop_name ASC`;

    if (lat !== null && lng !== null) {
      params.push(lng, lat);
      distanceSelect = `ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($4, $5), 4326)) AS distance_meters`;
      orderBy = `CASE WHEN stop_name ILIKE $1 THEN 0 ELSE 1 END, distance_meters ASC NULLS LAST, stop_name ASC`;
    }

    const result = await pool.query(`
      SELECT stop_id, stop_name, stop_lat AS latitude, stop_lon AS longitude, ${distanceSelect}
      FROM transit.stops
      WHERE stop_name ILIKE $1 OR stop_code ILIKE $1 OR to_tsvector('simple', stop_name) @@ plainto_tsquery('simple', $2)
      ORDER BY ${orderBy}
      LIMIT $3
    `, params);

    return res.json({ ok: true, stops: result.rows.map(normalizeStop).filter(Boolean) });
  } catch (error) {
    const fallbackStops = loadFallbackStops(q).slice(0, limit);
    return res.json({ ok: true, fallback: true, stops: fallbackStops });
  }
});

app.post('/transit/plan', handleTransitPlan);
app.get('/transit/plan', (req, res) => {
  req.body = {
    origin: {
      latitude: toNumber(req.query.fromLat ?? req.query.originLat ?? req.query.lat),
      longitude: toNumber(req.query.fromLng ?? req.query.originLng ?? req.query.lng),
    },
    destination: {
      latitude: toNumber(req.query.toLat ?? req.query.destinationLat),
      longitude: toNumber(req.query.toLng ?? req.query.destinationLng),
    },
  };
  return handleTransitPlan(req, res);
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route not found: ${req.method} ${req.path}` });
});

const port = env.PORT || 10000;
const host = env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  console.log(`Arbebus backend listening on http://${host}:${port}`);
});
