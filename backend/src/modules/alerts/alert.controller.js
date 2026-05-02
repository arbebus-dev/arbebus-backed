const service = require('./alert.service');

async function listAlerts(_req, res, next) { try { res.json(service.listLeaveAlerts()); } catch (error) { next(error); } }
async function listTokens(_req, res, next) { try { res.json(service.listTokens()); } catch (error) { next(error); } }
async function registerToken(req, res, next) { try { res.status(201).json(service.registerToken(req.body)); } catch (error) { next(error); } }
async function unregisterToken(req, res, next) { try { res.json(service.unregisterToken(req.params.token)); } catch (error) { next(error); } }
async function createLeaveAlert(req, res, next) { try { res.status(201).json(service.createLeaveAlert(req.body)); } catch (error) { next(error); } }
async function listLeaveAlerts(_req, res, next) { try { res.json(service.listLeaveAlerts()); } catch (error) { next(error); } }
async function deleteLeaveAlert(req, res, next) { try { res.json(service.deleteLeaveAlert(req.params.id)); } catch (error) { next(error); } }

module.exports = { listAlerts, listTokens, registerToken, unregisterToken, createLeaveAlert, listLeaveAlerts, deleteLeaveAlert };
