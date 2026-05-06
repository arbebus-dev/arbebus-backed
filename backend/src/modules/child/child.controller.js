const childRepository = require('./child.repository');
function parentIdFromReq(req) { return String(req.headers['x-parent-id'] || req.body?.parentId || req.query?.parentId || 'local-parent').trim(); }
async function list(req, res, next) { try { const parentId = parentIdFromReq(req); res.json({ ok: true, parentId, children: await childRepository.listChildren(parentId) }); } catch (e) { next(e); } }
async function create(req, res, next) { try { const parentId = parentIdFromReq(req); const child = await childRepository.createChild(parentId, req.body || {}); res.json({ ok: true, child }); } catch (e) { next(e); } }
module.exports = { list, create };
