const axios = require("axios");
const {
  normalizeRouteId,
  normalizeVehicleId,
} = require("./transitGateway");

const GPS_URL = "https://www.stops.lt/klaipeda/gps_full.txt";

function parseGpsFeed(text) {
  const tokens = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const HEADER_SIZE = 11;
  if (tokens.length <= HEADER_SIZE) return [];

  const data = tokens.slice(HEADER_SIZE);
  const vehicles = [];

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

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    vehicles.push({
      vehicleId: normalizeVehicleId(tripId || `${route}-${vehicleLabel}`),
      routeId: normalizeRouteId(route),
      latitude,
      longitude,
      speedKph: Number(speed) || 0,
      bearing: Number(bearing) || 0,
      tripStart: tripStart || null,
      delaySeconds: Number(delay) || 0,
      directionName: directionName || null,
      rawType: type || null,
      vehicleLabel: vehicleLabel || null,
      fetchedAtIso: new Date().toISOString(),
    });
  }

  return vehicles;
}

const fetch = require("node-fetch");

async function fetchLiveVehicles() {
  try {
    const res = await fetch("https://www.stops.lt/klaipeda/gps_full.txt", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const text = await res.text();

    if (!text) {
      console.log("❌ EMPTY GPS RESPONSE");
      return [];
    }

    const rows = text.split("\n");

    const vehicles = [];

    for (const row of rows) {
      const parts = row.split(",");

      if (parts.length < 6) continue;

      const lat = Number(parts[3]) / 1000000;
      const lon = Number(parts[4]) / 1000000;

      if (!lat || !lon) continue;

      // Klaipėdos bounding box
      if (
        lat < 55.5 ||
        lat > 56.0 ||
        lon < 20.8 ||
        lon > 21.5
      ) {
        continue;
      }

      vehicles.push({
        id: parts[0],
        route: parts[1],
        latitude: lat,
        longitude: lon,
        heading: Number(parts[5]) || 0,
      });
    }

    console.log("🚌 LIVE VEHICLES:", vehicles.length);

    return vehicles;
  } catch (e) {
    console.error("❌ GPS FETCH ERROR:", e.message);
    return [];
  }
}

module.exports = { fetchLiveVehicles };