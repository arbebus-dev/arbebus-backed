const repo = require('./alert.repository');

function registerToken(payload = {}) {
  const token = payload.token || payload.expoPushToken || payload.pushToken;
  if (!token) { const error = new Error('Push token is required'); error.statusCode = 400; throw error; }
  return { ok: true, token: repo.addToken(token, payload) };
}
function unregisterToken(token) { return { ok: true, removed: repo.removeToken(token) }; }
function listTokens() { return { ok: true, tokens: repo.listTokens() }; }
function createLeaveAlert(payload = {}) { return { ok: true, alert: repo.addAlert(payload) }; }
function listLeaveAlerts() { return { ok: true, alerts: repo.listAlerts() }; }
function deleteLeaveAlert(id) { return { ok: true, removed: repo.removeAlert(id) }; }

module.exports = { registerToken, unregisterToken, listTokens, createLeaveAlert, listLeaveAlerts, deleteLeaveAlert };
