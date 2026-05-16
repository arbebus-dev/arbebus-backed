const service = require("./ferry.service");

async function overview(_req, res, next) {
  try {
    res.json(service.getOverview());
  } catch (error) {
    next(error);
  }
}

async function health(_req, res, next) {
  try {
    res.json({ ok: true, module: "ferries", service: "ready" });
  } catch (error) {
    next(error);
  }
}

async function routes(_req, res, next) {
  try {
    res.json({ ok: true, routes: service.getRoutes(), terminals: service.getTerminals() });
  } catch (error) {
    next(error);
  }
}

async function schedule(req, res, next) {
  try {
    res.json({ ok: true, schedule: service.getSchedule(req.query.routeId) });
  } catch (error) {
    next(error);
  }
}

async function nextDepartures(req, res, next) {
  try {
    res.json({
      ok: true,
      nextDepartures: service.getNextDepartures({
        routeId: req.query.routeId,
        limit: req.query.limit,
      }),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { overview, health, routes, schedule, nextDepartures };
