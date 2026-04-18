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
const { fetchLiveVehicles } = require("./transit/klaipedaGateway");
const { findNearestStop } = require("./transit/stopMatcher");
const { replanAlert } = require("./transit/replanEngine");
const stops = require("./data/stops.json");

const ENGINE_INTERVAL_MS = Number(
  process.env.LEAVE_ALERT_ENGINE_INTERVAL_MS || 30000
);

let engineStarted = false;

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
    arrivalAtIso,
    pickupLabel,
    destinationLabel,
    pickupCoordinate,
    routeId,
    walkSeconds,
    prepSeconds,
    selectedBusId,
  } = payload || {};

  if (
    !deviceId ||
    !triggerAtIso ||
    !pickupLabel ||
    !destinationLabel ||
    !pickupCoordinate ||
    !routeId
  ) {
    throw new Error("Missing required V3 leave alert fields");
  }

  const tokenRecord = getPushTokenByDeviceId(deviceId);
  if (!tokenRecord?.expoPushToken) {
    throw new Error("No registered Expo push token for this device");
  }

  const matchedStop = findNearestStop(stops, pickupCoordinate);

  const nextAlert = {
    id: alertId || makeId("leave-alert"),
    deviceId,
    expoPushToken: tokenRecord.expoPushToken,
    routeId: String(routeId).toUpperCase(),
    stopId: matchedStop?.id || null,
    stopName: matchedStop?.name || pickupLabel,
    pickupCoordinate,
    pickupLabel,
    destinationLabel,
    selectedBusId: selectedBusId || null,
    walkSeconds: Number(walkSeconds || 0),
    prepSeconds: Number(prepSeconds || 0),
    arrivalAtIso: arrivalAtIso || null,
    triggerAtIso,
    status: "scheduled",
    sentAtIso: null,
    lastReplannedAtIso: null,
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

async function sendPushAndCollectReceipts(messages) {
  const receiptMap = {};

  for (const message of messages) {
    try {
      const tickets = await sendExpoPushMessage(message.payload);
      const receiptIds = tickets
        .filter((ticket) => ticket?.status === "ok" && ticket.id)
        .map((ticket) => ticket.id);

      for (const receiptId of receiptIds) {
        receiptMap[receiptId] = message.payload.to;
      }

      if (message.onSent) {
        await message.onSent(receiptIds);
      }
    } catch (error) {
      console.error("Push send failed:", error.message);
    }
  }

  const ids = Object.keys(receiptMap);
  if (!ids.length) return;

  setTimeout(async () => {
    try {
      const receipts = await fetchExpoReceipts(ids);
      await processReceiptResults(receipts, receiptMap);
    } catch (error) {
      console.error("Push receipt check failed:", error.message);
    }
  }, 15000);
}

async function runDynamicReplanCycle() {
  const alerts = listLeaveAlerts().filter((item) => item.status === "scheduled");
  if (!alerts.length) return;

  const vehicles = await fetchLiveVehicles();
  const pushQueue = [];
  const now = Date.now();

  for (const alert of alerts) {
    const matchedStop =
      stops.find((stop) => String(stop.id) === String(alert.stopId)) ||
      findNearestStop(stops, alert.pickupCoordinate);

    if (!matchedStop) continue;

    const result = replanAlert({
      alert,
      vehicles,
      matchedStop,
    });

    if (result.changed) {
      const updatedAlert = {
        ...result.nextAlert,
        status: "scheduled",
      };

      upsertLeaveAlert(updatedAlert);

      pushQueue.push({
        payload: {
          to: updatedAlert.expoPushToken,
          title: "Arbebus route updated",
          body: `Leave alert atnaujintas. Naujas išėjimo laikas: ${new Date(
            updatedAlert.triggerAtIso
          ).toLocaleTimeString("lt-LT", {
            hour: "2-digit",
            minute: "2-digit",
          })}.`,
          data: {
            type: "leave-alert-replanned",
            alertId: updatedAlert.id,
            triggerAtIso: updatedAlert.triggerAtIso,
            arrivalAtIso: updatedAlert.arrivalAtIso,
            selectedBusId: updatedAlert.selectedBusId,
          },
        },
      });
    }

    const triggerMs = new Date(
      (result.nextAlert || alert).triggerAtIso
    ).getTime();

    if (Number.isFinite(triggerMs) && triggerMs <= now) {
      const dueAlert = result.nextAlert || alert;

      pushQueue.push({
        payload: {
          to: dueAlert.expoPushToken,
          title: "Arbebus Leave Alert",
          body: `Laikas išeiti. Eik į ${dueAlert.pickupLabel} ir ruoškis kelionei į ${dueAlert.destinationLabel}.`,
          data: {
            type: "leave-alert",
            alertId: dueAlert.id,
            triggerAtIso: dueAlert.triggerAtIso,
            arrivalAtIso: dueAlert.arrivalAtIso,
            selectedBusId: dueAlert.selectedBusId,
          },
        },
        onSent: async (receiptIds) => {
          upsertLeaveAlert({
            ...dueAlert,
            status: "sent",
            sentAtIso: new Date().toISOString(),
            receiptIds,
          });
        },
      });
    }
  }

  await sendPushAndCollectReceipts(pushQueue);
}

function startLeaveAlertEngine() {
  if (engineStarted) return;
  engineStarted = true;

  setInterval(() => {
    void runDynamicReplanCycle();
  }, ENGINE_INTERVAL_MS);

  console.log(`🕒 V3 leave alert engine started (${ENGINE_INTERVAL_MS} ms)`);
}

module.exports = {
  startLeaveAlertEngine,
  registerExpoPushToken,
  createOrReplaceLeaveAlert,
  cancelLeaveAlert,
  listActiveLeaveAlerts,
};