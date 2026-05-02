const repo = require('./poi.repository');

async function index(req, res, next) {
  try {
    const q = req.query.q || req.query.query || '';
    const results = q ? repo.searchPoi(q, req.query.limit) : repo.listPoi();
    res.json({ ok: true, results, places: results });
  } catch (error) { next(error); }
}

module.exports = { index };
