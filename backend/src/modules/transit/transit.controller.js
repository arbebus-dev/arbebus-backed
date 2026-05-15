const service = require("./transit.service");
const realtimeAlerts = require("./realtime/alerts");
const tripUpdatesService = require("./realtime/tripUpdates");

function withTimeout(promise, ms, fallback) {
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function index(_req, res, next) {
  try {
    res.json({ ok: true, module: "transit" });
  } catch (error) {
    next(error);
  }
}

async function plan(req, res, next) {
  try {
    const input = { ...(req.query || {}), ...(req.body || {}) };
    const result = await withTimeout(
      service.plan(input),
      Number(process.env.TRANSIT_PLAN_TIMEOUT_MS || 18000),
      () => ({
        ok: false,
        error: "TRANSIT_PLAN_TIMEOUT",
        message: "Kelionės planavimas užtruko per ilgai. Bandykite dar kartą arba pasirinkite artimesnę pradžios vietą.",
        routes: [],
        options: [],
        plan: null,
        meta: { timeout: true, routingVersion: "apple-maps-polish-v3" },
      }),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function liveBuses(_req, res, next) {
  try {
    res.json(await service.liveBuses());
  } catch (error) {
    next(error);
  }
}

async function liveEta(req, res, next) {
  try {
    res.json(await service.liveEta(req.query || {}));
  } catch (error) {
    next(error);
  }
}

async function shape(req, res, next) {
  try {
    res.json(service.shape(req.params.shapeId || req.query.shapeId));
  } catch (error) {
    next(error);
  }
}

async function alerts(_req, res, next) {
  try {
    res.json(await realtimeAlerts.getRealtimeAlerts());
  } catch (error) {
    next(error);
  }
}

async function tripUpdates(_req, res, next) {
  try {
    res.json(await tripUpdatesService.getTripUpdates());
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/transit/departures?stopId=...
 */
async function departures(req, res, next) {
  try {
    const stopId = req.query.stopId || req.query.stop_id || req.params.stopId;

    if (!stopId) {
      return res.status(400).json({
        ok: false,
        error: "MISSING_STOP_ID",
        message: "Missing stopId query parameter",
      });
    }

    res.json(await service.departures({ stopId }));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/transit/vehicle/:id
 */
async function vehicle(req, res, next) {
  try {
    const id = req.params.id || req.query.id;

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: "MISSING_VEHICLE_ID",
        message: "Missing vehicle id",
      });
    }

    res.json(await service.vehicle({ id }));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/transit/station-access?stopId=...
 */
async function stationAccess(req, res, next) {
  try {
    const stopId = req.query.stopId || req.query.stop_id || req.params.stopId;

    if (!stopId) {
      return res.status(400).json({
        ok: false,
        error: 'MISSING_STOP_ID',
        message: 'Missing stopId query parameter',
      });
    }

    res.json(await service.stationAccess({ stopId }));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  index,
  plan,
  liveBuses,
  liveEta,
  shape,
  alerts,
  tripUpdates,
  departures,
  vehicle,
  stationAccess,
};
