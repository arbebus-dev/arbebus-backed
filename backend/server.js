const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { handleTransitPlan } = require('./services/transit/planner/plannerController');
const { fetchLiveVehicles } = require('./services/transit/klaipedaGateway');
const { getPool } = require('./db/pool');

const app = express();

if (env.ENABLE_CORS) {
  app.use(cors());
}

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.send('Arbebus backend is running 🚀');
});

app.get('/health', async (req, res) => {
  let dbOk = false;

  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (error) {
    dbOk = false;
  }

  res.json({
    ok: true,
    mode: 'db_transit_planner',
    dbOk,
    time: new Date().toISOString(),
  });
});

app.get('/live-buses', async (req, res) => {
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

app.post('/transit/plan', handleTransitPlan);

app.listen(env.PORT, env.HOST, () => {
  console.log(`Arbebus backend running on http://${env.HOST}:${env.PORT}`);
});
