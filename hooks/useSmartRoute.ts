import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../constants/api";
import { fetchTransitPlanFromApi } from "../core/services/transit/plannerApi";
import type { TransitPlan } from "../core/services/transit/plannerTypes";
import { AIRPORTS, ORS_API_KEY } from "../constants/home";
import {
  JourneyAlertSignal,
  buildJourneyKey,
  dispatchTransitAlertsAsync,
  ensurePushRegistrationAsync,
} from "../core/services/notifications/transitNotificationService";
import { LiveBus, TravelMode } from "../types/home";

type AiMode = "bus" | "taxi" | "walk" | "train";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type PlaceLike = {
  id: string;
  title: string;
  subtitle: string;
  coordinate: Coordinate;
};

export type JourneyBadge = {
  icon: string;
  label: string;
};

export type JourneyStep = {
  icon: string;
  title: string;
  subtitle: string;
  kind?: "walk_to_stop" | "wait_board" | "ride" | "alight" | "walk_to_destination" | "info";
  targetCoordinate?: Coordinate | null;
  targetRadiusMeters?: number;
};

export type Recommendation = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  price: string;
  etaLabel: string;
  description: string;
  accent: string;
  rightIcons: string[];
  mode: AiMode | TravelMode;
  journeyBadges?: JourneyBadge[];
  journeySteps?: JourneyStep[];
  notice?: string;
};

type UseSmartRouteParams = {
  selectedMode: TravelMode;
  liveBuses: LiveBus[];
  selectedBus: LiveBus | null;
  isPro: boolean;
  pickup: PlaceLike | null;
  destinationPlace: PlaceLike | null;
  setExternalRoute: (route: {
    pickup: {
      id: string;
      title: string;
      subtitle: string;
      coordinate: Coordinate;
    };
    destination: {
      id: string;
      title: string;
      subtitle: string;
      coordinate: Coordinate;
    };
    polyline: Coordinate[];
  }) => void;
};

type RouteFetchResult = {
  coords: Coordinate[];
  distanceKm: number;
  durationMin: number;
};


function formatPrice(value: number) {
  return `€${value.toFixed(2)}`;
}

function clampEta(value: number) {
  return Math.max(1, Math.round(value));
}

function parseEtaLabelToMinutes(value?: string | null) {
  if (!value) return 7;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 7;
}

function getDistanceMeters(start: Coordinate, end: Coordinate) {
  const R = 6371000;
  const dLat = ((end.latitude - start.latitude) * Math.PI) / 180;
  const dLon = ((end.longitude - start.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((start.latitude * Math.PI) / 180) *
      Math.cos((end.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDistanceKm(start: Coordinate, end: Coordinate) {
  return getDistanceMeters(start, end) / 1000;
}

function estimateTaxiPrice(distanceKm: number, durationMin: number) {
  const base = 2.2;
  const perKm = 0.95;
  const perMin = 0.16;
  return base + distanceKm * perKm + durationMin * perMin;
}

function estimateScooterPrice(durationMin: number) {
  const unlock = 0.5;
  const perMin = 0.22;
  return unlock + durationMin * perMin;
}

function pointToSegmentDistanceMeters(
  point: Coordinate,
  start: Coordinate,
  end: Coordinate
) {
  const ax = start.longitude;
  const ay = start.latitude;
  const bx = end.longitude;
  const by = end.latitude;
  const px = point.longitude;
  const py = point.latitude;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    return getDistanceMeters(point, start);
  }

  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const proj = {
    longitude: ax + abx * t,
    latitude: ay + aby * t,
  };

  return getDistanceMeters(point, proj);
}

function distanceToPolylineMeters(point: Coordinate, polyline: Coordinate[]) {
  if (!polyline.length) return Infinity;
  if (polyline.length === 1) return getDistanceMeters(point, polyline[0]);

  let best = Infinity;

  for (let i = 0; i < polyline.length - 1; i += 1) {
    const distance = pointToSegmentDistanceMeters(
      point,
      polyline[i],
      polyline[i + 1]
    );

    if (distance < best) {
      best = distance;
    }
  }

  return best;
}

function buildTaxiJourneyMeta({
  pickup,
  destinationPlace,
}: {
  pickup: PlaceLike;
  destinationPlace: PlaceLike;
}) {
  return {
    journeyBadges: [
      { icon: "taxi", label: "Taxi" },
      { icon: "navigation-variant", label: "Direct" },
    ],
    journeySteps: [
      {
        icon: "map-marker",
        title: pickup.title || pickup.subtitle || "Current location",
        subtitle: "Vairuotojas pasiima iš tavo vietos",
      },
      {
        icon: "car",
        title: "Direct ride",
        subtitle: "Tiesioginis važiavimas iki tikslo",
      },
      {
        icon: "flag-checkered",
        title:
          destinationPlace.title || destinationPlace.subtitle || "Destination",
        subtitle: "Atvykimas be persėdimų",
      },
    ],
    notice: "Taxi užsakymas atidaromas per Bolt arba kitą ride-hailing flow.",
  };
}

function buildScooterJourneyMeta({
  pickup,
  destinationPlace,
}: {
  pickup: PlaceLike;
  destinationPlace: PlaceLike;
}) {
  return {
    journeyBadges: [
      { icon: "scooter", label: "Scooter" },
      { icon: "walk", label: "Walk 2 min" },
    ],
    journeySteps: [
      {
        icon: "map-marker",
        title: pickup.title || pickup.subtitle || "Current location",
        subtitle: "Rask artimiausią paspirtuką",
      },
      {
        icon: "scooter",
        title: "Scooter ride",
        subtitle: "Lankstus miesto maršrutas be tvarkaraščio",
      },
      {
        icon: "flag-checkered",
        title:
          destinationPlace.title || destinationPlace.subtitle || "Destination",
        subtitle: "Pastatyk ir užbaik kelionę",
      },
    ],
    notice: "Kaina gali keistis pagal operatorių, unlock mokestį ir laiką.",
  };
}

function buildWalkJourneyMeta({
  pickup,
  destinationPlace,
  walkingEta,
}: {
  pickup: PlaceLike;
  destinationPlace: PlaceLike;
  walkingEta: number;
}) {
  return {
    journeyBadges: [
      { icon: "walk", label: `Walk ${walkingEta} min` },
      { icon: "map-marker-path", label: "Direct path" },
    ],
    journeySteps: [
      {
        icon: "map-marker",
        title: pickup.title || pickup.subtitle || "Current location",
        subtitle: "Pradžios taškas",
      },
      {
        icon: "walk",
        title: "Walking route",
        subtitle: "Tiesiausias maršrutas pėsčiomis",
      },
      {
        icon: "flag-checkered",
        title:
          destinationPlace.title || destinationPlace.subtitle || "Destination",
        subtitle: "Atvykimas pėsčiomis",
      },
    ],
    notice: "Trumpiausias variantas be papildomų išlaidų.",
  };
}

function getBoardingStateLabel(state?: string | null) {
  switch (state) {
    case "board_now":
      return "Lipk dabar";
    case "ready_to_board":
      return "Pasiruošk lipti";
    case "transfer_expected":
      return "Bus persėdimas";
    case "final_walk":
      return "Galutinis ėjimas";
    case "walking_to_board":
    default:
      return "Eik į stotelę";
  }
}

function buildAlertNotice(alertSignals?: JourneyAlertSignal[]) {
  if (!alertSignals?.length) return "";
  const top = alertSignals[0];
  return `${top.title}: ${top.message}`;
}

function buildTransitMeta({
  pickup,
  destinationPlace,
  transitPlan,
  selectedBus,
  isRefreshing,
  transitOptionsCount,
}: {
  pickup: PlaceLike;
  destinationPlace: PlaceLike;
  transitPlan: TransitPlan;
  selectedBus: LiveBus | null;
  isRefreshing: boolean;
  transitOptionsCount: number;
}) {
  const includesTrain = (transitPlan.summary.modes || []).includes("train");

  const etaLabel =
    transitPlan.summary.etaMinutes != null
      ? `Atvyks po ${transitPlan.summary.etaMinutes} min`
      : includesTrain
      ? "Tvarkaraštinis atvykimas"
      : "Live ETA dar skaičiuojamas";

  const routeDirection =
    transitPlan.summary.headsign ||
    selectedBus?.directionName ||
    transitPlan.liveVehicle?.directionName ||
    `${transitPlan.originStop.name} → ${transitPlan.destinationStop.name}`;

  const transfersCount = transitPlan.summary.transfersCount || 0;
  const transferText =
    transfersCount > 0 ? ` • persėdimai ${transfersCount}` : " • direct";

  const multimodalText = includesTrain ? " • bus + train" : "";

  const nextStopText = transitPlan.summary.nextStopName
    ? ` • kita stotelė ${transitPlan.summary.nextStopName}`
    : "";

  const missedStopText = transitPlan.summary.missedStop
    ? " Atrodo, kad praleidai stotelę – planas bus perskaičiuotas."
    : "";

  const alertNotice = buildAlertNotice(transitPlan.summary.alertSignals);

  const refreshText = isRefreshing
    ? " Perskaičiuojama pagal tavo lokaciją…"
    : "";

  return {
    journeyBadges: [
      {
        icon: includesTrain ? "train" : "bus",
        label: transitPlan.summary.routeLabel,
      },
      {
        icon: "walk",
        label: `Walk ${transitPlan.summary.totalWalkMinutes} min`,
      },
      {
        icon: transfersCount > 0 ? "swap-horizontal" : "navigation-variant",
        label:
          transfersCount > 0
            ? `${transfersCount} pers.`
            : getBoardingStateLabel(transitPlan.summary.boardingState),
      },
      {
        icon: "clock-outline",
        label:
          transitPlan.summary.etaMinutes != null
            ? `${transitPlan.summary.etaMinutes} min`
            : includesTrain
            ? "Schedule"
            : "ETA live",
      },
    ],
    journeySteps: normalizeJourneySteps(
      transitPlan,
      pickup,
      destinationPlace,
      includesTrain,
      routeDirection,
      etaLabel
    ),
    notice: `${
      alertNotice || transitPlan.summary.journeyMessage || etaLabel
    } • ${routeDirection}${transferText}${multimodalText}${nextStopText}. Rasti ${transitOptionsCount} variantai.${missedStopText}${refreshText}`,
  };
}


function getJourneyStepIcon(step: any, fallbackMode: "bus" | "train" | "walk") {
  const explicitIcon = typeof step?.icon === "string" ? step.icon : null;
  if (explicitIcon) return explicitIcon;

  const type = String(step?.type || step?.mode || "").toLowerCase();
  if (type.includes("board") || type === "bus") return fallbackMode === "train" ? "train" : "bus";
  if (type.includes("train")) return "train";
  if (type.includes("transfer")) return "swap-horizontal";
  if (type.includes("alight") || type.includes("destination")) return "flag-checkered";
  if (type.includes("walk")) return "walk";
  return "map-marker";
}

function inferStepKind(step: any) {
  const text = `${step?.title || ""} ${step?.subtitle || ""} ${step?.instruction || ""} ${step?.type || ""} ${step?.mode || ""}`.toLowerCase();
  if (text.includes("išlipk") || text.includes("alight")) return "alight" as const;
  if (text.includes("važiuok") || text.includes("ride") || text.includes("bus") || text.includes("train")) return "ride" as const;
  if (text.includes("lipk") || text.includes("board") || text.includes("lauk")) return "wait_board" as const;
  if (text.includes("tiksl") || text.includes("destination")) return "walk_to_destination" as const;
  if (text.includes("eik") || text.includes("walk") || text.includes("stotel")) return "walk_to_stop" as const;
  return "info" as const;
}

function buildCurrentStepProgress({
  journeySteps,
  pickup,
  destinationPlace,
  transitPlan,
  etaMinutes,
}: {
  journeySteps: JourneyStep[];
  pickup: PlaceLike | null;
  destinationPlace: PlaceLike | null;
  transitPlan: TransitPlan | null;
  etaMinutes: number | null;
}) {
  if (!journeySteps.length) {
    return {
      currentStepIndex: 0,
      currentStep: null,
      dynamicPrimaryLabel: null,
      dynamicPrimaryIcon: null,
      focusPolyline: [] as Coordinate[],
    };
  }

  const userCoordinate = pickup?.coordinate || null;
  const boardCoordinate = transitPlan?.originStop
    ? { latitude: transitPlan.originStop.latitude, longitude: transitPlan.originStop.longitude }
    : null;
  const alightCoordinate = transitPlan?.destinationStop
    ? { latitude: transitPlan.destinationStop.latitude, longitude: transitPlan.destinationStop.longitude }
    : null;
  const destinationCoordinate = destinationPlace?.coordinate || null;

  const distanceToBoard = userCoordinate && boardCoordinate ? getDistanceMeters(userCoordinate, boardCoordinate) : Infinity;
  const distanceToAlight = userCoordinate && alightCoordinate ? getDistanceMeters(userCoordinate, alightCoordinate) : Infinity;
  const distanceToDestination = userCoordinate && destinationCoordinate ? getDistanceMeters(userCoordinate, destinationCoordinate) : Infinity;

  let currentStepIndex = 0;

  if (distanceToDestination <= 45) {
    currentStepIndex = Math.max(0, journeySteps.length - 1);
  } else if (distanceToAlight <= 70 && journeySteps.some((s) => s.kind === "walk_to_destination")) {
    currentStepIndex = journeySteps.findIndex((s) => s.kind === "walk_to_destination");
  } else if (distanceToBoard <= 70) {
    const waitIndex = journeySteps.findIndex((s) => s.kind === "wait_board");
    const rideIndex = journeySteps.findIndex((s) => s.kind === "ride");
    currentStepIndex = etaMinutes != null && etaMinutes <= 1 && rideIndex >= 0 ? rideIndex : (waitIndex >= 0 ? waitIndex : Math.max(0, rideIndex));
  } else {
    const walkIndex = journeySteps.findIndex((s) => s.kind === "walk_to_stop");
    currentStepIndex = walkIndex >= 0 ? walkIndex : 0;
  }

  const currentStep = journeySteps[Math.max(0, currentStepIndex)] || journeySteps[0] || null;

  let dynamicPrimaryLabel: string | null = null;
  let dynamicPrimaryIcon: string | null = null;
  if (currentStep?.kind === "walk_to_stop") {
    dynamicPrimaryLabel = "Eiti iki stotelės";
    dynamicPrimaryIcon = "walk";
  } else if (currentStep?.kind === "wait_board") {
    dynamicPrimaryLabel = etaMinutes != null && etaMinutes <= 1 ? "Lipk dabar" : "Lauk autobuso";
    dynamicPrimaryIcon = etaMinutes != null && etaMinutes <= 1 ? "bus-clock" : "bus";
  } else if (currentStep?.kind === "ride") {
    dynamicPrimaryLabel = distanceToAlight <= 180 ? "Išlipk dabar" : "Rodyti maršrutą";
    dynamicPrimaryIcon = distanceToAlight <= 180 ? "flag-checkered" : "bus";
  } else if (currentStep?.kind === "alight") {
    dynamicPrimaryLabel = "Išlipk dabar";
    dynamicPrimaryIcon = "flag-checkered";
  } else if (currentStep?.kind === "walk_to_destination") {
    dynamicPrimaryLabel = "Eiti iki tikslo";
    dynamicPrimaryIcon = "walk";
  }

  let focusPolyline: Coordinate[] = [];
  if (currentStep?.kind === "walk_to_stop" && userCoordinate && boardCoordinate) {
    focusPolyline = [userCoordinate, boardCoordinate];
  } else if ((currentStep?.kind === "wait_board" || currentStep?.kind === "ride" || currentStep?.kind === "alight") && transitPlan?.previewPoints?.length) {
    focusPolyline = transitPlan.previewPoints;
  } else if (currentStep?.kind === "walk_to_destination" && alightCoordinate && destinationCoordinate) {
    focusPolyline = [alightCoordinate, destinationCoordinate];
  }

  return {
    currentStepIndex: Math.max(0, currentStepIndex),
    currentStep,
    dynamicPrimaryLabel,
    dynamicPrimaryIcon,
    focusPolyline,
  };
}

function normalizeJourneySteps(
  transitPlan: TransitPlan,
  pickup: PlaceLike,
  destinationPlace: PlaceLike,
  includesTrain: boolean,
  routeDirection: string,
  etaLabel: string
) {
  const rawSteps = Array.isArray(transitPlan.journeySteps)
    ? transitPlan.journeySteps
    : [];

  const boardCoordinate = transitPlan.originStop
    ? { latitude: transitPlan.originStop.latitude, longitude: transitPlan.originStop.longitude }
    : null;
  const alightCoordinate = transitPlan.destinationStop
    ? { latitude: transitPlan.destinationStop.latitude, longitude: transitPlan.destinationStop.longitude }
    : null;

  if (rawSteps.length) {
    return rawSteps.map((step) => {
      const kind = inferStepKind(step);
      const targetCoordinate =
        kind === "walk_to_stop" || kind === "wait_board"
          ? boardCoordinate
          : kind === "ride" || kind === "alight"
          ? alightCoordinate
          : kind === "walk_to_destination"
          ? destinationPlace.coordinate
          : null;

      return {
        icon: getJourneyStepIcon(step, includesTrain ? "train" : "bus"),
        title:
          step.title ||
          step.stopName ||
          step.instruction ||
          transitPlan.summary.routeLabel ||
          "Journey step",
        subtitle:
          step.subtitle ||
          step.instruction ||
          (step.stopName ? `Stotelė ${step.stopName}` : ""),
        kind,
        targetCoordinate,
        targetRadiusMeters:
          kind === "walk_to_stop" || kind === "wait_board"
            ? 70
            : kind === "ride" || kind === "alight"
            ? 120
            : kind === "walk_to_destination"
            ? 45
            : 60,
      };
    });
  }

  return [
    {
      icon: "walk",
      title: `Eik iki stotelės`,
      subtitle: `Iki „${transitPlan.summary.boardStopName}“ • ${transitPlan.summary.totalWalkMinutes} min pėsčiomis`,
      kind: "walk_to_stop" as const,
      targetCoordinate: boardCoordinate,
      targetRadiusMeters: 70,
    },
    {
      icon: includesTrain ? "train" : "bus",
      title: `Lipk į ${transitPlan.summary.routeLabel}`,
      subtitle: `${routeDirection} • ${etaLabel}`,
      kind: "wait_board" as const,
      targetCoordinate: boardCoordinate,
      targetRadiusMeters: 70,
    },
    {
      icon: includesTrain ? "train" : "bus",
      title: includesTrain ? "Važiuok traukiniu" : "Važiuok autobusu",
      subtitle: `Iki „${transitPlan.summary.alightStopName}“ • ${transitPlan.summary.totalBusMinutes} min • ${transitPlan.summary.stopCount} st.`,
      kind: "ride" as const,
      targetCoordinate: alightCoordinate,
      targetRadiusMeters: 120,
    },
    {
      icon: "flag-checkered",
      title: "Išlipk",
      subtitle: `„${transitPlan.summary.alightStopName}“`,
      kind: "alight" as const,
      targetCoordinate: alightCoordinate,
      targetRadiusMeters: 70,
    },
    {
      icon: "walk",
      title: "Eik iki tikslo",
      subtitle: destinationPlace.title || destinationPlace.subtitle || "Paskutinis žingsnis pėsčiomis",
      kind: "walk_to_destination" as const,
      targetCoordinate: destinationPlace.coordinate,
      targetRadiusMeters: 45,
    },
  ];
}

function normalizeTransitOptions(plan: TransitPlan | null, options: TransitPlan[]) {
  const merged = [...(Array.isArray(options) ? options : [])];
  if (plan?.id && !merged.some((item) => item?.id === plan.id)) {
    merged.unshift(plan);
  } else if (plan && merged.length === 0) {
    merged.push(plan);
  }

  return merged.filter(Boolean).filter((item, index, arr) => {
    if (!item?.id) return index === 0;
    return arr.findIndex((candidate) => candidate?.id === item.id) === index;
  });
}


function buildFocusedTransitPolyline({
  transitPlan,
  pickup,
  destinationPlace,
  walkingPolyline,
}: {
  transitPlan: TransitPlan | null;
  pickup: PlaceLike;
  destinationPlace: PlaceLike;
  walkingPolyline: Coordinate[];
}) {
  if (!transitPlan) {
    return walkingPolyline.length
      ? walkingPolyline
      : [pickup.coordinate, destinationPlace.coordinate];
  }

  const boardStop = transitPlan.originStop;
  const startWalkDistance = boardStop
    ? getDistanceMeters(pickup.coordinate, {
        latitude: boardStop.latitude,
        longitude: boardStop.longitude,
      })
    : 0;

  if (boardStop && startWalkDistance > 70) {
    return [
      pickup.coordinate,
      {
        latitude: boardStop.latitude,
        longitude: boardStop.longitude,
      },
    ];
  }

  if (transitPlan.previewPoints?.length) {
    return transitPlan.previewPoints;
  }

  return walkingPolyline.length
    ? walkingPolyline
    : [pickup.coordinate, destinationPlace.coordinate];
}

async function fetchRoute(
  start: Coordinate,
  end: Coordinate,
  profile: "driving-car" | "foot-walking" = "driving-car"
): Promise<RouteFetchResult> {
  try {
    const res = await fetch(
      `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
      {
        method: "POST",
        headers: {
          Accept: "application/json, application/geo+json",
          "Content-Type": "application/json",
          Authorization: ORS_API_KEY,
        },
        body: JSON.stringify({
          coordinates: [
            [start.longitude, start.latitude],
            [end.longitude, end.latitude],
          ],
        }),
      }
    );

    const data = await res.json();
    const feature = data.features?.[0];
    const coords = feature?.geometry?.coordinates ?? [];
    const summary = feature?.properties?.summary ?? {};

    const formatted = coords.map((c: number[]) => ({
      latitude: c[1],
      longitude: c[0],
    }));

    const distanceKm =
      typeof summary.distance === "number"
        ? summary.distance / 1000
        : getDistanceKm(start, end);

    const durationMin =
      typeof summary.duration === "number"
        ? summary.duration / 60
        : profile === "foot-walking"
        ? (distanceKm / 4.8) * 60
        : (distanceKm / 35) * 60;

    return {
      coords: formatted,
      distanceKm,
      durationMin,
    };
  } catch (err) {
    console.log("Route fetch error:", err);

    const fallbackDistanceKm = getDistanceKm(start, end);
    const fallbackDurationMin =
      profile === "foot-walking"
        ? (fallbackDistanceKm / 4.8) * 60
        : (fallbackDistanceKm / 35) * 60;

    return {
      coords: [start, end],
      distanceKm: fallbackDistanceKm,
      durationMin: fallbackDurationMin,
    };
  }
}

async function fetchTransitPlan(
  origin: Coordinate,
  destination: Coordinate,
  userLocation: Coordinate | null
): Promise<{ plan: TransitPlan | null; options: TransitPlan[]; meta?: { reason?: string; nearbyOriginStops?: Array<{ name: string; distanceMeters?: number }>; nearbyDestinationStops?: Array<{ name: string; distanceMeters?: number }> } }> {
  return fetchTransitPlanFromApi({
    origin,
    destination,
    userLocation,
  });
}

function getTransitRecommendationTitle(transitPlan: TransitPlan | null) {
  const modes = transitPlan?.summary.modes || [];
  const hasTrain = modes.includes("train");
  const hasBus = modes.includes("bus");
  const transfersCount = transitPlan?.summary.transfersCount || 0;

  if (hasTrain && hasBus) return "Bus + Train";
  if (hasTrain) return "Traukinys";
  if (transfersCount > 0) return "Autobusai su persėdimu";
  return "Autobusas";
}

function getTransitRecommendationDescription(transitPlan: TransitPlan | null) {
  if (!transitPlan) return "Viešasis transportas • tikrinamas GTFS variantas";

  const transfers = transitPlan.summary.transfersCount || 0;
  const transferText = transfers > 0 ? ` • ${transfers} pers.` : "";
  const modeText = (transitPlan.summary.modes || []).includes("train")
    ? (transitPlan.summary.modes || []).includes("bus")
      ? " • bus + train"
      : " • train"
    : "";

  return `${transitPlan.summary.routeLabel} • ${transitPlan.summary.boardStopName} → ${transitPlan.summary.alightStopName}${transferText}${modeText}`;
}

function decideTransport({
  distanceKm,
  transitPlan,
}: {
  distanceKm: number;
  transitPlan: TransitPlan | null;
}): AiMode {
  if (distanceKm <= 1.2) return "walk";
  if (!transitPlan) return distanceKm > 3.5 ? "taxi" : "walk";
  if ((transitPlan.summary.modes || []).includes("train") && !(transitPlan.summary.modes || []).includes("bus")) return "train";
  if (transitPlan.summary.totalDurationMinutes > 35 && distanceKm > 7) {
    return "taxi";
  }
  return "bus";
}

export function useSmartRoute({
  selectedMode,
  liveBuses,
  selectedBus,
  isPro,
  pickup,
  destinationPlace,
  setExternalRoute,
}: UseSmartRouteParams) {
  const [aiSuggestion, setAiSuggestion] = useState<AiMode>("bus");
  const [eta, setEta] = useState<number | null>(7);
  const [bestBusId, setBestBusId] = useState<string | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const [drivingRouteCoords, setDrivingRouteCoords] = useState<Coordinate[]>(
    []
  );
  const [walkingRouteCoords, setWalkingRouteCoords] = useState<Coordinate[]>(
    []
  );
  const [selectedRecommendationId, setSelectedRecommendationId] =
    useState<string>("bus");
  const [lockedRecommendationId, setLockedRecommendationId] = useState<
    string | null
  >(null);
  const [dynamicRecommendations, setDynamicRecommendations] = useState<
    Recommendation[]
  >([]);
  const [transitPlan, setTransitPlan] = useState<TransitPlan | null>(null);
  const [transitOptions, setTransitOptions] = useState<TransitPlan[]>([]);
  const [activeTransitAlerts, setActiveTransitAlerts] = useState<
    JourneyAlertSignal[]
  >([]);
  const [isTransitRefreshing, setIsTransitRefreshing] = useState(false);
  const [lastTransitRefreshAt, setLastTransitRefreshAt] = useState<
    number | null
  >(null);

  const lastRefreshOriginRef = useRef<Coordinate | null>(null);
  const lastRefreshAtRef = useRef<number>(0);
  const selectedRecommendationIdRef = useRef<string>("bus");
  const lockedRecommendationIdRef = useRef<string | null>(null);
  const routeCoordsRef = useRef<Coordinate[]>([]);
  const selectedModeRef = useRef<TravelMode>(selectedMode);
  const isRefreshingRef = useRef(false);
  const deviceIdRef = useRef<string>(
    `arbebus-${Math.random().toString(36).slice(2)}-${Date.now()}`
  );

  useEffect(() => {
    selectedRecommendationIdRef.current = selectedRecommendationId;
  }, [selectedRecommendationId]);

  useEffect(() => {
    lockedRecommendationIdRef.current = lockedRecommendationId;
  }, [lockedRecommendationId]);

  useEffect(() => {
    routeCoordsRef.current = routeCoords;
  }, [routeCoords]);

  useEffect(() => {
    selectedModeRef.current = selectedMode;
  }, [selectedMode]);

  useEffect(() => {
    void ensurePushRegistrationAsync(API_BASE, deviceIdRef.current);
  }, []);

  useEffect(() => {
    if (selectedMode !== "smart" && lockedRecommendationId) {
      setLockedRecommendationId(null);
    }
  }, [selectedMode, lockedRecommendationId]);

  const buildRecommendations = useCallback(
    ({
      distanceKm,
      drivingDurationMin,
      pickup,
      destinationPlace,
      transitPlan,
      transitOptions,
      selectedBus,
      isRefreshing,
      transitOptionsCount,
      transitMeta,
    }: {
      distanceKm: number;
      drivingDurationMin: number;
      pickup: PlaceLike;
      destinationPlace: PlaceLike;
      transitPlan: TransitPlan | null;
      transitOptions: TransitPlan[];
      selectedBus: LiveBus | null;
      isRefreshing: boolean;
      transitOptionsCount: number;
      transitMeta?: {
        reason?: string;
        nearbyOriginStops?: Array<{ name: string; distanceMeters?: number }>;
        nearbyDestinationStops?: Array<{ name: string; distanceMeters?: number }>;
      };
    }): Recommendation[] => {
      const walkingEta = clampEta((distanceKm / 4.8) * 60);
      const taxiEta = clampEta(Math.max(4, drivingDurationMin * 0.78));
      const scooterEta = clampEta(Math.max(5, (distanceKm / 18) * 60));
      const taxiPrice = estimateTaxiPrice(distanceKm, drivingDurationMin);
      const scooterPrice = estimateScooterPrice(scooterEta);

      const busEta =
        transitPlan?.summary.totalDurationMinutes ??
        clampEta(drivingDurationMin * 1.2 + 7);
      const busPrice = distanceKm > 7 ? 1.2 : 0.8;

      const busJourney = transitPlan
        ? buildTransitMeta({
            pickup,
            destinationPlace,
            transitPlan,
            selectedBus,
            isRefreshing,
            transitOptionsCount,
          })
        : {
            journeyBadges: [
              { icon: "bus", label: "Bus" },
              { icon: "clock-outline", label: "Live search" },
            ],
            journeySteps: [
              {
                icon: "map-marker",
                title: pickup.title || pickup.subtitle || "Current location",
                subtitle:
                  transitMeta?.nearbyOriginStops?.[0]
                    ? `Artimiausia stotelė: ${transitMeta.nearbyOriginStops[0].name}`
                    : "Ieškome artimiausių stotelių",
              },
              {
                icon: "bus",
                title: "Viešasis transportas",
                subtitle:
                  transitMeta?.reason === "NO_NEARBY_STOPS"
                    ? "Šalia taško neradome tinkamų stotelių"
                    : "Tikriname direct ir transfer variantus",
              },
              {
                icon: "flag-checkered",
                title:
                  destinationPlace.title ||
                  destinationPlace.subtitle ||
                  "Destination",
                subtitle:
                  transitMeta?.nearbyDestinationStops?.[0]
                    ? `Tikslui artimiausia: ${transitMeta.nearbyDestinationStops[0].name}`
                    : "Atvykimas į tikslą",
              },
            ],
            notice: isRefreshing
              ? "Perskaičiuojama pagal gyvą lokaciją…"
              : transitMeta?.reason === "NO_NEARBY_STOPS"
              ? "Šiuo tašku neradome pakankamai arti esančių GTFS stotelių. Pabandyk tikslesnį adresą arba stotelę." 
              : "Šiuo metu neradome tinkamo GTFS varianto. Backend veikia, bet šitam maršrutui gali reikėti kito laiko arba tikslesnio taško.",
          };

      const busRecommendation: Recommendation = {
        id: transitPlan?.id || "bus",
        mode: transitPlan?.mode === "train" ? "train" : "bus",
        icon: (transitPlan?.summary.modes || []).includes("train") ? "train" : "bus",
        title: getTransitRecommendationTitle(transitPlan),
        subtitle: `${busEta} min • ${formatPrice(busPrice)}`,
        price: formatPrice(busPrice),
        etaLabel: `${busEta} min`,
        description: getTransitRecommendationDescription(transitPlan),
        accent: "#60a5fa",
        rightIcons: ["bus", "navigation-variant"],
        ...busJourney,
      };

      const busVariantRecommendations: Recommendation[] = transitOptions
        .filter((option) => option.id && option.id !== transitPlan?.id)
        .slice(0, 2)
        .map((option, index) => {
          const optionEta = option.summary.totalDurationMinutes || busEta + index + 1;
          const optionMeta = buildTransitMeta({
            pickup,
            destinationPlace,
            transitPlan: option,
            selectedBus,
            isRefreshing,
            transitOptionsCount,
          });

          return {
            id: option.id || `bus-option-${index}`,
            mode: option.mode === "train" ? "train" as const : "bus" as const,
            icon: (option.summary.modes || []).includes("train") ? "train" : "bus",
            title: getTransitRecommendationTitle(option),
            subtitle: `${optionEta} min • ${formatPrice(busPrice)}`,
            price: formatPrice(busPrice),
            etaLabel: `${optionEta} min`,
            description: `${option.summary.routeLabel} • ${option.summary.boardStopName} → ${option.summary.alightStopName}`,
            accent: "#60a5fa",
            rightIcons: ["bus", option.summary.transfersCount ? "swap-horizontal" : "navigation-variant"],
            ...optionMeta,
          };
        });

      const taxiJourney = buildTaxiJourneyMeta({ pickup, destinationPlace });
      const scooterJourney = buildScooterJourneyMeta({
        pickup,
        destinationPlace,
      });
      const walkJourney = buildWalkJourneyMeta({
        pickup,
        destinationPlace,
        walkingEta,
      });

      const taxiRecommendation: Recommendation = {
        id: "taxi",
        mode: "taxi",
        icon: "taxi",
        title: "Taxi",
        subtitle: `${taxiEta} min • ${formatPrice(taxiPrice)}`,
        price: formatPrice(taxiPrice),
        etaLabel: `${taxiEta} min`,
        description: "Bolt / taxi • Greičiausias tiesioginis variantas",
        accent: "#facc15",
        rightIcons: ["taxi", "open-in-new"],
        ...taxiJourney,
      };

      const scooterRecommendation: Recommendation = {
        id: "scooter",
        mode: "scooter",
        icon: "scooter",
        title: "Scooter",
        subtitle: `${scooterEta} min • ${formatPrice(scooterPrice)}`,
        price: formatPrice(scooterPrice),
        etaLabel: `${scooterEta} min`,
        description: "Paspirtukas • Lankstus variantas miestui",
        accent: "#34d399",
        rightIcons: ["scooter", "lightning-bolt"],
        ...scooterJourney,
      };

      const walkRecommendation: Recommendation = {
        id: "walk",
        mode: "walk",
        icon: "walk",
        title: "Pėsčiomis",
        subtitle: `${walkingEta} min • €0.00`,
        price: "€0.00",
        etaLabel: `${walkingEta} min`,
        description: "Tiesiausias maršrutas pėsčiomis",
        accent: "#22c55e",
        rightIcons: ["walk", "map-marker-path"],
        ...walkJourney,
      };

      const finalDecision = decideTransport({ distanceKm, transitPlan });

      if (finalDecision === "walk") {
        return [walkRecommendation, busRecommendation, ...busVariantRecommendations, taxiRecommendation];
      }

      if (finalDecision === "taxi") {
        return [taxiRecommendation, busRecommendation, ...busVariantRecommendations, scooterRecommendation];
      }

      return [busRecommendation, ...busVariantRecommendations, taxiRecommendation, scooterRecommendation];
    },
    []
  );

  const applyExternalRouteForMode = useCallback(
    ({
      pickedMode,
      pickup,
      destinationPlace,
      busPolyline,
      drivingPolyline,
      walkingPolyline,
    }: {
      pickedMode: Recommendation["mode"] | TravelMode;
      pickup: PlaceLike;
      destinationPlace: PlaceLike;
      busPolyline: Coordinate[];
      drivingPolyline: Coordinate[];
      walkingPolyline: Coordinate[];
    }) => {
      const resolvedPolyline =
        pickedMode === "bus"
          ? busPolyline
          : pickedMode === "walk"
          ? walkingPolyline.length
            ? walkingPolyline
            : [pickup.coordinate, destinationPlace.coordinate]
          : drivingPolyline.length
          ? drivingPolyline
          : [pickup.coordinate, destinationPlace.coordinate];

      setExternalRoute({
        pickup: {
          id: pickup.id,
          title: pickup.title,
          subtitle: pickup.subtitle,
          coordinate: pickup.coordinate,
        },
        destination: {
          id: destinationPlace.id,
          title: destinationPlace.title,
          subtitle: destinationPlace.subtitle,
          coordinate: destinationPlace.coordinate,
        },
        polyline: resolvedPolyline,
      });
    },
    [setExternalRoute]
  );

  const performSmartRoute = useCallback(
    async ({
      preserveSelection = false,
      silent = false,
    }: {
      preserveSelection?: boolean;
      silent?: boolean;
    } = {}) => {
      if (!pickup?.coordinate) {
        throw new Error("MISSING_USER_LOCATION");
      }

      if (!destinationPlace?.coordinate) {
        throw new Error("MISSING_DESTINATION");
      }

      if (isRefreshingRef.current) {
        return null;
      }

      isRefreshingRef.current = true;
      if (silent) {
        setIsTransitRefreshing(true);
      }

      try {
        const userLocation = pickup.coordinate;

        const [drivingRoute, walkingRoute, transitResult] = await Promise.all([
          fetchRoute(
            pickup.coordinate,
            destinationPlace.coordinate,
            "driving-car"
          ),
          fetchRoute(
            pickup.coordinate,
            destinationPlace.coordinate,
            "foot-walking"
          ),
          fetchTransitPlan(
            pickup.coordinate,
            destinationPlace.coordinate,
            userLocation
          ),
        ]);

        const nextTransitPlan = transitResult.plan;
        const nextTransitOptions = transitResult.options;
        const nextTransitMeta = transitResult.meta;

        const recommendations = buildRecommendations({
          distanceKm: drivingRoute.distanceKm,
          drivingDurationMin: drivingRoute.durationMin,
          pickup,
          destinationPlace,
          transitPlan: nextTransitPlan,
          transitOptions: nextTransitOptions,
          selectedBus,
          isRefreshing: silent,
          transitOptionsCount: nextTransitOptions.length,
          transitMeta: nextTransitMeta,
        });

        const previousSelectedId = selectedRecommendationIdRef.current;
        const lockedId = lockedRecommendationIdRef.current;
        const primary = recommendations[0];

        const locked =
          lockedId &&
          recommendations.find((item) => item.id === lockedId);

        const preserved =
          preserveSelection &&
          recommendations.find((item) => item.id === previousSelectedId);

        const chosenRecommendation = locked || preserved || primary;
        const chosenId = chosenRecommendation?.id || primary.id;

        const chosenTransitOption =
          chosenRecommendation.mode === "bus" || chosenRecommendation.mode === "train"
            ? nextTransitOptions.find((option) => option.id === chosenRecommendation.id) ||
              nextTransitPlan
            : null;

        const finalBusPolyline =
          chosenTransitOption?.previewPoints?.length
            ? chosenTransitOption.previewPoints
            : nextTransitPlan?.previewPoints?.length
            ? nextTransitPlan.previewPoints
            : drivingRoute.coords.length
            ? drivingRoute.coords
            : [pickup.coordinate, destinationPlace.coordinate];

        const focusedTransitPolyline = buildFocusedTransitPolyline({
          transitPlan: chosenTransitOption || nextTransitPlan,
          pickup,
          destinationPlace,
          walkingPolyline: walkingRoute.coords,
        });

        const nextAlerts = nextTransitPlan?.summary?.alertSignals || [];

        setTransitPlan(chosenTransitOption || nextTransitPlan);
        setTransitOptions(nextTransitOptions);
        setDrivingRouteCoords(drivingRoute.coords);
        setWalkingRouteCoords(walkingRoute.coords);
        setRouteCoords(finalBusPolyline);
        setAiSuggestion((primary.mode as AiMode) || "bus");
        setEta(parseEtaLabelToMinutes(chosenRecommendation.etaLabel));
        setBestBusId(
          chosenRecommendation.mode === "bus"
            ? String(
                chosenTransitOption?.liveVehicle?.vehicleId ||
                  chosenTransitOption?.liveVehicle?.id ||
                  nextTransitPlan?.liveVehicle?.vehicleId ||
                  nextTransitPlan?.liveVehicle?.id ||
                  selectedBus?.id ||
                  liveBuses[0]?.id ||
                  ""
              ) || null
            : null
        );
        setSelectedRecommendationId(chosenId);
        setDynamicRecommendations(recommendations);
        setLastTransitRefreshAt(Date.now());
        setActiveTransitAlerts(nextAlerts);

        lastRefreshOriginRef.current = pickup.coordinate;
        lastRefreshAtRef.current = Date.now();

        applyExternalRouteForMode({
          pickedMode: chosenRecommendation.mode,
          pickup,
          destinationPlace,
          busPolyline:
            chosenRecommendation.mode === "bus" || chosenRecommendation.mode === "train"
              ? focusedTransitPolyline
              : finalBusPolyline,
          drivingPolyline: drivingRoute.coords,
          walkingPolyline: walkingRoute.coords,
        });

        const journeyKey = buildJourneyKey({
          pickupId: pickup.id,
          destinationId: destinationPlace.id,
          routeId: nextTransitPlan?.routeId,
        });

        if (nextAlerts.length) {
          await dispatchTransitAlertsAsync({
            apiBase: API_BASE,
            deviceId: deviceIdRef.current,
            journeyKey,
            alerts: nextAlerts,
          });
        }

        return {
          decision: primary.mode,
          eta: parseEtaLabelToMinutes(chosenRecommendation.etaLabel),
          bestBusId:
            chosenRecommendation.mode === "bus"
              ? String(
                  chosenTransitOption?.liveVehicle?.vehicleId ||
                    chosenTransitOption?.liveVehicle?.id ||
                    nextTransitPlan?.liveVehicle?.vehicleId ||
                    nextTransitPlan?.liveVehicle?.id ||
                    selectedBus?.id ||
                    liveBuses[0]?.id ||
                    ""
                ) || null
              : null,
          recommendationId: chosenId,
          recommendations,
          alertSignals: nextAlerts,
        };
      } finally {
        isRefreshingRef.current = false;
        setIsTransitRefreshing(false);
      }
    },
    [
      applyExternalRouteForMode,
      buildRecommendations,
      destinationPlace,
      liveBuses,
      pickup,
      selectedBus,
    ]
  );

  const handleSmartRoute = useCallback(async () => {
    return performSmartRoute({
      preserveSelection: false,
      silent: false,
    });
  }, [performSmartRoute]);

  const getFinalMode = useCallback((): AiMode | TravelMode => {
    if (selectedMode === "smart") {
      const activeId = lockedRecommendationId || selectedRecommendationId;

      const selectedRec = dynamicRecommendations.find(
        (item) => item.id === activeId
      );

      return selectedRec?.mode || aiSuggestion;
    }

    return selectedMode;
  }, [
    aiSuggestion,
    dynamicRecommendations,
    lockedRecommendationId,
    selectedMode,
    selectedRecommendationId,
  ]);

  const recommendations: Recommendation[] = useMemo(() => {
    if (selectedMode === "smart" && dynamicRecommendations.length > 0) {
      return dynamicRecommendations;
    }

    if (!pickup || !destinationPlace) {
      return [];
    }

    const distanceKm = getDistanceKm(
      pickup.coordinate,
      destinationPlace.coordinate
    );
    const drivingDurationMin = Math.max(4, (distanceKm / 35) * 60);

    const computed = buildRecommendations({
      distanceKm,
      drivingDurationMin,
      pickup,
      destinationPlace,
      transitPlan,
      transitOptions,
      selectedBus,
      isRefreshing: isTransitRefreshing,
      transitOptionsCount: transitOptions.length,
    });

    if (selectedMode === "bus") {
      return computed.filter((item) => item.mode === "bus").slice(0, 3);
    }

    if (selectedMode === "taxi") {
      return [computed.find((item) => item.id === "taxi") || computed[0]];
    }

    if (selectedMode === "walk") {
      return [computed.find((item) => item.id === "walk") || computed[0]];
    }

    if (selectedMode === "scooter") {
      return [computed.find((item) => item.id === "scooter") || computed[0]];
    }

    return computed;
  }, [
    aiSuggestion,
    buildRecommendations,
    destinationPlace,
    dynamicRecommendations,
    isTransitRefreshing,
    pickup,
    selectedBus,
    selectedMode,
    transitOptions.length,
    transitOptions,
    transitPlan,
  ]);

  const selectedRecommendation =
    recommendations.find((item) => item.id === selectedRecommendationId) ||
    recommendations[0];

  const currentStepProgress = useMemo(() => {
    return buildCurrentStepProgress({
      journeySteps: selectedRecommendation?.journeySteps || [],
      pickup,
      destinationPlace,
      transitPlan,
      etaMinutes: eta,
    });
  }, [selectedRecommendation, pickup, destinationPlace, transitPlan, eta]);

  const selectRecommendation = useCallback(
    (id: string) => {
      const picked = recommendations.find((item) => item.id === id);
      if (!picked || !pickup || !destinationPlace) return;

      const pickedTransitOption =
        picked.mode === "bus"
          ? transitOptions.find((option) => option.id === id) || transitPlan
          : transitPlan;

      if ((picked.mode === "bus" || picked.mode === "train") && pickedTransitOption) {
        setTransitPlan(pickedTransitOption);
        if (pickedTransitOption.previewPoints?.length) {
          setRouteCoords(pickedTransitOption.previewPoints);
        }
      }

      setLockedRecommendationId(id);
      setSelectedRecommendationId(id);
      setEta(parseEtaLabelToMinutes(picked.etaLabel));
      setAiSuggestion((picked.mode as AiMode) || "bus");
      setBestBusId(
        picked.mode === "bus"
          ? String(
              pickedTransitOption?.liveVehicle?.vehicleId ||
                pickedTransitOption?.liveVehicle?.id ||
                selectedBus?.id ||
                liveBuses[0]?.id ||
                ""
            ) || null
          : null
      );

      applyExternalRouteForMode({
        pickedMode: picked.mode,
        pickup,
        destinationPlace,
        busPolyline:
          picked.mode === "bus" || picked.mode === "train"
            ? buildFocusedTransitPolyline({
                transitPlan: pickedTransitOption || transitPlan,
                pickup,
                destinationPlace,
                walkingPolyline: walkingRouteCoords,
              })
            : pickedTransitOption?.previewPoints?.length && picked.mode === "bus"
            ? pickedTransitOption.previewPoints
            : routeCoords,
        drivingPolyline: drivingRouteCoords,
        walkingPolyline: walkingRouteCoords,
      });
    },
    [
      applyExternalRouteForMode,
      destinationPlace,
      drivingRouteCoords,
      liveBuses,
      pickup,
      recommendations,
      routeCoords,
      selectedBus,
      transitOptions,
      transitPlan,
      walkingRouteCoords,
    ]
  );

  useEffect(() => {
    if (!pickup?.coordinate || !destinationPlace?.coordinate) return;
    if (!routeCoordsRef.current.length) return;

    const mode = selectedModeRef.current;
    if (mode !== "smart" && mode !== "bus") return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < 12000) return;

      void performSmartRoute({
        preserveSelection: true,
        silent: true,
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [destinationPlace?.coordinate, pickup?.coordinate, performSmartRoute]);

  useEffect(() => {
    if (!pickup || !destinationPlace || !selectedRecommendation) return;

    const finalMode = selectedRecommendation.mode;
    if (!(finalMode === "bus" || finalMode === "train" || finalMode === "smart")) return;

    const focusedPolyline = currentStepProgress.focusPolyline.length
      ? currentStepProgress.focusPolyline
      : buildFocusedTransitPolyline({
          transitPlan,
          pickup,
          destinationPlace,
          walkingPolyline: walkingRouteCoords,
        });

    if (focusedPolyline.length) {
      setRouteCoords(focusedPolyline);
      applyExternalRouteForMode({
        pickedMode: finalMode,
        pickup,
        destinationPlace,
        busPolyline: focusedPolyline,
        drivingPolyline: drivingRouteCoords,
        walkingPolyline: walkingRouteCoords,
      });
    }
  }, [
    applyExternalRouteForMode,
    currentStepProgress.focusPolyline,
    destinationPlace,
    drivingRouteCoords,
    pickup,
    selectedRecommendation,
    transitPlan,
    walkingRouteCoords,
  ]);

  useEffect(() => {
    if (!pickup?.coordinate || !destinationPlace?.coordinate) return;
    if (!routeCoords.length) return;

    const mode = selectedMode;
    if (mode !== "smart" && mode !== "bus") return;

    const now = Date.now();
    if (now - lastRefreshAtRef.current < 8000) return;

    const lastOrigin = lastRefreshOriginRef.current;
    const movedMeters = lastOrigin
      ? getDistanceMeters(lastOrigin, pickup.coordinate)
      : 0;

    const offRouteMeters = distanceToPolylineMeters(
      pickup.coordinate,
      routeCoords
    );

    const hasRerouteAlert = activeTransitAlerts.some(
      (alert) => alert.type === "reroute_needed"
    );

    const shouldRefresh =
      movedMeters > 80 ||
      offRouteMeters > 120 ||
      Boolean(transitPlan?.summary.missedStop) ||
      hasRerouteAlert;

    if (!shouldRefresh) return;

    void performSmartRoute({
      preserveSelection: true,
      silent: true,
    });
  }, [
    activeTransitAlerts,
    destinationPlace?.coordinate,
    pickup?.coordinate,
    routeCoords,
    selectedMode,
    performSmartRoute,
    transitPlan?.summary.missedStop,
  ]);

  return {
    aiSuggestion,
    eta,
    bestBusId,
    routeCoords,
    selectedRecommendationId,
    lockedRecommendationId,
    recommendations,
    selectedRecommendation,
    transitPlan,
    transitOptions,
    activeTransitAlerts,
    isTransitRefreshing,
    lastTransitRefreshAt,
    setAiSuggestion,
    setEta,
    setBestBusId,
    setRouteCoords,
    setDrivingRouteCoords,
    setSelectedRecommendationId,
    setLockedRecommendationId,
    handleSmartRoute,
    getFinalMode,
    fetchRoute,
    selectRecommendation,
    currentStepIndex: currentStepProgress.currentStepIndex,
    currentStep: currentStepProgress.currentStep,
    dynamicPrimaryLabel: currentStepProgress.dynamicPrimaryLabel,
    dynamicPrimaryIcon: currentStepProgress.dynamicPrimaryIcon,
  };
}

export { AIRPORTS };

