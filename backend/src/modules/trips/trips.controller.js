const tripsRepository = require('./trips.repository');
function parentIdFromReq(req) { return String(req.headers['x-parent-id'] || req.body?.parentId || req.query?.parentId || 'local-parent').trim(); }
async function savePlace(req, res, next) { try { const parentId = parentIdFromReq(req); const place = await tripsRepository.savePlace(parentId, req.body || {}); res.json({ ok: true, place }); } catch (e) { next(e); } }
async function startTrip(req, res, next) { try { const parentId = parentIdFromReq(req); const trip = await tripsRepository.startTrip(parentId, req.body || {}); res.json({ ok: true, trip }); } catch (e) { next(e); } }
async function event(req, res, next) { try { const parentId = parentIdFromReq(req); const event = await tripsRepository.addTripEvent(parentId, req.params.tripId || req.body?.tripId, req.body || {}); res.json({ ok: true, event }); } catch (e) { next(e); } }
module.exports = { savePlace, startTrip, event };
