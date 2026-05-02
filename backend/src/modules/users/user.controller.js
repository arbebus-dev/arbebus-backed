const service = require('./user.service');
async function list(req, res, next) { try { res.json(service.listUsers()); } catch (error) { next(error); } }
async function upsert(req, res, next) { try { res.json(service.upsertUser(req.body)); } catch (error) { next(error); } }
module.exports = { list, upsert };
