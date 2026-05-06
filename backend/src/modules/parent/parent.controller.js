const parentRepository = require('./parent.repository');

function parentIdFromReq(req) {
  return String(req.headers['x-parent-id'] || req.body?.parentId || req.query?.parentId || 'local-parent').trim();
}

async function dashboard(req, res, next) {
  try {
    const parentId = parentIdFromReq(req);
    await parentRepository.ensureParent({ parentId, email: req.body?.email || req.query?.email, displayName: req.body?.displayName || req.query?.displayName });
    const dashboardData = await parentRepository.getDashboard(parentId);
    res.json({ ok: true, parentId, ...dashboardData });
  } catch (error) { next(error); }
}

async function upsert(req, res, next) {
  try {
    const parentId = parentIdFromReq(req);
    const parent = await parentRepository.ensureParent({ parentId, email: req.body?.email, displayName: req.body?.displayName });
    res.json({ ok: true, parent });
  } catch (error) { next(error); }
}

module.exports = { dashboard, upsert };
