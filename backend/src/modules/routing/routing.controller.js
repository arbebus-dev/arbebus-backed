const orsClient = require('./ors.client');

async function index(_req, res, next) {
  try {
    res.json({ ok: true, module: 'routing', provider: 'ors-with-fallback' });
  } catch (error) {
    next(error);
  }
}

async function directions(req, res, next) {
  try {
    const payload = { ...(req.query || {}), ...(req.body || {}) };
    res.json(await orsClient.directions(payload));
  } catch (error) {
    next(error);
  }
}

async function walk(req, res, next) {
  try {
    const payload = { ...(req.query || {}), ...(req.body || {}), mode: 'walking' };
    res.json(await orsClient.walkingDirections(payload));
  } catch (error) {
    next(error);
  }
}

module.exports = { index, directions, walk };
