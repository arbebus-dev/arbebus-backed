require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const {
  buildNewsFeed,
} = require("./services/newsService");
const {
  startLeaveAlertEngine,
  registerExpoPushToken,
  createOrReplaceLeaveAlert,
  cancelLeaveAlert,
  listActiveLeaveAlerts,
} = require("./services/leaveAlertEngine");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const GPS_URL = "https://www.stops.lt/klaipeda/gps_full.txt";

function parseGPS(text) {
  const tokens = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const HEADER_SIZE = 11;
  if (tokens.length <= HEADER_SIZE) return [];

  const data = tokens.slice(HEADER_SIZE);
  const buses = [];

  for (let i = 0; i + 10 < data.length; i += 11) {
    const [
      type,
      route,
      tripId,
      vehicleLabel,
      lonRaw,
      latRaw,
      speed,
      bearing,
      tripStart,
      delay,
      directionName,
    ] = data.slice(i, i + 11);

    const longitude = Number(lonRaw) / 1000000;
    const latitude = Number(latRaw) / 1000000;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 55 ||
      latitude > 56 ||
      longitude < 20 ||
      longitude > 22
    ) {
      continue;
    }

    buses.push({
      id: tripId || `${route}-${vehicleLabel}`,
      type,
      number: route,
      vehicleLabel,
      latitude,
      longitude,
      speed: Number(speed) || 0,
      bearing: Number(bearing) || 0,
      tripStart,
      delaySeconds: Number(delay) || 0,
      directionName,
    });
  }

  return buses;
}

app.get("/", (_req, res) => {
  res.send("Arbebus backend is running 🚀");
});

app.get("/health", async (_req, res) => {
  try {
    const news = await buildNewsFeed();

    res.json({
      ok: true,
      service: "arbebus-backend",
      now: new Date().toISOString(),
      news: news.meta,
      leaveAlerts: {
        active: listActiveLeaveAlerts().length,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/live-buses", async (_req, res) => {
  try {
    const response = await axios.get(GPS_URL, {
      timeout: 10000,
    });

    res.json(parseGPS(response.data));
  } catch (error) {
    console.error("GPS fetch failed:", error.message);
    res.status(500).json({ error: "Failed to fetch GPS" });
  }
});

app.get("/news", async (_req, res) => {
  try {
    const payload = await buildNewsFeed();
    res.json(payload);
  } catch (error) {
    console.error("GET /news error:", error.message);
    res.status(500).json({
      ok: false,
      generatedAt: new Date().toISOString(),
      meta: {
        partial: true,
        sections: {
          world: "error",
          transport: "fallback",
          deal: "fallback",
          update: "fallback",
        },
        errors: [{ section: "news", message: error.message }],
      },
      items: [],
    });
  }
});

app.post("/push/register", async (req, res) => {
  try {
    const { deviceId, expoPushToken, platform } = req.body || {};

    if (!deviceId || !expoPushToken) {
      return res.status(400).json({
        ok: false,
        error: "deviceId and expoPushToken are required",
      });
    }

    const tokenRecord = await registerExpoPushToken({
      deviceId,
      expoPushToken,
      platform: platform || "unknown",
    });

    res.json({
      ok: true,
      token: tokenRecord,
    });
  } catch (error) {
    console.error("POST /push/register error:", error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.post("/leave-alerts", async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await createOrReplaceLeaveAlert(payload);

    res.json({
      ok: true,
      alert: result,
    });
  } catch (error) {
    console.error("POST /leave-alerts error:", error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.delete("/leave-alerts/:alertId", async (req, res) => {
  try {
    const removed = await cancelLeaveAlert(req.params.alertId);

    res.json({
      ok: true,
      removed,
    });
  } catch (error) {
    console.error("DELETE /leave-alerts/:alertId error:", error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/leave-alerts", (_req, res) => {
  res.json({
    ok: true,
    items: listActiveLeaveAlerts(),
  });
});

startLeaveAlertEngine();

app.listen(PORT, HOST, () => {
  console.log(`🚀 Running on http://${HOST}:${PORT}`);
});