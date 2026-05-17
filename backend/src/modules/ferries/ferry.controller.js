const service = require("./ferry.service");
const ferryLive = require("./ferryLive.service");

function getRequestOptions(req) {
  return {
    now: req.query.now ? new Date(req.query.now) : new Date(),
    timeZone: req.query.timeZone || service.FERRY_TIME_ZONE,
  };
}

async function overview(req, res, next) {
  try {
    res.json(service.getOverview(getRequestOptions(req)));
  } catch (error) {
    next(error);
  }
}

async function health(_req, res, next) {
  try {
    res.json({ ok: true, module: "ferries", service: "ready", timeZone: service.FERRY_TIME_ZONE });
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
    const options = getRequestOptions(req);
    res.json({ ok: true, timeZone: options.timeZone, schedule: service.getSchedule(req.query.routeId, options) });
  } catch (error) {
    next(error);
  }
}

async function nextDepartures(req, res, next) {
  try {
    const options = getRequestOptions(req);
    res.json({
      ok: true,
      timeZone: options.timeZone,
      nextDepartures: service.getNextDepartures({
        routeId: req.query.routeId,
        limit: req.query.limit,
        now: options.now,
        timeZone: options.timeZone,
      }),
    });
  } catch (error) {
    next(error);
  }
}

async function live(req, res, next) {
  try {
    const options = getRequestOptions(req);
    res.json({
      ok: true,
      timeZone: options.timeZone,
      source: ferryLive.LIVE_SOURCE,
      ferries: ferryLive.getLiveFerries({
        routeId: req.query.routeId,
        now: options.now,
        timeZone: options.timeZone,
      }),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { overview, health, routes, schedule, nextDepartures, live };
