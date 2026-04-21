import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../constants/api";
import { AIRPORTS, ORS_API_KEY } from "../constants/home";
import {
  JourneyAlertSignal,
  buildJourneyKey,
  dispatchTransitAlertsAsync,
  ensurePushRegistrationAsync,
} from "../core/services/notifications/transitNotificationService";
import { LiveBus, TravelMode } from "../types/home";

type AiMode = "bus" | "taxi" | "walk";

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

type TransitPlan = {
  id?: string;
  mode: "bus";
  routeId: string;
  summary: {
    totalDurationMinutes: number;
    totalWalkMinutes: number;
    totalBusMinutes: number;
    boardStopName: string;
    alightStopName: string;
    routeLabel: string;
    etaMinutes: number | null;
    stopCount: number;
    transfersCount?: number;
    directionCode?: string | null;
    headsign?: string | null;
    boardingState?: string | null;
    nextStopName?: string | null;
    journeyMessage?: string | null;
    missedStop?: boolean;
    approximateStopsRemaining?: number;
    alertSignals?: JourneyAlertSignal[];
    modes?: Array<"bus" | "train">;
  };
  originStop: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
  };
  destinationStop: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
  };
  previewPoints: Coordinate[];
  journeySteps?: JourneyStep[];
  liveVehicle?: {
    vehicleId?: string;
    id?: string;
    directionName?: string;
  } | null;
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
  const etaLabel =
    transitPlan.summary.etaMinutes != null
      ? `Atvyks po ${transitPlan.summary.etaMinutes} min`
      : "Live ETA dar skaičiuojamas";

  const routeDirection =
    transitPlan.summary.headsign ||
    selectedBus?.directionName ||
    transitPlan.liveVehicle?.directionName ||
    `${transitPlan.originStop.name} → ${transitPlan.destinationStop.name}`;

  const transferText =
    (transitPlan.summary.transfersCount || 0) > 0
      ? ` • persėdimai ${transitPlan.summary.transfersCount}`
      : " • direct";

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

  const includesTrain = (transitPlan.summary.modes || []).includes("train");

  return {
    journeyBadges: [
      { icon: includesTrain ? "train" : "bus", label: transitPlan.summary.routeLabel },
      {
        icon: "navigation-variant",
        label: getBoardingStateLabel(transitPlan.summary.boardingState),
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
    journeySteps:
      transitPlan.journeySteps || [
        {
          icon: "map-marker",
          title: pickup.title || pickup.subtitle || "Current location",
          subtitle: `Eik iki ${transitPlan.summary.boardStopName}`,
        },
        {
          icon: "bus",
          title: transitPlan.summary.routeLabel,
          subtitle: `${routeDirection} • ${etaLabel}`,
        },
        {
          icon: "flag-checkered",
          title:
            destinationPlace.title || destinationPlace.subtitle || "Destination",
          subtitle: `Išlipk ${transitPlan.summary.alightStopName}`,
        },
      ],
    notice: `${
      alertNotice || transitPlan.summary.journeyMessage || etaLabel
    } • ${routeDirection}${transferText}${multimodalText}${nextStopText}. Rasti ${transitOptionsCount} variantai.${missedStopText}${refreshText}`,
  };
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
): Promise<{ plan: TransitPlan | null; options: TransitPlan[] }> {
  try {
    const response = await fetch(`${API_BASE}/transit/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ origin, destination, userLocation }),
    });

    if (!response.ok) {
      return { plan: null, options: [] };
    }

    const data = await response.json();

    return {
      plan: data?.plan || null,
      options: Array.isArray(data?.options) ? data.options : [],
    };
  } catch (error) {
    console.log("fetchTransitPlan error:", error);
    return { plan: null, options: [] };
  }
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
      selectedBus,
      isRefreshing,
      transitOptionsCount,
    }: {
      distanceKm: number;
      drivingDurationMin: number;
      pickup: PlaceLike;
      destinationPlace: PlaceLike;
      transitPlan: TransitPlan | null;
      selectedBus: LiveBus | null;
      isRefreshing: boolean;
      transitOptionsCount: number;
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
                subtitle: "Ieškome tikro GTFS maršruto",
              },
              {
                icon: "bus",
                title: "Viešasis transportas",
                subtitle: "Tikriname direct ir transfer variantus",
              },
              {
                icon: "flag-checkered",
                title:
                  destinationPlace.title ||
                  destinationPlace.subtitle ||
                  "Destination",
                subtitle: "Atvykimas į tikslą",
              },
            ],
            notice: isRefreshing
              ? "Perskaičiuojama pagal gyvą lokaciją…"
              : "GTFS maršrutas dar nerastas.",
          };

      const busRecommendation: Recommendation = {
        id: "bus",
        mode: "bus",
        icon: "bus",
        title: "Autobusas",
        subtitle: `${busEta} min • ${formatPrice(busPrice)}`,
        price: formatPrice(busPrice),
        etaLabel: `${busEta} min`,
        description: transitPlan
          ? `${transitPlan.summary.routeLabel} • ${transitPlan.summary.boardStopName} → ${transitPlan.summary.alightStopName}${(transitPlan.summary.modes || []).includes("train") ? " • bus + train" : ""}`
          : "Viešasis transportas • tikrinamas GTFS variantas",
        accent: "#60a5fa",
        rightIcons: ["bus", "navigation-variant"],
        ...busJourney,
      };

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
        return [walkRecommendation, busRecommendation, taxiRecommendation];
      }

      if (finalDecision === "taxi") {
        return [taxiRecommendation, busRecommendation, scooterRecommendation];
      }

      return [busRecommendation, taxiRecommendation, scooterRecommendation];
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

        const recommendations = buildRecommendations({
          distanceKm: drivingRoute.distanceKm,
          drivingDurationMin: drivingRoute.durationMin,
          pickup,
          destinationPlace,
          transitPlan: nextTransitPlan,
          selectedBus,
          isRefreshing: silent,
          transitOptionsCount: nextTransitOptions.length,
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

        const finalBusPolyline =
          nextTransitPlan?.previewPoints?.length &&
          chosenRecommendation.mode === "bus"
            ? nextTransitPlan.previewPoints
            : nextTransitPlan?.previewPoints?.length
            ? nextTransitPlan.previewPoints
            : drivingRoute.coords.length
            ? drivingRoute.coords
            : [pickup.coordinate, destinationPlace.coordinate];

        const nextAlerts = nextTransitPlan?.summary?.alertSignals || [];

        setTransitPlan(nextTransitPlan);
        setTransitOptions(nextTransitOptions);
        setDrivingRouteCoords(drivingRoute.coords);
        setWalkingRouteCoords(walkingRoute.coords);
        setRouteCoords(finalBusPolyline);
        setAiSuggestion((primary.mode as AiMode) || "bus");
        setEta(parseEtaLabelToMinutes(chosenRecommendation.etaLabel));
        setBestBusId(
          chosenRecommendation.mode === "bus"
            ? String(
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
          busPolyline: finalBusPolyline,
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
      selectedBus,
      isRefreshing: isTransitRefreshing,
      transitOptionsCount: transitOptions.length,
    });

    if (selectedMode === "bus") {
      return [computed.find((item) => item.id === "bus") || computed[0]];
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
    transitPlan,
  ]);

  const selectedRecommendation =
    recommendations.find((item) => item.id === selectedRecommendationId) ||
    recommendations[0];

  const selectRecommendation = useCallback(
    (id: string) => {
      const picked = recommendations.find((item) => item.id === id);
      if (!picked || !pickup || !destinationPlace) return;

      setLockedRecommendationId(id);
      setSelectedRecommendationId(id);
      setEta(parseEtaLabelToMinutes(picked.etaLabel));
      setAiSuggestion((picked.mode as AiMode) || "bus");
      setBestBusId(
        picked.mode === "bus"
          ? String(
              transitPlan?.liveVehicle?.vehicleId ||
                transitPlan?.liveVehicle?.id ||
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
          transitPlan?.previewPoints?.length && picked.mode === "bus"
            ? transitPlan.previewPoints
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
  };
}

export { AIRPORTS };

