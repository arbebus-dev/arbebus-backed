const service = require('./transit.service');
const realtimeAlerts = require('./realtime/alerts');
const tripUpdatesService = require('./realtime/tripUpdates');

async function index(_req, res, next) {
  try { res.json({ ok: true, module: 'transit' }); } catch (error) { next(error); }
}
async function plan(req, res, next) {
  try { res.json(await service.plan({ ...(req.query || {}), ...(req.body || {}) })); } catch (error) { next(error); }
}
async function liveBuses(_req, res, next) {
  try { res.json(await service.liveBuses()); } catch (error) { next(error); }
}
async function liveEta(req, res, next) {
  try { res.json(await service.liveEta(req.query)); } catch (error) { next(error); }
}
async function shape(req, res, next) {
  try { res.json(service.shape(req.params.shapeId)); } catch (error) { next(error); }
}
async function alerts(_req, res, next) {
  try { res.json(realtimeAlerts.getRealtimeAlerts()); } catch (error) { next(error); }
}
async function tripUpdates(_req, res, next) {
  try { res.json(tripUpdatesService.getTripUpdates()); } catch (error) { next(error); }
}

module.exports = { index, plan, liveBuses, liveEta, shape, alerts, tripUpdates };
