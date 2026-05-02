const service = require('./routing.service');

async function index(_req, res, next) {
  try { res.json({ ok: true, module: 'routing' }); } catch (error) { next(error); }
}
async function directions(req, res, next) {
  try { res.json(await service.directions({ ...(req.query || {}), ...(req.body || {}) })); } catch (error) { next(error); }
}
async function walk(req, res, next) {
  try { res.json(await service.directions({ ...(req.query || {}), ...(req.body || {}), mode: 'walking' })); } catch (error) { next(error); }
}

module.exports = { index, directions, walk };
