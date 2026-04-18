const axios = require("axios");
const { removePushToken } = require("./leaveAlertStore");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

function isExpoPushToken(value) {
  return typeof value === "string" && value.startsWith("ExponentPushToken[");
}

async function sendExpoPushMessage({ to, title, body, data }) {
  if (!isExpoPushToken(to)) {
    throw new Error("Invalid Expo push token");
  }

  const response = await axios.post(
    EXPO_PUSH_URL,
    {
      to,
      sound: "default",
      title,
      body,
      data: data || {},
      priority: "high",
    },
    {
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    }
  );

  const tickets = Array.isArray(response.data?.data)
    ? response.data.data
    : response.data?.data
    ? [response.data.data]
    : [];

  return tickets;
}

async function fetchExpoReceipts(ids) {
  if (!ids.length) return {};

  const response = await axios.post(
    EXPO_RECEIPTS_URL,
    { ids },
    {
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    }
  );

  return response.data?.data || {};
}

async function processReceiptResults(receipts, tokenMap) {
  for (const [receiptId, receipt] of Object.entries(receipts)) {
    if (receipt?.status !== "error") continue;

    const expoPushToken = tokenMap[receiptId];
    const errorCode = receipt?.details?.error;

    if (errorCode === "DeviceNotRegistered" && expoPushToken) {
      removePushToken(expoPushToken);
    }
  }
}

module.exports = {
  sendExpoPushMessage,
  fetchExpoReceipts,
  processReceiptResults,
};