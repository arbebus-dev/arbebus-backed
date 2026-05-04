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

async function health(req, res, next) {
  try { res.json(service.health()); } catch (error) { next(error); }
}

async function stops(req, res, next) {
  try { res.json(await service.stops(params(req))); } catch (error) { next(error); }
}

async function nearestStop(req, res, next) {
  try { res.json({ ok: true, stop: service.findNearestStop(req.query), nearestStop: service.findNearestStop(req.query) }); } catch (error) { next(error); }
}

module.exports = { index, debug, reverse, health, stops, nearestStop, places: index };
