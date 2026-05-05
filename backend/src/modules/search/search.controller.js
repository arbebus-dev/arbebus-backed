const service = require('./search.service');

function params(req) {
  return { ...(req.query || {}), ...(req.body || {}) };
}

async function index(req, res, next) {
  try { res.json(await service.index(params(req))); } catch (error) { next(error); }
}

async function debug(req, res, next) {
  try { res.json(await service.debug(params(req))); } catch (error) { next(error); }
}

async function reverse(req, res, next) {
  try { res.json(await service.reverse(params(req))); } catch (error) { next(error); }
}

async function details(req, res, next) {
  try { res.json(await service.details(params(req))); } catch (error) { next(error); }
}

async function photo(req, res, next) {
  try {
    const payload = await service.photo(params(req));
    if (payload?.url) return res.redirect(302, payload.url);
    return res.status(404).json(payload || { ok: false, error: 'photo not found' });
  } catch (error) { next(error); }
}

async function health(req, res, next) {
  try { res.json(service.health()); } catch (error) { next(error); }
}

async function stops(req, res, next) {
  try { res.json(await service.stops(params(req))); } catch (error) { next(error); }
}

async function nearestStop(req, res, next) {
  try { res.json({ ok: true, stop: service.findNearestStop(req.query), nearestStop: service.findNearestStop(req.query) }); } catch (error) { next(error); }
}

module.exports = { index, debug, reverse, details, photo, health, stops, nearestStop, places: index };
