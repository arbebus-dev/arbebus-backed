const express = require("express")
const cors = require("cors")
const axios = require("axios")

const app = express()
app.use(cors())

const PORT = 3000
const GPS_URL = "https://www.stops.lt/klaipeda/gps_full.txt"

function parseGPS(text) {
  const tokens = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  const HEADER_SIZE = 11

  if (tokens.length <= HEADER_SIZE) return []

  const data = tokens.slice(HEADER_SIZE)
  const buses = []

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
    ] = data.slice(i, i + 11)

    const longitude = Number(lonRaw) / 1000000
    const latitude = Number(latRaw) / 1000000

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 55 ||
      latitude > 56 ||
      longitude < 20 ||
      longitude > 22
    ) {
      continue
    }

    buses.push({
      id: tripId || `${route}-${vehicleLabel}`,
      number: route,
      latitude,
      longitude,
      speed: Number(speed) || 0,
      bearing: Number(bearing) || 0,
      delaySeconds: Number(delay) || 0,
      directionName,
    })
  }

  return buses
}

app.get("/live-buses", async (req, res) => {
  try {
    const response = await axios.get(GPS_URL)
    const buses = parseGPS(response.data)
    res.json(buses)
  } catch (err) {
    console.error("GPS fetch failed:", err.message)
    res.status(500).json({ error: "Failed to fetch GPS" })
  }
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Running on http://0.0.0.0:${PORT}`)
})