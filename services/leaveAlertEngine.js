const crypto = require("crypto");
const {
  upsertPushToken,
  getPushTokenByDeviceId,
  upsertLeaveAlert,
  removeLeaveAlert,
  listLeaveAlerts,
} = require("./leaveAlertStore");
const {
  sendExpoPushMessage,
  fetchExpoReceipts,
  processReceiptResults,
} = require("./expoPushService");

const ENGINE_INTERVAL_MS = Number(process.env.LEAVE_ALERT_ENGINE_INTERVAL_MS || 30000);

let engineStarted = false;
let engineTimer = null;

function makeId(prefix = "id") {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

async function registerExpoPushToken({ deviceId, expoPushToken, platform }) {
  return upsertPushToken({
    id: makeId("push-token"),
    deviceId,
    expoPushToken,
    platform,
  });
}

async function createOrReplaceLeaveAlert(payload) {
  const {
    alertId,
    deviceId,
    triggerAtIso,
    pickupLabel,
    destinationLabel,
    routeEtaSeconds,
    walkSeconds,
    prepSeconds,
    selectedBusId,
  } = payload || {};

  if (!deviceId || !triggerAtIso || !pickupLabel || !destinationLabel) {
    throw new Error("Missing required leave alert fields");
  }

  const tokenRecord = getPushTokenByDeviceId(deviceId);
  if (!tokenRecord?.expoPushToken) {
    throw new Error("No registered Expo push token for this device");
  }

  const nextAlert = {
    id: alertId || makeId("leave-alert"),
    deviceId,
    expoPushToken: tokenRecord.expoPushToken,
    triggerAtIso,
    pickupLabel,
    destinationLabel,
    routeEtaSeconds: Number(routeEtaSeconds || 0),
    walkSeconds: Number(walkSeconds || 0),
    prepSeconds: Number(prepSeconds || 0),
    selectedBusId: selectedBusId || null,
    status: "scheduled",
    sentAtIso: null,
    receiptIds: [],
    updatedAtIso: new Date().toISOString(),
  };

  return upsertLeaveAlert(nextAlert);
}

async function cancelLeaveAlert(alertId) {
  return removeLeaveAlert(alertId);
}

function listActiveLeaveAlerts() {
  return listLeaveAlerts().filter((item) => item.status === "scheduled");
}

async function sendDueLeaveAlerts() {
  const now = Date.now();
  const alerts = listLeaveAlerts().filter((item) => item.status === "scheduled");

  if (!alerts.length) return;

  const dueAlerts = alerts.filter((item) => {
    const triggerMs = new Date(item.triggerAtIso).getTime();
    return Number.isFinite(triggerMs) && triggerMs <= now;
  });

  if (!dueAlerts.length) return;

  const receiptIdToTokenMap = {};

  for (const alert of dueAlerts) {
    try {
      const tickets = await sendExpoPushMessage({
        to: alert.expoPushToken,
        title: "Arbebus Leave Alert",
        body: `Laikas išeiti. Eik į ${alert.pickupLabel} ir ruoškis kelionei į ${alert.destinationLabel}.`,
        data: {
          type: "leave-alert",
          alertId: alert.id,
          pickupLabel: alert.pickupLabel,
          destinationLabel: alert.destinationLabel,
          selectedBusId: alert.selectedBusId,
        },
      });

      const receiptIds = tickets
        .filter((ticket) => ticket?.status === "ok" && ticket.id)
        .map((ticket) => ticket.id);

      for (const receiptId of receiptIds) {
        receiptIdToTokenMap[receiptId] = alert.expoPushToken;
      }

      upsertLeaveAlert({
        ...alert,
        status: "sent",
        sentAtIso: new Date().toISOString(),
        receiptIds,
        updatedAtIso: new Date().toISOString(),
      });
    } catch (error) {
      console.error("sendDueLeaveAlerts alert failed:", alert.id, error.message);
    }
  }

  const receiptIds = Object.keys(receiptIdToTokenMap);
  if (!receiptIds.length) return;

  setTimeout(async () => {
    try {
      const receipts = await fetchExpoReceipts(receiptIds);
      await processReceiptResults(receipts, receiptIdToTokenMap);
    } catch (error) {
      console.error("fetchExpoReceipts failed:", error.message);
    }
  }, 15000);
}

function startLeaveAlertEngine() {
  if (engineStarted) return;
  engineStarted = true;

  engineTimer = setInterval(() => {
    void sendDueLeaveAlerts();
  }, ENGINE_INTERVAL_MS);

  console.log(`🕒 Leave alert engine started (${ENGINE_INTERVAL_MS} ms)`);
}

module.exports = {
  startLeaveAlertEngine,
  registerExpoPushToken,
  createOrReplaceLeaveAlert,
  cancelLeaveAlert,
  listActiveLeaveAlerts,
};