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
      JSON.stringify(
        {
          tokens: [],
          alerts: [],
        },
        null,
        2
      )
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
    return {
      tokens: [],
      alerts: [],
    };
  }
}

function writeStore(nextStore) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(nextStore, null, 2));
}

function upsertPushToken(tokenRecord) {
  const store = readStore();

  const nextTokens = store.tokens.filter(
    (item) => item.deviceId !== tokenRecord.deviceId
  );

  nextTokens.push({
    ...tokenRecord,
    updatedAtIso: new Date().toISOString(),
  });

  const nextStore = {
    ...store,
    tokens: nextTokens,
  };

  writeStore(nextStore);
  return tokenRecord;
}

function getPushTokenByDeviceId(deviceId) {
  const store = readStore();
  return store.tokens.find((item) => item.deviceId === deviceId) || null;
}

function removePushToken(expoPushToken) {
  const store = readStore();

  const nextStore = {
    ...store,
    tokens: store.tokens.filter((item) => item.expoPushToken !== expoPushToken),
  };

  writeStore(nextStore);
}

function upsertLeaveAlert(alert) {
  const store = readStore();

  const nextAlerts = store.alerts.filter((item) => item.id !== alert.id);
  nextAlerts.push(alert);

  const nextStore = {
    ...store,
    alerts: nextAlerts,
  };

  writeStore(nextStore);
  return alert;
}

function removeLeaveAlert(alertId) {
  const store = readStore();
  const target = store.alerts.find((item) => item.id === alertId) || null;

  const nextStore = {
    ...store,
    alerts: store.alerts.filter((item) => item.id !== alertId),
  };

  writeStore(nextStore);
  return target;
}

function listLeaveAlerts() {
  const store = readStore();
  return store.alerts;
}

module.exports = {
  upsertPushToken,
  getPushTokenByDeviceId,
  removePushToken,
  upsertLeaveAlert,
  removeLeaveAlert,
  listLeaveAlerts,
};