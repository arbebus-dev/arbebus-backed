const fetch = require("node-fetch");
const {
  normalizeRouteId,
  normalizeVehicleId,
} = require("./transitGateway");

const GPS_URL = "https://www.stops.lt/klaipeda/gps_full.txt";

function parseGpsFeed(text) {
  const tokens = String(text || "")
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

    vehicles.push({
      id: normalizeVehicleId(tripId || `${route}-${vehicleLabel}`),
      vehicleId: normalizeVehicleId(tripId || `${route}-${vehicleLabel}`),
      route: normalizeRouteId(route),
      routeId: normalizeRouteId(route),
      latitude,
      longitude,
      coordinate: {
        latitude,
        longitude,
      },
      speedKph: Number(speed) || 0,
      bearing: Number(bearing) || 0,
      heading: Number(bearing) || 0,
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

async function fetchLiveVehicles() {
  try {
    const res = await fetch(GPS_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 Arbebus/1.0",
        Accept: "text/plain,*/*",
      },
      timeout: 15000,
    });

    if (!res.ok) {
      throw new Error(`GPS upstream HTTP ${res.status}`);
    }

    const text = await res.text();
    const vehicles = parseGpsFeed(text);

    console.log("🚌 LIVE VEHICLES:", vehicles.length);
    return vehicles;
  } catch (error) {
    console.log("❌ fetchLiveVehicles error:", error.message);
    return [];
  }
}

module.exports = { fetchLiveVehicles };
