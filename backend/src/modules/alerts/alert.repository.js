const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '../../data/leave-alerts-store.json');

function readStore() {
  try { return JSON.parse(fs.readFileSync(storePath, 'utf8')); }
  catch { return { tokens: [], alerts: [] }; }
}
function writeStore(store) {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  return store;
}
function listTokens() { return readStore().tokens || []; }
function addToken(token, meta = {}) {
  const store = readStore();
  const item = { token, platform: meta.platform || 'unknown', updatedAt: new Date().toISOString() };
  store.tokens = (store.tokens || []).filter((x) => x.token !== token);
  store.tokens.push(item);
  writeStore(store);
  return item;
}
function removeToken(token) {
  const store = readStore();
  store.tokens = (store.tokens || []).filter((x) => x.token !== token);
  writeStore(store);
  return true;
}
function listAlerts() { return readStore().alerts || []; }
function addAlert(data = {}) {
  const store = readStore();
  const alert = { id: data.id || `alert-${Date.now()}`, ...data, createdAt: new Date().toISOString(), status: 'scheduled' };
  store.alerts = [...(store.alerts || []), alert];
  writeStore(store);
  return alert;
}
function removeAlert(id) {
  const store = readStore();
  const before = (store.alerts || []).length;
  store.alerts = (store.alerts || []).filter((x) => x.id !== id);
  writeStore(store);
  return before !== store.alerts.length;
}

module.exports = { listTokens, addToken, removeToken, listAlerts, addAlert, removeAlert };
