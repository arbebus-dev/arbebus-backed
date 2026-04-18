const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "leave-alerts-store.json");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({ tokens: [], alerts: [] }, null, 2)
    );
  }
}

function readStore() {
  ensureStore();

  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    };
  } catch {
    return { tokens: [], alerts: [] };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function upsertPushToken(tokenRecord) {
  const store = readStore();
  const tokens = store.tokens.filter((item) => item.deviceId !== tokenRecord.deviceId);
  tokens.push({ ...tokenRecord, updatedAtIso: new Date().toISOString() });
  writeStore({ ...store, tokens });
  return tokenRecord;
}

function getPushTokenByDeviceId(deviceId) {
  return readStore().tokens.find((item) => item.deviceId === deviceId) || null;
}

function removePushToken(expoPushToken) {
  const store = readStore();
  writeStore({
    ...store,
    tokens: store.tokens.filter((item) => item.expoPushToken !== expoPushToken),
  });
}

function upsertLeaveAlert(alert) {
  const store = readStore();
  const alerts = store.alerts.filter((item) => item.id !== alert.id);
  alerts.push({ ...alert, updatedAtIso: new Date().toISOString() });
  writeStore({ ...store, alerts });
  return alert;
}

function removeLeaveAlert(alertId) {
  const store = readStore();
  const removed = store.alerts.find((item) => item.id === alertId) || null;

  writeStore({
    ...store,
    alerts: store.alerts.filter((item) => item.id !== alertId),
  });

  return removed;
}

function listLeaveAlerts() {
  return readStore().alerts;
}

module.exports = {
  upsertPushToken,
  getPushTokenByDeviceId,
  removePushToken,
  upsertLeaveAlert,
  removeLeaveAlert,
  listLeaveAlerts,
};