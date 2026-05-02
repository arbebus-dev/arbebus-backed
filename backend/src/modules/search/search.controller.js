const service = require('./search.service');

async function index(req, res, next) {
  try {
    res.json(await service.index({ ...(req.query || {}), ...(req.body || {}) }));
  } catch (error) {
    next(error);
  }
}

async function stops(req, res, next) {
  try {
    res.json(await service.stops({ ...(req.query || {}), ...(req.body || {}) }));
  } catch (error) {
    next(error);
  }
}

async function nearestStop(req, res, next) {
  try {
    const stop = service.findNearestStop(req.query, { routeId: req.query.routeId || req.query.routeNumber });
    res.json({ ok: true, stop, nearestStop: stop });
  } catch (error) {
    next(error);
  }
}

module.exports = { index, stops, nearestStop };
