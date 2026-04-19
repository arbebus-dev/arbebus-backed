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
const TRANSFER_RADIUS_METERS = Number(process.env.TRANSFER_RADIUS_METERS || 350);

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
      coordinate: { latitude, longitude },
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

function estimateRideMinutes(stopCount, mode = "bus") {
  const perStopSeconds = mode === "train" ? 150 : 110;
  return Math.max(mode === "train" ? 6 : 3, Math.round((stopCount * perStopSeconds) / 60));
}

function modeFromRouteType(routeType) {
  switch (Number(routeType)) {
    case 2:
      return "train";
    case 0:
    case 1:
    case 3:
    case 11:
      return "bus";
    default:
      return "bus";
  }
}

function iconFromMode(mode) {
  switch (mode) {
    case "train":
      return "train";
    case "walk":
      return "walk";
    case "transfer":
      return "swap-horizontal";
    case "bus":
    default:
      return "bus";
  }
}

function formatLegLabel(mode, routeLabel) {
  if (mode === "train") return `Traukinys ${routeLabel}`;
  return `Autobusas ${routeLabel}`;
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

function enrichVariant(variant) {
  const mode = modeFromRouteType(variant.routeType);
  return {
    ...variant,
    mode,
    agencyName: variant.agencyName || null,
  };
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

  const mode = modeFromRouteType(variant.routeType);
  const stopCount = alightIndex - boardIndex;
  const walkToOrigin = boardStop.distanceMeters;
  const walkFromDestination = alightStop.distanceMeters;
  const transferPenalty = mode === "train" ? 30 : 0;

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
    estimatedBusSeconds: Math.max(mode === "train" ? 300 : 180, stopCount * (mode === "train" ? 150 : 110)),
    score:
      walkToOrigin +
      walkFromDestination +
      stopCount * (mode === "train" ? 140 : 100) +
      transferPenalty +
      (variant.directionId === null ? 50 : 0),
    firstVariant: enrichVariant(variant),
    secondVariant: null,
    transferStop: null,
    transferBoardStop: null,
  };
}

function makeTransferCandidate({
  firstVariant,
  secondVariant,
  boardStop,
  transferAlightStop,
  transferBoardStop,
  alightStop,
}) {
  const boardIndex = firstVariant.stopIndexByStopId.get(boardStop.id);
  const transferIndex1 = firstVariant.stopIndexByStopId.get(transferAlightStop.id);
  const transferIndex2 = secondVariant.stopIndexByStopId.get(transferBoardStop.id);
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

  const firstMode = modeFromRouteType(firstVariant.routeType);
  const secondMode = modeFromRouteType(secondVariant.routeType);
  const firstStopCount = transferIndex1 - boardIndex;
  const secondStopCount = alightIndex - transferIndex2;
  const walkToOrigin = boardStop.distanceMeters;
  const walkFromDestination = alightStop.distanceMeters;
  const transferWalkMeters = Math.round(
    distanceMeters(
      { latitude: transferAlightStop.latitude, longitude: transferAlightStop.longitude },
      { latitude: transferBoardStop.latitude, longitude: transferBoardStop.longitude }
    )
  );
  const transferWalkMinutes = estimateWalkMinutes(Math.max(transferWalkMeters, 60));
  const estimatedBusSeconds =
    Math.max(firstMode === "train" ? 300 : 180, firstStopCount * (firstMode === "train" ? 150 : 110)) +
    Math.max(secondMode === "train" ? 300 : 180, secondStopCount * (secondMode === "train" ? 150 : 110));

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
    transferStop: transferAlightStop,
    transferBoardStop,
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
    firstVariant: enrichVariant(firstVariant),
    secondVariant: enrichVariant(secondVariant),
  };
}

function getTransferStopOptions(gtfs, stop) {
  const options = [
    {
      ...stop,
      distanceMeters: 0,
    },
  ];

  for (const candidate of gtfs.stopsById.values()) {
    if (candidate.id === stop.id) continue;

    const transferDistance = Math.round(
      distanceMeters(
        { latitude: stop.latitude, longitude: stop.longitude },
        { latitude: candidate.latitude, longitude: candidate.longitude }
      )
    );

    if (transferDistance <= TRANSFER_RADIUS_METERS) {
      options.push({
        ...candidate,
        distanceMeters: transferDistance,
      });
    }
  }

  return options.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 12);
}

function buildTransitCandidates({ origin, destination, gtfs }) {
  const originStops = getNearbyStops(origin, gtfs, 1100, 10);
  const destinationStops = getNearbyStops(destination, gtfs, 1100, 10);

  const direct = [];
  const transfers = [];

  for (const boardStop of originStops) {
    const originVariants = gtfs.activeVariantsByStopId.get(boardStop.id) || [];

    for (const alightStop of destinationStops) {
      if (boardStop.id === alightStop.id) continue;

      const destinationVariants = gtfs.activeVariantsByStopId.get(alightStop.id) || [];
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

          const transferBoardCandidates = getTransferStopOptions(gtfs, transferStopBase);

          for (const transferBoardStop of transferBoardCandidates) {
            const secondVariants = gtfs.activeVariantsByStopId.get(transferBoardStop.id) || [];

            for (const secondVariant of secondVariants) {
              if (secondVariant.id === variant.id) continue;
              if (!secondVariant.stopIndexByStopId.has(alightStop.id)) continue;

              const candidate = makeTransferCandidate({
                firstVariant: variant,
                secondVariant,
                boardStop,
                transferAlightStop: {
                  ...transferStopBase,
                  distanceMeters: 0,
                },
                transferBoardStop,
                alightStop,
              });

              if (candidate) transfers.push(candidate);
            }
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
      candidate.transferStop?.id || "",
      candidate.transferBoardStop?.id || "",
      candidate.destinationStop.id,
    ].join("|");

    const existing = dedupe.get(key);
    if (!existing || candidate.score < existing.score) {
      dedupe.set(key, candidate);
    }
  }

  return Array.from(dedupe.values()).sort((a, b) => a.score - b.score);
}

function computeJourneyStage({ userLocation, candidate, etaMinutes }) {
  const toBoardStopMeters = Math.round(
    distanceMeters(userLocation, {
      latitude: candidate.originStop.latitude,
      longitude: candidate.originStop.longitude,
    })
  );

  const toDestinationStopMeters = Math.round(
    distanceMeters(userLocation, {
      latitude: candidate.destinationStop.latitude,
      longitude: candidate.destinationStop.longitude,
    })
  );

  const nearBoardStop = toBoardStopMeters <= 35;
  const nearDestinationStop = toDestinationStopMeters <= 60;

  if (nearDestinationStop) {
    return {
      stage: "final_walk",
      message: "Jau beveik išlipimo stotelė",
    };
  }

  if (nearBoardStop && etaMinutes != null && etaMinutes <= 1) {
    return {
      stage: "board_now",
      message: "Lipk dabar",
    };
  }

  if (nearBoardStop && etaMinutes != null && etaMinutes <= 3) {
    return {
      stage: "ready_to_board",
      message: "Pasiruošk lipti",
    };
  }

  if (candidate.type === "transfer") {
    const secondMode = candidate.secondVariant?.mode === "train" ? "traukinį" : "autobusą";
    return {
      stage: "transfer_expected",
      message: `Bus persėdimas ${candidate.transferBoardStop?.name || candidate.transferStop.name} į ${secondMode}`,
    };
  }

  return {
    stage: "walking_to_board",
    message: `Eik į ${candidate.originStop.name}`,
  };
}

function detectMissedStop({ userLocation, candidate }) {
  const boardStopDistance = Math.round(
    distanceMeters(userLocation, {
      latitude: candidate.originStop.latitude,
      longitude: candidate.originStop.longitude,
    })
  );

  const destinationStopDistance = Math.round(
    distanceMeters(userLocation, {
      latitude: candidate.destinationStop.latitude,
      longitude: candidate.destinationStop.longitude,
    })
  );

  if (boardStopDistance > 250 && destinationStopDistance > boardStopDistance + 120) {
    return true;
  }

  return false;
}

function buildAlertSignals({
  candidate,
  etaMinutes,
  boardingStage,
  missedStop,
  stopsRemaining,
}) {
  const alerts = [];

  if (missedStop) {
    alerts.push({
      type: "reroute_needed",
      priority: "high",
      title: "Perskaičiuojamas maršrutas",
      message: "Atrodo, kad praleidai stotelę arba nuėjai nuo maršruto.",
    });
  }

  if (boardingStage === "walking_to_board" && etaMinutes != null && etaMinutes <= 6) {
    alerts.push({
      type: "leave_now",
      priority: "medium",
      title: "Laikas eiti",
      message: `Eik į ${candidate.originStop.name}, ${formatLegLabel(candidate.firstVariant.mode, candidate.firstVariant.routeLabel).toLowerCase()} atvyks maždaug po ${etaMinutes} min.`,
    });
  }

  if (boardingStage === "ready_to_board" || boardingStage === "board_now") {
    alerts.push({
      type: "board_now",
      priority: "high",
      title: candidate.firstVariant.mode === "train" ? "Lipk į traukinį" : "Lipk dabar",
      message: `${formatLegLabel(candidate.firstVariant.mode, candidate.firstVariant.routeLabel)} jau beveik prie ${candidate.originStop.name}.`,
    });
  }

  if (candidate.type === "transfer" && stopsRemaining != null && stopsRemaining <= 2) {
    alerts.push({
      type: "transfer_soon",
      priority: "high",
      title: "Tuoj persėdimas",
      message: `Ruoškis persėsti ${candidate.transferBoardStop?.name || candidate.transferStop.name}.`,
    });
  }

  if (candidate.type !== "transfer" && stopsRemaining != null && stopsRemaining <= 2) {
    alerts.push({
      type: "get_off_soon",
      priority: "high",
      title: "Tuoj išlipk",
      message: `Ruoškis išlipti ${candidate.destinationStop.name}.`,
    });
  }

  return alerts;
}

function buildJourneyStepsFromCandidate(candidate, timing) {
  if (candidate.type === "transfer") {
    return [
      {
        type: "walk",
        icon: iconFromMode("walk"),
        title: `Eik iki ${candidate.originStop.name}`,
        subtitle: `${timing.walkToOriginMinutes} min • ${candidate.originStop.distanceMeters} m`,
      },
      {
        type: candidate.firstVariant.mode,
        icon: iconFromMode(candidate.firstVariant.mode),
        title: formatLegLabel(candidate.firstVariant.mode, candidate.firstVariant.routeLabel),
        subtitle:
          timing.etaMinutes != null && candidate.firstVariant.mode === "bus"
            ? `Atvyks po ${timing.etaMinutes} min • kryptis ${candidate.firstVariant.headsign || candidate.firstVariant.directionCode || ""}`
            : `Kryptis ${candidate.firstVariant.headsign || candidate.firstVariant.directionCode || ""}`,
      },
      {
        type: "transfer",
        icon: iconFromMode("transfer"),
        title:
          candidate.transferBoardStop && candidate.transferBoardStop.id !== candidate.transferStop.id
            ? `Persėsk ${candidate.transferBoardStop.name}`
            : `Persėsk ${candidate.transferStop.name}`,
        subtitle:
          candidate.transferBoardStop && candidate.transferBoardStop.id !== candidate.transferStop.id
            ? `${timing.transferWalkMinutes} min • ${candidate.transferStop.name} → ${candidate.transferBoardStop.name}`
            : `${timing.transferWalkMinutes} min • į ${formatLegLabel(candidate.secondVariant.mode, candidate.secondVariant.routeLabel).toLowerCase()}`,
      },
      {
        type: candidate.secondVariant.mode,
        icon: iconFromMode(candidate.secondVariant.mode),
        title: formatLegLabel(candidate.secondVariant.mode, candidate.secondVariant.routeLabel),
        subtitle: `Kryptis ${candidate.secondVariant.headsign || candidate.secondVariant.directionCode || ""} • ${timing.secondRideMinutes} min`,
      },
      {
        type: "walk",
        icon: iconFromMode("walk"),
        title: `Išlipk ${candidate.destinationStop.name}`,
        subtitle: `${timing.walkFromDestinationMinutes} min pėsčiomis iki tikslo`,
      },
    ];
  }

  return [
    {
      type: "walk",
      icon: iconFromMode("walk"),
      title: `Eik iki ${candidate.originStop.name}`,
      subtitle: `${timing.walkToOriginMinutes} min • ${candidate.originStop.distanceMeters} m`,
    },
    {
      type: candidate.firstVariant.mode,
      icon: iconFromMode(candidate.firstVariant.mode),
      title: formatLegLabel(candidate.firstVariant.mode, candidate.firstVariant.routeLabel),
      subtitle:
        timing.etaMinutes != null && candidate.firstVariant.mode === "bus"
          ? `Atvyks po ${timing.etaMinutes} min • ${candidate.firstVariant.headsign || candidate.firstVariant.directionCode || ""}`
          : `${candidate.firstVariant.headsign || candidate.firstVariant.directionCode || ""}`,
    },
    {
      type: "walk",
      icon: iconFromMode("walk"),
      title: `Išlipk ${candidate.destinationStop.name}`,
      subtitle: `${timing.walkFromDestinationMinutes} min pėsčiomis iki tikslo`,
    },
  ];
}

function buildFallbackOption({ origin, destination, userLocation, vehicles, gtfs }) {
  const currentLocation = userLocation || origin;
  const originStops = getNearbyStops(origin, gtfs, 900, 6);
  const destinationStops = getNearbyStops(destination, gtfs, 900, 6);
  const originStop = originStops[0] || null;
  const destinationStop = destinationStops[0] || null;

  if (!originStop || !destinationStop) {
    return null;
  }

  let bestLive = null;
  let bestDistance = Infinity;

  for (const vehicle of Array.isArray(vehicles) ? vehicles : []) {
    const dist = distanceMeters(
      { latitude: vehicle.latitude, longitude: vehicle.longitude },
      { latitude: originStop.latitude, longitude: originStop.longitude }
    );

    if (dist < bestDistance) {
      bestDistance = dist;
      bestLive = vehicle;
    }
  }

  const etaSeconds = bestLive ? Math.max(60, Math.round(bestDistance / 6.5)) : null;
  const etaMinutes = etaSeconds != null ? Math.max(1, Math.round(etaSeconds / 60)) : null;
  const walkToOriginMinutes = estimateWalkMinutes(originStop.distanceMeters);
  const walkFromDestinationMinutes = estimateWalkMinutes(destinationStop.distanceMeters);
  const totalBusMinutes = 10;
  const totalDurationMinutes = walkToOriginMinutes + walkFromDestinationMinutes + totalBusMinutes + (etaMinutes || 5);

  return {
    id: "fallback-live-transit",
    mode: "bus",
    routeId: bestLive?.routeId || bestLive?.route || "LIVE",
    summary: {
      totalDurationMinutes,
      totalWalkMinutes: walkToOriginMinutes + walkFromDestinationMinutes,
      totalBusMinutes,
      boardStopName: originStop.name,
      alightStopName: destinationStop.name,
      routeLabel: bestLive?.routeId || bestLive?.route || "LIVE",
      etaMinutes,
      stopCount: 0,
      transfersCount: 0,
      directionCode: null,
      headsign: bestLive?.directionName || null,
      boardingState: "walking_to_board",
      nextStopName: null,
      journeyMessage: `Eik į ${originStop.name}${bestLive ? ` ir lauk ${formatLegLabel("bus", bestLive.routeId || bestLive.route || "")}` : ""}`,
      missedStop: false,
      approximateStopsRemaining: null,
      alertSignals: [],
      modes: ["bus"],
    },
    originStop,
    destinationStop,
    liveVehicle: bestLive || null,
    previewPoints: [
      origin,
      { latitude: originStop.latitude, longitude: originStop.longitude },
      { latitude: destinationStop.latitude, longitude: destinationStop.longitude },
      destination,
    ],
    legs: [
      {
        type: "walk",
        mode: "walk",
        fromLabel: "Dabartinė vieta",
        toLabel: originStop.name,
        distanceMeters: originStop.distanceMeters,
        durationMinutes: walkToOriginMinutes,
      },
      {
        type: "bus",
        mode: "bus",
        routeId: bestLive?.routeId || bestLive?.route || "LIVE",
        routeLabel: bestLive?.routeId || bestLive?.route || "LIVE",
        fromStopId: originStop.id,
        fromStopName: originStop.name,
        toStopId: destinationStop.id,
        toStopName: destinationStop.name,
        stopCount: 0,
        durationMinutes: totalBusMinutes,
        etaMinutes,
        directionCode: null,
        headsign: bestLive?.directionName || null,
      },
      {
        type: "walk",
        mode: "walk",
        fromLabel: destinationStop.name,
        toLabel: "Tikslas",
        distanceMeters: destinationStop.distanceMeters,
        durationMinutes: walkFromDestinationMinutes,
      },
    ],
    journeySteps: [
      {
        type: "walk",
        icon: "walk",
        title: `Eik iki ${originStop.name}`,
        subtitle: `${walkToOriginMinutes} min • ${originStop.distanceMeters} m`,
      },
      {
        type: "bus",
        icon: "bus",
        title: bestLive ? `Lipk į autobusą ${bestLive.routeId || bestLive.route || ""}` : "Lauk artimiausio autobuso",
        subtitle: bestLive
          ? `${bestLive.directionName || "Live GPS"}${etaMinutes != null ? ` • po ${etaMinutes} min` : ""}`
          : "Live autobusas šiuo metu neaptiktas prie stotelės",
      },
      {
        type: "walk",
        icon: "walk",
        title: `Išlipk ${destinationStop.name}`,
        subtitle: `${walkFromDestinationMinutes} min pėsčiomis iki tikslo`,
      },
    ],
    debug: {
      type: "fallback",
      matchedVehicleId: bestLive?.vehicleId || bestLive?.id || null,
    },
  };
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
  const bestVehicle =
    candidate.firstVariant.mode === "bus"
      ? pickBestVehicleForStop({
          vehicles,
          routeId: candidate.firstVariant.routeLabel,
          stop: candidate.originStop,
          destinationStop: candidate.transferStop || candidate.destinationStop,
          headsign: candidate.firstVariant.headsign,
        })
      : null;

  const etaSeconds = bestVehicle?.etaSeconds ?? null;
  const etaMinutes = etaSeconds != null ? Math.max(1, Math.round(etaSeconds / 60)) : null;

  const walkToOriginMinutes = estimateWalkMinutes(candidate.walkToOrigin);
  const walkFromDestinationMinutes = estimateWalkMinutes(candidate.walkFromDestination);

  const firstRideMinutes = estimateRideMinutes(
    candidate.type === "transfer" ? candidate.firstStopCount : candidate.stopCount,
    candidate.firstVariant.mode
  );

  const secondRideMinutes =
    candidate.type === "transfer"
      ? estimateRideMinutes(candidate.secondStopCount, candidate.secondVariant.mode)
      : 0;

  const transferWalkMinutes = candidate.type === "transfer" ? candidate.transferWalkMinutes : 0;
  const transferWaitMinutes = candidate.type === "transfer" ? (candidate.secondVariant.mode === "train" ? 8 : 4) : 0;

  const totalBusMinutes = firstRideMinutes + secondRideMinutes;
  const totalWalkMinutes = walkToOriginMinutes + walkFromDestinationMinutes + transferWalkMinutes;
  const totalDurationMinutes = totalWalkMinutes + totalBusMinutes + (etaMinutes || (candidate.firstVariant.mode === "train" ? 12 : 4)) + transferWaitMinutes;

  const currentLocation = userLocation || origin;

  const stageInfo = computeJourneyStage({
    userLocation: currentLocation,
    candidate,
    etaMinutes,
  });

  const missedStop = detectMissedStop({ userLocation: currentLocation, candidate });

  const nextStopName =
    candidate.type === "transfer"
      ? (candidate.transferBoardStop?.name || candidate.transferStop.name)
      : gtfs.stopsById.get(
          candidate.firstVariant.stopIds[
            Math.min(candidate.firstVariant.stopIds.length - 1, candidate.boardIndex + 1)
          ]
        )?.name || null;

  const toDestinationStopMeters = Math.round(
    distanceMeters(currentLocation, {
      latitude: candidate.destinationStop.latitude,
      longitude: candidate.destinationStop.longitude,
    })
  );

  const approximateStopsRemaining = Math.max(0, Math.round(toDestinationStopMeters / (candidate.firstVariant.mode === "train" ? 1800 : 700)));

  const alertSignals = buildAlertSignals({
    candidate,
    etaMinutes,
    boardingStage: stageInfo.stage,
    missedStop,
    stopsRemaining: approximateStopsRemaining,
  });

  const summary = {
    totalDurationMinutes,
    totalWalkMinutes,
    totalBusMinutes,
    boardStopName: candidate.originStop.name,
    alightStopName: candidate.destinationStop.name,
    routeLabel: candidate.routeId,
    etaMinutes,
    stopCount: candidate.stopCount,
    transfersCount: candidate.type === "transfer" ? 1 : 0,
    directionCode: candidate.firstVariant.directionCode || null,
    headsign: candidate.firstVariant.headsign || null,
    boardingState: stageInfo.stage,
    nextStopName,
    journeyMessage: stageInfo.message,
    missedStop,
    approximateStopsRemaining,
    alertSignals,
    modes:
      candidate.type === "transfer"
        ? [candidate.firstVariant.mode, candidate.secondVariant.mode]
        : [candidate.firstVariant.mode],
  };

  const journeySteps = buildJourneyStepsFromCandidate(candidate, {
    walkToOriginMinutes,
    walkFromDestinationMinutes,
    transferWalkMinutes,
    firstRideMinutes,
    secondRideMinutes,
    etaMinutes,
  });

  const busShape1 = sliceShapeBetweenStops(
    gtfs,
    candidate.firstVariant,
    candidate.originStop,
    candidate.type === "transfer" ? candidate.transferStop : candidate.destinationStop
  );

  const busShape2 =
    candidate.type === "transfer"
      ? sliceShapeBetweenStops(gtfs, candidate.secondVariant, candidate.transferBoardStop || candidate.transferStop, candidate.destinationStop)
      : [];

  const previewPoints =
    candidate.type === "transfer"
      ? [
          origin,
          { latitude: candidate.originStop.latitude, longitude: candidate.originStop.longitude },
          ...busShape1,
          { latitude: candidate.transferStop.latitude, longitude: candidate.transferStop.longitude },
          ...(candidate.transferBoardStop && candidate.transferBoardStop.id !== candidate.transferStop.id
            ? [{ latitude: candidate.transferBoardStop.latitude, longitude: candidate.transferBoardStop.longitude }]
            : []),
          ...busShape2,
          { latitude: candidate.destinationStop.latitude, longitude: candidate.destinationStop.longitude },
          destination,
        ]
      : [
          origin,
          { latitude: candidate.originStop.latitude, longitude: candidate.originStop.longitude },
          ...busShape1,
          { latitude: candidate.destinationStop.latitude, longitude: candidate.destinationStop.longitude },
          destination,
        ];

  return {
    id: `option-${index + 1}-${candidate.routeId.replace(/\s+/g, "-")}`,
    mode: "bus",
    routeId: candidate.routeId,
    summary,
    originStop: {
      ...candidate.originStop,
      distanceMeters: candidate.originStop.distanceMeters,
    },
    destinationStop: {
      ...candidate.destinationStop,
      distanceMeters: candidate.destinationStop.distanceMeters,
    },
    liveVehicle: bestVehicle?.vehicle || null,
    previewPoints,
    legs:
      candidate.type === "transfer"
        ? [
            {
              type: "walk",
              mode: "walk",
              fromLabel: "Dabartinė vieta",
              toLabel: candidate.originStop.name,
              distanceMeters: candidate.walkToOrigin,
              durationMinutes: walkToOriginMinutes,
            },
            {
              type: candidate.firstVariant.mode,
              mode: candidate.firstVariant.mode,
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
              agencyName: candidate.firstVariant.agencyName || null,
            },
            {
              type: "transfer",
              mode: "transfer",
              atStopId: candidate.transferStop.id,
              atStopName: candidate.transferStop.name,
              toStopId: candidate.transferBoardStop?.id || candidate.transferStop.id,
              toStopName: candidate.transferBoardStop?.name || candidate.transferStop.name,
              distanceMeters: candidate.transferWalkMeters,
              durationMinutes: transferWalkMinutes,
            },
            {
              type: candidate.secondVariant.mode,
              mode: candidate.secondVariant.mode,
              routeId: candidate.secondVariant.routeLabel,
              routeLabel: candidate.secondVariant.routeLabel,
              fromStopId: (candidate.transferBoardStop || candidate.transferStop).id,
              fromStopName: (candidate.transferBoardStop || candidate.transferStop).name,
              toStopId: candidate.destinationStop.id,
              toStopName: candidate.destinationStop.name,
              stopCount: candidate.secondStopCount,
              durationMinutes: secondRideMinutes,
              etaMinutes: null,
              directionCode: candidate.secondVariant.directionCode || null,
              headsign: candidate.secondVariant.headsign || null,
              agencyName: candidate.secondVariant.agencyName || null,
            },
            {
              type: "walk",
              mode: "walk",
              fromLabel: candidate.destinationStop.name,
              toLabel: "Tikslas",
              distanceMeters: candidate.walkFromDestination,
              durationMinutes: walkFromDestinationMinutes,
            },
          ]
        : [
            {
              type: "walk",
              mode: "walk",
              fromLabel: "Dabartinė vieta",
              toLabel: candidate.originStop.name,
              distanceMeters: candidate.walkToOrigin,
              durationMinutes: walkToOriginMinutes,
            },
            {
              type: candidate.firstVariant.mode,
              mode: candidate.firstVariant.mode,
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
              agencyName: candidate.firstVariant.agencyName || null,
            },
            {
              type: "walk",
              mode: "walk",
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
      transferRoute: candidate.type === "transfer" ? candidate.secondVariant.routeLabel : null,
      transferMode: candidate.type === "transfer" ? candidate.secondVariant.mode : null,
      matchedVehicleId: bestVehicle?.vehicle?.vehicleId || bestVehicle?.vehicle?.id || null,
      sourceModes: summary.modes,
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

  const options = candidates
    .slice(0, 12)
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
    .sort((a, b) => a.summary.totalDurationMinutes - b.summary.totalDurationMinutes)
    .slice(0, 4);

  if (!options.length) {
    const fallback = buildFallbackOption({ origin, destination, userLocation, vehicles, gtfs });
    return {
      gtfsMeta: gtfs.meta,
      options: fallback ? [fallback] : [],
      best: fallback,
    };
  }

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

app.get("/transit/gtfs-status", async (_req, res) => {
  try {
    const gtfs = await loadGtfsData();
    res.json({
      ok: true,
      gtfs: gtfs.meta,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
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

    const result = await buildTransitPlan({ origin, destination, userLocation });

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

app.get("/leave-alerts", (_req, res) => {
  try {
    res.json({
      ok: true,
      alerts: listActiveLeaveAlerts(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/transit/gtfs-status", async (req, res) => {
  try {
    const loader = require("./services/transit/gtfsLoader");

    if (!loader || !loader.getStatus) {
      return res.json({
        loaded: false,
        error: "GTFS loader not initialized",
      });
    }

    const status = loader.getStatus();

    return res.json({
      loaded: true,
      ...status,
    });
  } catch (e) {
    console.error("GTFS STATUS ERROR:", e);

    return res.json({
      loaded: false,
      error: e.message,
    });
  }
});


app.post("/leave-alerts", async (req, res) => {
  try {
    const payload = req.body || {};
    const alert = await createOrReplaceLeaveAlert(payload);
    res.json({ ok: true, alert });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.delete("/leave-alerts/:id", async (req, res) => {
  try {
    const removed = await cancelLeaveAlert(req.params.id);
    res.json({ ok: true, removed });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

startLeaveAlertEngine().catch((error) => {
  console.error("Leave alert engine failed to start:", error.message);
});

app.listen(PORT, HOST, () => {
  console.log(`Arbebus backend running on http://${HOST}:${PORT}`);
});
