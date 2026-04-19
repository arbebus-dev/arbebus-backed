require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { buildNewsFeed } = require("./services/newsService");
const {
  startLeaveAlertEngine,
  registerExpoPushToken,
  createOrReplaceLeaveAlert,
  cancelLeaveAlert,
  listActiveLeaveAlerts,
} = require("./services/leaveAlertEngine");
const { fetchLiveVehicles } = require("./services/transit/klaipedaGateway");
const { distanceMeters } = require("./services/transit/stopMatcher");
const { pickBestVehicleForStop } = require("./services/transit/etaEstimator");
const { loadGtfsData } = require("./services/transit/gtfsLoader");

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
      routeId: String(route || "").trim().toUpperCase(),
      vehicleLabel,
      latitude,
      longitude,
      coordinate: {
        latitude,
        longitude,
      },
      speed: Number(speed) || 0,
      speedKph: Number(speed) || 0,
      bearing: Number(bearing) || 0,
      heading: Number(bearing) || 0,
      tripStart,
      delaySeconds: Number(delay) || 0,
      directionName,
      timestamp: Date.now(),
    });
  }

  return buses;
}

function normalizeCoordinate(value) {
  if (!value || typeof value !== "object") return null;

  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function estimateWalkMinutes(distance) {
  return Math.max(1, Math.round(distance / 80));
}

function estimateRideMinutes(stopCount) {
  return Math.max(3, Math.round(stopCount * 2));
}

function getNearbyStops(point, gtfs, maxDistanceMeters = 900, limit = 8) {
  return Array.from(gtfs.stopsById.values())
    .map((stop) => ({
      ...stop,
      distanceMeters: Math.round(
        distanceMeters(point, {
          latitude: stop.latitude,
          longitude: stop.longitude,
        })
      ),
    }))
    .filter((stop) => stop.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

function sliceShapeBetweenStops(gtfs, variant, fromStop, toStop) {
  if (!variant?.shapePoints?.length) {
    return [
      { latitude: fromStop.latitude, longitude: fromStop.longitude },
      { latitude: toStop.latitude, longitude: toStop.longitude },
    ];
  }

  const fromIdx = gtfs.nearestShapeIndex(variant.shapePoints, fromStop);
  const toIdx = gtfs.nearestShapeIndex(variant.shapePoints, toStop);

  if (fromIdx < 0 || toIdx < 0) {
    return [
      { latitude: fromStop.latitude, longitude: fromStop.longitude },
      { latitude: toStop.latitude, longitude: toStop.longitude },
    ];
  }

  const start = Math.min(fromIdx, toIdx);
  const end = Math.max(fromIdx, toIdx);
  const points = variant.shapePoints.slice(start, end + 1);

  if (points.length < 2) {
    return [
      { latitude: fromStop.latitude, longitude: fromStop.longitude },
      { latitude: toStop.latitude, longitude: toStop.longitude },
    ];
  }

  return [
    { latitude: fromStop.latitude, longitude: fromStop.longitude },
    ...points,
    { latitude: toStop.latitude, longitude: toStop.longitude },
  ];
}

function makeDirectCandidate({ variant, boardStop, alightStop }) {
  const boardIndex = variant.stopIndexByStopId.get(boardStop.id);
  const alightIndex = variant.stopIndexByStopId.get(alightStop.id);

  if (
    !Number.isFinite(boardIndex) ||
    !Number.isFinite(alightIndex) ||
    alightIndex <= boardIndex
  ) {
    return null;
  }

  const stopCount = alightIndex - boardIndex;
  const walkToOrigin = boardStop.distanceMeters;
  const walkFromDestination = alightStop.distanceMeters;

  return {
    type: "direct",
    routeId: variant.routeLabel,
    routeInternalId: variant.routeId,
    routeHeadsign: variant.headsign,
    directionId: variant.directionId,
    directionCode: variant.directionCode,
    originStop: boardStop,
    destinationStop: alightStop,
    boardIndex,
    alightIndex,
    stopCount,
    walkToOrigin,
    walkFromDestination,
    estimatedBusSeconds: Math.max(180, stopCount * 110),
    score:
      walkToOrigin +
      walkFromDestination +
      stopCount * 100 +
      (variant.directionId === null ? 50 : 0),
    firstVariant: variant,
    secondVariant: null,
    transferStop: null,
  };
}

function makeTransferCandidate({
  firstVariant,
  secondVariant,
  boardStop,
  transferStop,
  alightStop,
}) {
  const boardIndex = firstVariant.stopIndexByStopId.get(boardStop.id);
  const transferIndex1 = firstVariant.stopIndexByStopId.get(transferStop.id);
  const transferIndex2 = secondVariant.stopIndexByStopId.get(transferStop.id);
  const alightIndex = secondVariant.stopIndexByStopId.get(alightStop.id);

  if (
    !Number.isFinite(boardIndex) ||
    !Number.isFinite(transferIndex1) ||
    !Number.isFinite(transferIndex2) ||
    !Number.isFinite(alightIndex)
  ) {
    return null;
  }

  if (transferIndex1 <= boardIndex) return null;
  if (alightIndex <= transferIndex2) return null;

  const firstStopCount = transferIndex1 - boardIndex;
  const secondStopCount = alightIndex - transferIndex2;
  const walkToOrigin = boardStop.distanceMeters;
  const walkFromDestination = alightStop.distanceMeters;
  const transferWalkMeters = 60;
  const transferWalkMinutes = 1;
  const estimatedBusSeconds =
    Math.max(180, firstStopCount * 110) + Math.max(180, secondStopCount * 110);

  return {
    type: "transfer",
    routeId: `${firstVariant.routeLabel} → ${secondVariant.routeLabel}`,
    routeInternalId: firstVariant.routeId,
    routeHeadsign: firstVariant.headsign,
    secondRouteHeadsign: secondVariant.headsign,
    directionId: firstVariant.directionId,
    secondDirectionId: secondVariant.directionId,
    directionCode: firstVariant.directionCode,
    secondDirectionCode: secondVariant.directionCode,
    originStop: boardStop,
    destinationStop: alightStop,
    transferStop,
    boardIndex,
    stopCount: firstStopCount + secondStopCount,
    walkToOrigin,
    walkFromDestination,
    transferWalkMeters,
    transferWalkMinutes,
    estimatedBusSeconds,
    firstStopCount,
    secondStopCount,
    score:
      walkToOrigin +
      walkFromDestination +
      estimatedBusSeconds +
      300 +
      transferWalkMeters,
    firstVariant,
    secondVariant,
  };
}

function buildTransitCandidates({ origin, destination, gtfs }) {
  const originStops = getNearbyStops(origin, gtfs, 900, 8);
  const destinationStops = getNearbyStops(destination, gtfs, 900, 8);

  const direct = [];
  const transfers = [];

  for (const boardStop of originStops) {
    const originVariants = gtfs.activeVariantsByStopId.get(boardStop.id) || [];

    for (const alightStop of destinationStops) {
      if (boardStop.id === alightStop.id) continue;

      const destinationVariants =
        gtfs.activeVariantsByStopId.get(alightStop.id) || [];
      const destinationVariantIds = new Set(destinationVariants.map((v) => v.id));

      for (const variant of originVariants) {
        if (destinationVariantIds.has(variant.id)) {
          const candidate = makeDirectCandidate({
            variant,
            boardStop,
            alightStop,
          });

          if (candidate) direct.push(candidate);
        }

        const boardIndex = variant.stopIndexByStopId.get(boardStop.id);
        if (!Number.isFinite(boardIndex)) continue;

        for (let i = boardIndex + 1; i < variant.stopIds.length; i += 1) {
          const transferStopId = variant.stopIds[i];
          const transferStopBase = gtfs.stopsById.get(transferStopId);
          if (!transferStopBase) continue;

          const secondVariants =
            gtfs.activeVariantsByStopId.get(transferStopId) || [];

          for (const secondVariant of secondVariants) {
            if (secondVariant.id === variant.id) continue;
            if (!secondVariant.stopIndexByStopId.has(alightStop.id)) continue;

            const candidate = makeTransferCandidate({
              firstVariant: variant,
              secondVariant,
              boardStop,
              transferStop: {
                ...transferStopBase,
                distanceMeters: 0,
              },
              alightStop,
            });

            if (candidate) transfers.push(candidate);
          }
        }
      }
    }
  }

  const dedupe = new Map();

  for (const candidate of [...direct, ...transfers]) {
    const key = [
      candidate.type,
      candidate.routeId,
      candidate.originStop.id,
      candidate.transferStop?.id || "direct",
      candidate.destinationStop.id,
    ].join(":");

    const current = dedupe.get(key);
    if (!current || candidate.score < current.score) {
      dedupe.set(key, candidate);
    }
  }

  return Array.from(dedupe.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, 12);
}

function buildOptionFromCandidate({
  candidate,
  origin,
  destination,
  userLocation,
  vehicles,
  gtfs,
  index,
}) {
  const walkToOriginMinutes = estimateWalkMinutes(candidate.walkToOrigin);
  const walkFromDestinationMinutes = estimateWalkMinutes(
    candidate.walkFromDestination
  );

  const firstRideMinutes =
    candidate.type === "transfer"
      ? estimateRideMinutes(candidate.firstStopCount)
      : estimateRideMinutes(candidate.stopCount);

  const secondRideMinutes =
    candidate.type === "transfer"
      ? estimateRideMinutes(candidate.secondStopCount)
      : 0;

  const transferWalkMinutes =
    candidate.type === "transfer" ? candidate.transferWalkMinutes : 0;

  const totalDurationMinutes =
    walkToOriginMinutes +
    firstRideMinutes +
    transferWalkMinutes +
    secondRideMinutes +
    walkFromDestinationMinutes;

  const boardingPoint = userLocation || origin;
  const bestVehicle = pickBestVehicleForStop({
    vehicles,
    stop: candidate.originStop,
    boardPoint: boardingPoint,
    routeId: candidate.firstVariant.routeLabel,
    directionHint:
      candidate.firstVariant.directionCode ||
      candidate.firstVariant.headsign ||
      null,
  });

  const etaMinutes = bestVehicle
    ? Math.max(1, Math.round(bestVehicle.etaSeconds / 60))
    : Math.max(2, walkToOriginMinutes + 2);

  const firstBusShape = sliceShapeBetweenStops(
    gtfs,
    candidate.firstVariant,
    candidate.originStop,
    candidate.type === "transfer"
      ? candidate.transferStop
      : candidate.destinationStop
  );

  const secondBusShape =
    candidate.type === "transfer"
      ? sliceShapeBetweenStops(
          gtfs,
          candidate.secondVariant,
          candidate.transferStop,
          candidate.destinationStop
        )
      : [];

  const previewPoints = [
    origin,
    { latitude: candidate.originStop.latitude, longitude: candidate.originStop.longitude },
    ...firstBusShape,
    ...(candidate.type === "transfer"
      ? [
          {
            latitude: candidate.transferStop.latitude,
            longitude: candidate.transferStop.longitude,
          },
          ...secondBusShape,
        ]
      : []),
    {
      latitude: candidate.destinationStop.latitude,
      longitude: candidate.destinationStop.longitude,
    },
    destination,
  ];

  const journeySteps =
    candidate.type === "transfer"
      ? [
          {
            icon: "walk",
            title: `Eik į stotelę ${candidate.originStop.name}`,
            subtitle: `${candidate.walkToOrigin} m • ~${walkToOriginMinutes} min`,
          },
          {
            icon: "bus",
            title: `Įlipk į ${candidate.firstVariant.routeLabel} autobusą`,
            subtitle:
              candidate.firstVariant.headsign ||
              candidate.firstVariant.directionCode ||
              "Pirmas etapas",
          },
          {
            icon: "map-marker-path",
            title: `Važiuok iki ${candidate.transferStop.name}`,
            subtitle: `${candidate.firstStopCount} st. • ~${firstRideMinutes} min`,
          },
          {
            icon: "swap-horizontal",
            title: `Persėsk stotelėje ${candidate.transferStop.name}`,
            subtitle: `~${transferWalkMinutes} min iki kito reiso`,
          },
          {
            icon: "bus",
            title: `Lipk į ${candidate.secondVariant.routeLabel} autobusą`,
            subtitle:
              candidate.secondVariant.headsign ||
              candidate.secondVariant.directionCode ||
              "Antras etapas",
          },
          {
            icon: "map-marker-check-outline",
            title: `Išlipk ties ${candidate.destinationStop.name}`,
            subtitle: `${candidate.secondStopCount} st. • ~${secondRideMinutes} min`,
          },
          {
            icon: "walk",
            title: "Eik iki tikslo",
            subtitle: `${candidate.walkFromDestination} m • ~${walkFromDestinationMinutes} min`,
          },
        ]
      : [
          {
            icon: "walk",
            title: `Eik į stotelę ${candidate.originStop.name}`,
            subtitle: `${candidate.walkToOrigin} m • ~${walkToOriginMinutes} min`,
          },
          {
            icon: "bus",
            title: `Įlipk į ${candidate.firstVariant.routeLabel} autobusą`,
            subtitle:
              candidate.firstVariant.headsign ||
              candidate.firstVariant.directionCode ||
              "Tiesioginis maršrutas",
          },
          {
            icon: "map-marker-check-outline",
            title: `Išlipk ties ${candidate.destinationStop.name}`,
            subtitle: `${candidate.stopCount} st. • ~${firstRideMinutes} min`,
          },
          {
            icon: "walk",
            title: "Eik iki tikslo",
            subtitle: `${candidate.walkFromDestination} m • ~${walkFromDestinationMinutes} min`,
          },
        ];

  return {
    id: `transit-${candidate.type}-${index}`,
    mode: "bus",
    title:
      candidate.type === "transfer"
        ? `Autobusai ${candidate.firstVariant.routeLabel} → ${candidate.secondVariant.routeLabel}`
        : `Autobusas ${candidate.firstVariant.routeLabel}`,
    subtitle:
      candidate.type === "transfer"
        ? `${candidate.originStop.name} → ${candidate.transferStop.name} → ${candidate.destinationStop.name}`
        : `${candidate.originStop.name} → ${candidate.destinationStop.name}`,
    accent: "#5BA7FF",
    etaLabel: `${etaMinutes} min`,
    price: "Viešasis transportas",
    description:
      candidate.type === "transfer"
        ? `Persėdimas ties ${candidate.transferStop.name}`
        : "Tiesioginis viešojo transporto reisas",
    route: candidate.routeId,
    fromStop: candidate.originStop,
    toStop: candidate.destinationStop,
    transferStop: candidate.transferStop || null,
    journeyBadges:
      candidate.type === "transfer"
        ? [
            { icon: "walk", label: `Walk ${walkToOriginMinutes} min` },
            { icon: "bus", label: candidate.firstVariant.routeLabel },
            { icon: "swap-horizontal", label: `Transfer ${transferWalkMinutes} min` },
            { icon: "bus", label: candidate.secondVariant.routeLabel },
          ]
        : [
            { icon: "walk", label: `Walk ${walkToOriginMinutes} min` },
            { icon: "bus", label: candidate.firstVariant.routeLabel },
            { icon: "walk", label: `Walk ${walkFromDestinationMinutes} min` },
          ],
    summary: {
      totalDurationMinutes,
      walkToOriginMinutes,
      rideMinutes:
        candidate.type === "transfer"
          ? firstRideMinutes + secondRideMinutes
          : firstRideMinutes,
      transferMinutes: transferWalkMinutes,
      walkFromDestinationMinutes,
    },
    liveVehicle: bestVehicle?.vehicle || null,
    previewPoints,
    legs:
      candidate.type === "transfer"
        ? [
            {
              type: "walk",
              fromLabel: "Dabartinė vieta",
              toLabel: candidate.originStop.name,
              distanceMeters: candidate.walkToOrigin,
              durationMinutes: walkToOriginMinutes,
            },
            {
              type: "bus",
              routeId: candidate.firstVariant.routeLabel,
              routeLabel: candidate.firstVariant.routeLabel,
              fromStopId: candidate.originStop.id,
              fromStopName: candidate.originStop.name,
              toStopId: candidate.transferStop.id,
              toStopName: candidate.transferStop.name,
              stopCount: candidate.firstStopCount,
              durationMinutes: firstRideMinutes,
              etaMinutes,
              directionCode: candidate.firstVariant.directionCode || null,
              headsign: candidate.firstVariant.headsign || null,
            },
            {
              type: "transfer",
              atStopId: candidate.transferStop.id,
              atStopName: candidate.transferStop.name,
              durationMinutes: transferWalkMinutes,
            },
            {
              type: "bus",
              routeId: candidate.secondVariant.routeLabel,
              routeLabel: candidate.secondVariant.routeLabel,
              fromStopId: candidate.transferStop.id,
              fromStopName: candidate.transferStop.name,
              toStopId: candidate.destinationStop.id,
              toStopName: candidate.destinationStop.name,
              stopCount: candidate.secondStopCount,
              durationMinutes: secondRideMinutes,
              etaMinutes: null,
              directionCode: candidate.secondVariant.directionCode || null,
              headsign: candidate.secondVariant.headsign || null,
            },
            {
              type: "walk",
              fromLabel: candidate.destinationStop.name,
              toLabel: "Tikslas",
              distanceMeters: candidate.walkFromDestination,
              durationMinutes: walkFromDestinationMinutes,
            },
          ]
        : [
            {
              type: "walk",
              fromLabel: "Dabartinė vieta",
              toLabel: candidate.originStop.name,
              distanceMeters: candidate.walkToOrigin,
              durationMinutes: walkToOriginMinutes,
            },
            {
              type: "bus",
              routeId: candidate.firstVariant.routeLabel,
              routeLabel: candidate.firstVariant.routeLabel,
              fromStopId: candidate.originStop.id,
              fromStopName: candidate.originStop.name,
              toStopId: candidate.destinationStop.id,
              toStopName: candidate.destinationStop.name,
              stopCount: candidate.stopCount,
              durationMinutes: firstRideMinutes,
              etaMinutes,
              directionCode: candidate.firstVariant.directionCode || null,
              headsign: candidate.firstVariant.headsign || null,
            },
            {
              type: "walk",
              fromLabel: candidate.destinationStop.name,
              toLabel: "Tikslas",
              distanceMeters: candidate.walkFromDestination,
              durationMinutes: walkFromDestinationMinutes,
            },
          ],
    journeySteps,
    debug: {
      type: candidate.type,
      routeInternalId: candidate.routeInternalId,
      directionId: candidate.directionId || null,
      headsign: candidate.firstVariant.headsign || null,
      transferRoute:
        candidate.type === "transfer" ? candidate.secondVariant.routeLabel : null,
      matchedVehicleId:
        bestVehicle?.vehicle?.vehicleId || bestVehicle?.vehicle?.id || null,
      candidateVehicles: (bestVehicle?.candidates || []).map((v) => ({
        id: v.vehicle?.vehicleId || v.vehicle?.id || null,
        routeId: v.vehicle?.routeId || v.vehicle?.number || null,
        etaSeconds: v.etaSeconds,
        distanceMeters: v.distanceMeters,
        directionName: v.vehicle?.directionName || null,
      })),
    },
  };
}

async function buildTransitPlan({ origin, destination, userLocation = null }) {
  const [gtfs, vehicles] = await Promise.all([
    loadGtfsData(),
    fetchLiveVehicles().catch(() => []),
  ]);

  const candidates = buildTransitCandidates({ origin, destination, gtfs });
  if (!candidates.length) {
    return {
      gtfsMeta: gtfs.meta,
      options: [],
      best: null,
    };
  }

  const options = candidates
    .slice(0, 8)
    .map((candidate, index) =>
      buildOptionFromCandidate({
        candidate,
        origin,
        destination,
        userLocation,
        vehicles,
        gtfs,
        index,
      })
    )
    .sort(
      (a, b) =>
        a.summary.totalDurationMinutes - b.summary.totalDurationMinutes
    )
    .slice(0, 3);

  return {
    gtfsMeta: gtfs.meta,
    options,
    best: options[0] || null,
  };
}

app.get("/", (_req, res) => {
  res.send("Arbebus backend is running 🚀");
});

app.get("/health", async (_req, res) => {
  try {
    const [news, gtfs] = await Promise.all([buildNewsFeed(), loadGtfsData()]);

    res.json({
      ok: true,
      service: "arbebus-backend",
      now: new Date().toISOString(),
      news: news.meta,
      leaveAlerts: {
        active: listActiveLeaveAlerts().length,
      },
      gtfs: gtfs.meta,
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
      responseType: "text",
      headers: {
        "User-Agent": "Arbebus/1.0",
      },
    });

    const buses = parseGPS(response.data);
    res.json(buses);
  } catch (error) {
    console.error("GPS fetch failed:", error.message);
    res.status(500).json({ error: "Failed to fetch GPS" });
  }
});

app.get("/transit/gtfs-status", async (req, res) => {
  try {
    let loader;

    try {
      loader = require("./services/transit/gtfsLoader");
    } catch (e) {
      return res.json({
        ok: false,
        error: "Loader not found",
      });
    }

    if (!loader || typeof loader.getStatus !== "function") {
      return res.json({
        ok: false,
        error: "GTFS loader not initialized",
      });
    }

    const status = loader.getStatus();

    return res.json({
      ok: true,
      status,
    });
  } catch (err) {
    console.error("GTFS STATUS ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.post("/transit/plan", async (req, res) => {
  try {
    const origin = normalizeCoordinate(req.body?.origin);
    const destination = normalizeCoordinate(req.body?.destination);
    const userLocation = normalizeCoordinate(req.body?.userLocation);

    if (!origin || !destination) {
      return res.status(400).json({
        ok: false,
        error: "origin and destination are required",
      });
    }

    const result = await buildTransitPlan({
      origin,
      destination,
      userLocation,
    });

    if (!result?.best) {
      return res.status(404).json({
        ok: false,
        error: "No transit journey found",
        gtfs: result?.gtfsMeta || null,
      });
    }

    res.json({
      ok: true,
      plan: result.best,
      options: result.options,
      gtfs: result.gtfsMeta,
      refreshedAt: Date.now(),
    });
  } catch (error) {
    console.error("POST /transit/plan error:", error.message);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/news", async (_req, res) => {
  try {
    const feed = await buildNewsFeed();

    res.json({
      items: Array.isArray(feed.items) ? feed.items : [],
      meta: feed.meta || {
        partial: false,
        sections: {},
        errors: [],
      },
    });
  } catch (error) {
    console.error("GET /news error:", error.message);

    res.status(500).json({
      items: [],
      meta: {
        partial: true,
        sections: {
          world: "error",
          transport: "error",
          deal: "error",
          update: "error",
        },
        errors: [{ section: "news", message: error.message }],
      },
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

try {
  startLeaveAlertEngine();
} catch (error) {
  console.error("startLeaveAlertEngine failed:", error);
}

app.listen(PORT, HOST, () => {
  console.log(`🚀 Running on http://${HOST}:${PORT}`);
});