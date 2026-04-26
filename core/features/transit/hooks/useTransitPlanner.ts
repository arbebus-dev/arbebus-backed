import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import type {
  Coordinate,
  PlaceSearchResult,
  TransitFlowState,
  TransitRouteOption,
  TransitStep,
  TransitStepType,
} from "../models/transitTypes";
import {
  fetchLiveEta,
  fetchTransitShape,
  planTransitRoute,
  searchPlaces,
  type PlaceResult as ApiPlaceResult,
  type TransitRouteOption as ApiTransitRouteOption,
} from "../services/transitApi";

// ====== helpers ======
function safeArray<T>(arr: any): T[] {
  return Array.isArray(arr) ? arr : [];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const TRANSIT_PLAN_CACHE_KEY = "arbebus:last-transit-plan:v1";
const TRANSIT_PLAN_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CachedTransitPlan = {
  createdAt: number;
  destination: PlaceSearchResult;
  routeOptions: TransitRouteOption[];
  selectedRoute: TransitRouteOption | null;
};

async function saveCachedTransitPlan(payload: Omit<CachedTransitPlan, "createdAt">) {
  try {
    await AsyncStorage.setItem(
      TRANSIT_PLAN_CACHE_KEY,
      JSON.stringify({ ...payload, createdAt: Date.now() })
    );
  } catch {
    // Cache is a safety net only. Never block navigation because cache failed.
  }
}

async function loadCachedTransitPlan(): Promise<CachedTransitPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(TRANSIT_PLAN_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedTransitPlan;
    if (!parsed?.createdAt || Date.now() - parsed.createdAt > TRANSIT_PLAN_CACHE_TTL_MS) {
      return null;
    }

    if (!Array.isArray(parsed.routeOptions) || !parsed.routeOptions.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function toCoordinate(input: any): Coordinate | null {
  const latitude = Number(input?.latitude ?? input?.lat ?? input?.coordinate?.latitude);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng ?? input?.coordinate?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

// ====== STEP 9 GPS NAVIGATION HELPERS ======
function distanceMeters(a: Coordinate, b: Coordinate) {
  const dx = (a.latitude - b.latitude) * 111320;
  const dy =
    (a.longitude - b.longitude) *
    40075000 *
    Math.cos((a.latitude * Math.PI) / 180) /
    360;

  return Math.sqrt(dx * dx + dy * dy);
}

function isActiveNavigationState(flowState: TransitFlowState) {
  return [
    "walking_to_stop",
    "waiting_bus",
    "onboard",
    "transfer",
    "arriving",
  ].includes(flowState);
}

function targetForStep(
  route: TransitRouteOption,
  step: TransitStep | undefined
): Coordinate | null {
  if (!step) return null;

  const firstPolylinePoint = Array.isArray(step.polyline)
    ? toCoordinate(step.polyline[0])
    : null;

  const lastPolylinePoint = Array.isArray(step.polyline)
    ? toCoordinate(step.polyline[step.polyline.length - 1])
    : null;

  if (step.type === "walk" || step.type === "board") {
    return firstPolylinePoint ?? route.originStop?.coordinate ?? null;
  }

  if (step.type === "transfer") {
    return lastPolylinePoint ?? route.originStop?.coordinate ?? null;
  }

  if (
    step.type === "ride" ||
    step.type === "bus" ||
    step.type === "alight" ||
    step.type === "arrive"
  ) {
    return lastPolylinePoint ?? route.destinationStop?.coordinate ?? null;
  }

  return lastPolylinePoint ?? route.destinationStop?.coordinate ?? null;
}

// ====== STEP 13 RE-ROUTING HELPERS ======
const REROUTE_COOLDOWN_MS = 45_000;
const DEVIATION_CONFIRMATIONS_REQUIRED = 2;

function distanceToSegmentMeters(point: Coordinate, start: Coordinate, end: Coordinate) {
  const latFactor = 111320;
  const lonFactor =
    40075000 * Math.cos((point.latitude * Math.PI) / 180) / 360;

  const px = point.longitude * lonFactor;
  const py = point.latitude * latFactor;
  const ax = start.longitude * lonFactor;
  const ay = start.latitude * latFactor;
  const bx = end.longitude * lonFactor;
  const by = end.latitude * latFactor;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq <= 0) return distanceMeters(point, start);

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;

  const dx = px - cx;
  const dy = py - cy;

  return Math.sqrt(dx * dx + dy * dy);
}

function distanceToPolylineMeters(point: Coordinate, polyline?: Coordinate[]) {
  const points = safeArray<Coordinate>(polyline).filter(Boolean);
  if (points.length < 2) return Number.POSITIVE_INFINITY;

  let best = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = toCoordinate(points[i]);
    const end = toCoordinate(points[i + 1]);
    if (!start || !end) continue;

    const distance = distanceToSegmentMeters(point, start, end);
    if (distance < best) best = distance;
  }

  return best;
}

function activePolylineForDeviation(
  route: TransitRouteOption | null,
  currentStepIndex: number
): Coordinate[] {
  if (!route) return [];

  const steps = route.journeySteps || route.steps || [];
  const currentStep =
    steps[Math.max(0, Math.min(currentStepIndex, Math.max(0, steps.length - 1)))] || null;

  if (Array.isArray(currentStep?.polyline) && currentStep.polyline.length >= 2) {
    return currentStep.polyline.filter(Boolean) as Coordinate[];
  }

  if (Array.isArray(route.polyline) && route.polyline.length >= 2) {
    return route.polyline.filter(Boolean) as Coordinate[];
  }

  if (Array.isArray(route.previewPoints) && route.previewPoints.length >= 2) {
    return route.previewPoints.filter(Boolean) as Coordinate[];
  }

  return [];
}

function deviationThresholdForFlow(flowState: TransitFlowState) {
  if (flowState === "walking_to_stop" || flowState === "transfer") return 120;
  if (flowState === "waiting_bus") return 180;
  if (flowState === "onboard") return 420;
  if (flowState === "arriving") return 160;
  return 180;
}

function normalizePlace(item: ApiPlaceResult | any): PlaceSearchResult | null {
  const coordinate = toCoordinate(item);
  if (!coordinate) return null;

  return {
    id: String(item.id ?? item.stop_id ?? `${coordinate.latitude},${coordinate.longitude}`),
    title: String(item.title ?? item.name ?? item.stopName ?? item.stop_name ?? "Vieta"),
    subtitle: item.subtitle ?? item.address ?? item.description ?? item.stop_desc ?? "Klaipėda",
    type: item.type ?? (item.stop_id ? "stop" : "place"),
    distanceMeters: item.distanceMeters != null ? Number(item.distanceMeters) : undefined,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
  };
}

function normalizeStep(step: any, index: number): TransitStep {
  const rawType = String(step?.type ?? step?.mode ?? "bus");
  const type: TransitStepType =
    rawType === "walk" ||
    rawType === "transfer" ||
    rawType === "arrive" ||
    rawType === "board" ||
    rawType === "ride" ||
    rawType === "alight"
      ? (rawType as TransitStepType)
      : "bus";

  return {
    id: String(step?.id ?? `${type}-${index}`),
    type,
    mode: step?.mode,
    icon: step?.icon,
    title: String(step?.title ?? "Kelionės žingsnis"),
    subtitle: step?.subtitle,
    description: step?.description ?? step?.subtitle,
    routeId: step?.routeId != null ? String(step.routeId) : undefined,
    routeNumber:
      step?.routeNumber != null
        ? String(step.routeNumber)
        : step?.routeId != null
          ? String(step.routeId)
          : undefined,
    stopId: step?.stopId != null ? String(step.stopId) : undefined,
    stopName: step?.stopName,
    fromStopId: step?.fromStopId != null ? String(step.fromStopId) : undefined,
    toStopId: step?.toStopId != null ? String(step.toStopId) : undefined,
    fromStopName: step?.fromStopName ?? step?.fromStop ?? step?.from,
    toStopName: step?.toStopName ?? step?.toStop ?? step?.to,
    stopCount: step?.stopCount != null ? Number(step.stopCount) : undefined,
    minutes:
      step?.minutes != null
        ? Number(step.minutes)
        : step?.durationMinutes != null
          ? Number(step.durationMinutes)
          : undefined,
    durationMinutes:
      step?.durationMinutes != null
        ? Number(step.durationMinutes)
        : step?.minutes != null
          ? Number(step.minutes)
          : undefined,
    distanceMeters: step?.distanceMeters != null ? Number(step.distanceMeters) : undefined,
    departureTime: step?.departureTime ?? step?.departureText,
    arrivalTime: step?.arrivalTime ?? step?.arrivalText,
    polyline: Array.isArray(step?.polyline)
      ? (step.polyline.map(toCoordinate).filter(Boolean) as Coordinate[])
      : undefined,
  };
}

function stopPoint(name: string, coordinate: Coordinate, raw?: any) {
  const fixedCoordinate = toCoordinate(raw) ?? coordinate;
  return {
    id: raw?.id != null ? String(raw.id) : undefined,
    title: String(raw?.title ?? raw?.name ?? name),
    name: String(raw?.name ?? raw?.title ?? name),
    latitude: fixedCoordinate.latitude,
    longitude: fixedCoordinate.longitude,
    coordinate: fixedCoordinate,
    distanceMeters: raw?.distanceMeters != null ? Number(raw.distanceMeters) : undefined,
  };
}

function normalizeRoute(
  route: ApiTransitRouteOption | any,
  index: number,
  origin: Coordinate,
  destination: PlaceSearchResult
): TransitRouteOption {
  const summary = route?.summary ?? {};
  const apiSteps = safeArray(route?.journeySteps).length
    ? route.journeySteps
    : safeArray(route?.steps);

  const steps = apiSteps.map(normalizeStep);
  const routeLabel = String(route?.routeLabel ?? summary?.routeLabel ?? route?.title ?? "Autobusas");

  const routeNumbers = Array.isArray(route?.routeNumbers)
    ? route.routeNumbers.map(String).filter(Boolean)
    : routeLabel.split("→").map((part) => part.trim()).filter(Boolean);

  const previewPoints =
    Array.isArray(route?.previewPoints) && route.previewPoints.length >= 2
      ? (route.previewPoints.map(toCoordinate).filter(Boolean) as Coordinate[])
      : Array.isArray(route?.polyline) && route.polyline.length >= 2
        ? (route.polyline.map(toCoordinate).filter(Boolean) as Coordinate[])
        : [origin, destination.coordinate];

  const originStopCoordinate = toCoordinate(route?.originStop) ?? previewPoints[0] ?? origin;
  const destinationStopCoordinate =
    toCoordinate(route?.destinationStop) ??
    previewPoints[previewPoints.length - 1] ??
    destination.coordinate;

  const boardStopName = String(
    route?.boardStopName ?? summary?.boardStopName ?? route?.originStop?.name ?? "Artimiausia stotelė"
  );

  const alightStopName = String(
    route?.alightStopName ?? summary?.alightStopName ?? route?.destinationStop?.name ?? destination.title
  );

  const totalMinutes = Number(
    route?.totalMinutes ?? route?.totalDurationMinutes ?? summary?.totalDurationMinutes ?? 0
  );

  const walkingMinutes = Number(
    route?.walkingMinutes ?? route?.totalWalkMinutes ?? summary?.totalWalkMinutes ?? 0
  );

  const transfers = Number(
    route?.transfers ??
      route?.transfersCount ??
      summary?.transfersCount ??
      Math.max(0, routeNumbers.length - 1)
  );

  const stopCount = Number(
    route?.stopCount ??
      summary?.stopCount ??
      steps.reduce((sum: number, step: TransitStep) => sum + Number(step.stopCount ?? 0), 0)
  );

  return {
    id: String(route?.id ?? `route-${index}`),
    title: routeLabel,
    subtitle: route?.subtitle ?? summary?.journeyMessage ?? `${boardStopName} → ${alightStopName}`,
    mode: route?.mode,
    routeId: route?.routeId != null ? String(route.routeId) : undefined,
    shapeId: route?.shapeId ?? summary?.shapeId ?? null,
    routeLabel,
    routeNumbers,
    totalMinutes,
    totalDurationMinutes: totalMinutes,
    walkingMinutes,
    totalWalkMinutes: walkingMinutes,
    etaMinutes:
      route?.etaMinutes != null
        ? Number(route.etaMinutes)
        : summary?.etaMinutes != null
          ? Number(summary.etaMinutes)
          : null,
    liveEta: route?.liveEta ?? null,
    boardingState: route?.boardingState ?? null,
    transfers,
    transfersCount: transfers,
    stopCount,
    boardStopName,
    alightStopName,
    originStop: stopPoint(boardStopName, originStopCoordinate, route?.originStop),
    destinationStop: stopPoint(alightStopName, destinationStopCoordinate, route?.destinationStop),
    previewPoints,
    polyline: previewPoints,
    steps,
    journeySteps: steps,
    departureText:
      route?.departureText ??
      (summary?.etaMinutes != null ? `Atvyksta po ${summary.etaMinutes} min` : undefined),
    arrivalText: route?.arrivalText,
    journeyMessage: route?.journeyMessage ?? summary?.journeyMessage,
    totalBusMinutes: route?.totalBusMinutes ?? summary?.totalBusMinutes,
    headsign: route?.headsign ?? summary?.headsign ?? summary?.directionCode ?? null,
    liveVehicle: route?.liveVehicle ?? null,
    summary,
  } as TransitRouteOption;
}

function mergeRouteUpdate(route: TransitRouteOption, update: Partial<TransitRouteOption>): TransitRouteOption {
  return {
    ...route,
    ...update,
    summary: {
      ...(route.summary ?? {}),
      ...(update.summary ?? {}),
    },
  };
}

export function useTransitPlanner(userLocation: Coordinate | null) {
  const [flowState, setFlowState] = useState<TransitFlowState>("idle");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<PlaceSearchResult | null>(null);
  const [routeOptions, setRouteOptions] = useState<TransitRouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<TransitRouteOption | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [reroutingMessage, setReroutingMessage] = useState<string | null>(null);

  const selectedRouteRef = useRef<TransitRouteOption | null>(null);
  const lastAutoNavigationAt = useRef(0);
  const lastNavigationAlertAt = useRef(0);
  const lastNavigationAlertKey = useRef<string | null>(null);
  const lastRerouteAt = useRef(0);
  const deviationConfirmations = useRef(0);
  const rerouteInFlight = useRef(false);

  useEffect(() => {
    selectedRouteRef.current = selectedRoute;
  }, [selectedRoute]);

  const activeInstruction = useMemo(() => {
    if (!selectedRoute) return null;
    return selectedRoute.journeySteps?.[currentStepIndex] || null;
  }, [currentStepIndex, selectedRoute]);

  const applyRouteUpdate = useCallback((routeId: string, update: Partial<TransitRouteOption>) => {
    setRouteOptions((current) =>
      current.map((item) => (item.id === routeId ? mergeRouteUpdate(item, update) : item))
    );

    setSelectedRoute((current) =>
      current?.id === routeId ? mergeRouteUpdate(current, update) : current
    );
  }, []);

  const hydrateRouteDetails = useCallback(
    async (route: TransitRouteOption) => {
      try {
        const [shapePoints, liveEta] = await Promise.all([
          fetchTransitShape(route.shapeId).catch(() => []),
          fetchLiveEta(route).catch(() => null),
        ]);

        const update: Partial<TransitRouteOption> = {};

        if (Array.isArray(shapePoints) && shapePoints.length >= 2) {
          update.previewPoints = shapePoints;
          update.polyline = shapePoints;
        }

        if (liveEta?.eta) {
          update.liveEta = liveEta.eta;
          update.etaMinutes = liveEta.eta.etaMinutes;
          update.departureText = `Atvyksta po ${liveEta.eta.etaMinutes} min`;
        }

        if (liveEta?.boardingState) {
          update.boardingState = liveEta.boardingState;
        }

        if (liveEta?.vehicle) {
          update.liveVehicle = liveEta.vehicle;
        }

        if (Object.keys(update).length) {
          applyRouteUpdate(route.id, update);
        }
      } catch (e) {
        console.log("❌ HYDRATE ERROR:", e);
      }
    },
    [applyRouteUpdate]
  );

  useEffect(() => {
    const isActiveTrip = [
      "route_options",
      "route_selected",
      "walking_to_stop",
      "waiting_bus",
      "onboard",
      "transfer",
      "arriving",
    ].includes(flowState);

    if (!selectedRoute || !isActiveTrip) return;

    let cancelled = false;

    const refreshEta = async () => {
      const currentRoute = selectedRouteRef.current;
      if (!currentRoute || cancelled) return;

      try {
        const liveEta = await fetchLiveEta(currentRoute);
        if (!liveEta?.eta || cancelled) return;

        applyRouteUpdate(currentRoute.id, {
          liveEta: liveEta.eta,
          etaMinutes: liveEta.eta.etaMinutes,
          departureText: `Atvyksta po ${liveEta.eta.etaMinutes} min`,
          boardingState: liveEta.boardingState ?? currentRoute.boardingState,
          liveVehicle: liveEta.vehicle ?? currentRoute.liveVehicle,
        });
      } catch {
        // silent refresh
      }
    };

    void refreshEta();

    const timer = setInterval(refreshEta, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applyRouteUpdate, flowState, selectedRoute]);

  const runSearch = useCallback(
    async (text?: string) => {
      const nextQuery = (text ?? query).trim();
      setQuery(nextQuery);

      if (nextQuery.length < 2) {
        setSearchResults([]);
        setFlowState("idle");
        setError(null);
        return;
      }

      setFlowState("searching");
      setIsSearching(true);
      setError(null);
      setIsOffline(false);
      setOfflineMessage(null);

      try {
        const rawResults = await searchPlaces(nextQuery);
        const results = safeArray(rawResults)
          .map(normalizePlace)
          .filter(Boolean) as PlaceSearchResult[];

        setSearchResults(results);

        if (!results.length) {
          setError("Nieko nerasta");
        }
      } catch (err: any) {
        console.log("❌ SEARCH ERROR:", err);
        setError("Paieška nepavyko – patikrink internetą");
        setIsOffline(true);
        setOfflineMessage("Paieška neveikia be ryšio. Paskutinis maršrutas, jei yra, liks saugiai telefone.");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [query]
  );

  const selectDestination = useCallback(
    async (rawDestination: PlaceSearchResult) => {
      const destination = normalizePlace(rawDestination) ?? rawDestination;

      setSelectedDestination(destination);
      setSelectedRoute(null);
      setRouteOptions([]);
      setCurrentStepIndex(0);
      setError(null);
      setIsOffline(false);
      setOfflineMessage(null);
      setIsRerouting(false);
      setReroutingMessage(null);
      deviationConfirmations.current = 0;
      setFlowState("destination_selected");

      if (!userLocation) {
        setError("Lokacija nerasta");
        return;
      }

      setFlowState("routes_loading");
      setIsPlanning(true);

      try {
        let rawOptions: any[] = [];

        for (let i = 0; i < 2; i++) {
          try {
            rawOptions = await planTransitRoute({
              from: userLocation,
              to: destination.coordinate,
            });

            if (rawOptions?.length) break;
          } catch {
            if (i === 1) throw new Error("Backend neatsako");
            await sleep(500);
          }
        }

        const options = safeArray(rawOptions)
          .map((route, index) => normalizeRoute(route, index, userLocation, destination))
          .filter((route) => {
            return (
              route &&
              Array.isArray(route.previewPoints) &&
              route.previewPoints.length >= 2 &&
              Array.isArray(route.journeySteps) &&
              route.journeySteps.length > 0
            );
          });

        if (!options.length) {
          const fallback = {
            id: "fallback",
            title: "Eik pėsčiomis",
            routeLabel: "Walk",
            totalMinutes: 10,
            totalDurationMinutes: 10,
            walkingMinutes: 10,
            totalWalkMinutes: 10,
            routeNumbers: [],
            previewPoints: [userLocation, destination.coordinate],
            polyline: [userLocation, destination.coordinate],
            steps: [],
            journeySteps: [],
            originStop: {
              coordinate: userLocation,
            },
            destinationStop: {
              coordinate: destination.coordinate,
            },
          } as any;

          setRouteOptions([fallback]);
          setSelectedRoute(fallback);
          setFlowState("route_options");
          setError("⚠️ Autobusas nerastas – rodomas pėsčiųjų maršrutas");
          return;
        }

        await saveCachedTransitPlan({
          destination,
          routeOptions: options,
          selectedRoute: options[0] || null,
        });

        setRouteOptions(options);
        setSelectedRoute(options[0] || null);
        setCurrentStepIndex(0);

        if (options.length) {
          setFlowState("route_options");
          setError(null);
          void hydrateRouteDetails(options[0]);
        } else {
          setFlowState("destination_selected");
          setError("Maršrutų nerasta.");
        }
      } catch (err: any) {
        console.log("❌ ROUTE ERROR:", err);

        const cached = await loadCachedTransitPlan();
        if (cached) {
          setSelectedDestination(cached.destination);
          setRouteOptions(cached.routeOptions);
          setSelectedRoute(cached.selectedRoute || cached.routeOptions[0] || null);
          setCurrentStepIndex(0);
          setFlowState("route_options");
          setIsOffline(true);
          setOfflineMessage("Nėra stabilaus ryšio – rodome paskutinį išsaugotą maršrutą.");
          setError("Offline režimas: maršrutas paimtas iš telefono cache.");
          return;
        }

        setIsOffline(true);
        setOfflineMessage("Nepavyko prisijungti prie maršrutų serverio ir telefone nėra išsaugoto maršruto.");
        setError(err?.message || "Nepavyko suplanuoti maršruto");
        setRouteOptions([]);
        setSelectedRoute(null);
        setFlowState("destination_selected");
      } finally {
        setIsPlanning(false);
      }
    },
    [hydrateRouteDetails, userLocation]
  );

  const chooseRoute = useCallback(
    (route: TransitRouteOption) => {
      setSelectedRoute(route);
      setCurrentStepIndex(0);
      setFlowState("route_selected");
      void hydrateRouteDetails(route);
    },
    [hydrateRouteDetails]
  );

  const startJourney = useCallback(() => {
    if (!selectedRoute) return;

    setCurrentStepIndex(0);

    const firstType = selectedRoute.journeySteps?.[0]?.type;

    if (firstType === "walk") {
      setFlowState("walking_to_stop");
    } else {
      setFlowState("waiting_bus");
    }

    void hydrateRouteDetails(selectedRoute);
  }, [hydrateRouteDetails, selectedRoute]);

  const nextStep = useCallback(() => {
    if (!selectedRoute) return;

    setCurrentStepIndex((index: number) => {
      const nextIndex = Math.min(
        index + 1,
        Math.max(0, (selectedRoute.journeySteps?.length || 1) - 1)
      );

      const nextStepType = selectedRoute.journeySteps?.[nextIndex]?.type;

      if (nextStepType === "walk") setFlowState("walking_to_stop");
      else if (nextStepType === "board") setFlowState("waiting_bus");
      else if (nextStepType === "ride") setFlowState("onboard");
      else if (nextStepType === "alight") setFlowState("arriving");
      else if (nextStepType === "transfer") setFlowState("transfer");
      else setFlowState("route_selected");

      return nextIndex;
    });
  }, [selectedRoute]);


  const triggerNavigationAlert = useCallback(
    async ({
      key,
      title,
      message,
      type = "success",
    }: {
      key: string;
      title: string;
      message: string;
      type?: "success" | "warning" | "error";
    }) => {
      const now = Date.now();
      const sameAlert = lastNavigationAlertKey.current === key;

      // Apsauga, kad tas pats alertas nesikartotų kas sekundę.
      if (sameAlert && now - lastNavigationAlertAt.current < 60_000) return;
      if (!sameAlert && now - lastNavigationAlertAt.current < 3500) return;

      lastNavigationAlertAt.current = now;
      lastNavigationAlertKey.current = key;

      try {
        const feedbackType =
          type === "warning"
            ? Haptics.NotificationFeedbackType.Warning
            : type === "error"
              ? Haptics.NotificationFeedbackType.Error
              : Haptics.NotificationFeedbackType.Success;

        await Haptics.notificationAsync(feedbackType);
      } catch {
        // Haptics gali neveikti simuliatoriuje arba kai kuriuose įrenginiuose.
      }

      try {
        Alert.alert(title, message);
      } catch {
        // Alert neturi blokuoti navigation flow.
      }
    },
    []
  );

  const performReroute = useCallback(
    async (reason: string) => {
      if (!userLocation || !selectedDestination) return;
      if (rerouteInFlight.current) return;

      const now = Date.now();
      if (now - lastRerouteAt.current < REROUTE_COOLDOWN_MS) return;

      rerouteInFlight.current = true;
      lastRerouteAt.current = now;
      deviationConfirmations.current = 0;
      setIsRerouting(true);
      setReroutingMessage(reason);
      setError(reason);

      try {
        void triggerNavigationAlert({
          key: `rerouting-${now}`,
          title: "Perskaičiuojame maršrutą",
          message: reason,
          type: "warning",
        });

        let rawOptions: any[] = [];

        for (let i = 0; i < 2; i += 1) {
          try {
            rawOptions = await planTransitRoute({
              from: userLocation,
              to: selectedDestination.coordinate,
              destination: selectedDestination,
            });

            if (rawOptions?.length) break;
          } catch {
            if (i === 1) throw new Error("Nepavyko perskaičiuoti maršruto");
            await sleep(500);
          }
        }

        const options = safeArray(rawOptions)
          .map((route, index) => normalizeRoute(route, index, userLocation, selectedDestination))
          .filter((route) => {
            return (
              route &&
              Array.isArray(route.previewPoints) &&
              route.previewPoints.length >= 2 &&
              Array.isArray(route.journeySteps) &&
              route.journeySteps.length > 0
            );
          });

        if (!options.length) {
          throw new Error("Naujo maršruto nerasta");
        }

        await saveCachedTransitPlan({
          destination: selectedDestination,
          routeOptions: options,
          selectedRoute: options[0] || null,
        });

        setRouteOptions(options);
        setSelectedRoute(options[0]);
        setCurrentStepIndex(0);
        setFlowState("route_options");
        setError(null);
        setReroutingMessage(null);

        void hydrateRouteDetails(options[0]);
      } catch (err: any) {
        const message = err?.message || "Perskaičiavimas nepavyko";
        setError(message);
        setReroutingMessage(message);
        setIsOffline(true);
        setOfflineMessage("Perskaičiavimas nepavyko – paliekame dabartinį maršrutą ir bandysime vėliau.");

        void triggerNavigationAlert({
          key: `rerouting-error-${now}`,
          title: "Nepavyko perskaičiuoti",
          message,
          type: "error",
        });
      } finally {
        setIsRerouting(false);
        rerouteInFlight.current = false;
      }
    },
    [hydrateRouteDetails, selectedDestination, triggerNavigationAlert, userLocation]
  );

  // ====== STEP 9 REAL GPS NAVIGATION ENGINE + STEP 11 ALERTS ======
  useEffect(() => {
    if (!userLocation || !selectedRoute) return;
    if (!isActiveNavigationState(flowState)) return;

    const steps = selectedRoute.journeySteps || selectedRoute.steps || [];
    if (!steps.length) return;

    const safeIndex = Math.min(
      Math.max(0, currentStepIndex),
      Math.max(0, steps.length - 1)
    );

    const currentStep = steps[safeIndex];
    const target = targetForStep(selectedRoute, currentStep);

    if (!target) return;

    const distanceToTarget = distanceMeters(userLocation, target);
    const distanceToAlight = selectedRoute.destinationStop?.coordinate
      ? distanceMeters(userLocation, selectedRoute.destinationStop.coordinate)
      : Number.POSITIVE_INFINITY;

    const now = Date.now();

    if (now - lastAutoNavigationAt.current < 4500) return;

    if (distanceToAlight <= 35 && flowState !== "completed") {
      lastAutoNavigationAt.current = now;
      void triggerNavigationAlert({
        key: `completed-${selectedRoute.id}`,
        title: "Atvykai",
        message: "Kelionė baigta. Gali planuoti kitą maršrutą.",
        type: "success",
      });
      setFlowState("completed");
      setCurrentStepIndex(Math.max(0, steps.length - 1));
      return;
    }

    if (distanceToAlight <= 110 && flowState !== "arriving") {
      lastAutoNavigationAt.current = now;
      void triggerNavigationAlert({
        key: `alight-soon-${selectedRoute.id}`,
        title: "Pasiruošk išlipti",
        message: `Artėji prie ${selectedRoute.alightStopName || "išlipimo stotelės"}.`,
        type: "warning",
      });
      setFlowState("arriving");

      const alightIndex = steps.findIndex(
        (step) => step.type === "alight" || step.type === "arrive"
      );

      if (alightIndex >= 0) {
        setCurrentStepIndex(alightIndex);
      }

      return;
    }

    if (currentStep?.type === "walk" && distanceToTarget <= 55) {
      lastAutoNavigationAt.current = now;
      void triggerNavigationAlert({
        key: `stop-reached-${selectedRoute.id}-${safeIndex}`,
        title: "Stotelė pasiekta",
        message: `Lauk autobuso ${selectedRoute.routeLabel || ""}.`.trim(),
        type: "success",
      });
      setFlowState("waiting_bus");
      setCurrentStepIndex((index) =>
        Math.min(index + 1, Math.max(0, steps.length - 1))
      );
      return;
    }

    if (currentStep?.type === "board") {
      const eta = selectedRoute.liveEta?.etaMinutes ?? selectedRoute.etaMinutes ?? null;

      const shouldBoard =
        selectedRoute.boardingState === "boarding_soon" ||
        (eta != null && eta <= 2);

      if (shouldBoard) {
        lastAutoNavigationAt.current = now;
        void triggerNavigationAlert({
          key: `board-now-${selectedRoute.id}-${safeIndex}`,
          title: "Lipk dabar",
          message: `Autobusas ${selectedRoute.routeLabel || ""} atvyko. Lipk į autobusą.`.trim(),
          type: "warning",
        });
        setFlowState("onboard");
        setCurrentStepIndex((index) =>
          Math.min(index + 1, Math.max(0, steps.length - 1))
        );
        return;
      }
    }

    if (
      (currentStep?.type === "ride" || currentStep?.type === "bus") &&
      distanceToTarget <= 90
    ) {
      lastAutoNavigationAt.current = now;
      void triggerNavigationAlert({
        key: `alight-now-${selectedRoute.id}-${safeIndex}`,
        title: "Išlipk dabar",
        message: `Išlipk stotelėje ${selectedRoute.alightStopName || "čia"}.`,
        type: "warning",
      });
      setFlowState("arriving");
      setCurrentStepIndex((index) =>
        Math.min(index + 1, Math.max(0, steps.length - 1))
      );
      return;
    }

    if (currentStep?.type === "transfer" && distanceToTarget <= 55) {
      lastAutoNavigationAt.current = now;
      void triggerNavigationAlert({
        key: `transfer-${selectedRoute.id}-${safeIndex}`,
        title: "Persėsk",
        message: "Eik į kitą stotelę ir lauk kito autobuso.",
        type: "warning",
      });
      setFlowState("waiting_bus");
      setCurrentStepIndex((index) =>
        Math.min(index + 1, Math.max(0, steps.length - 1))
      );
    }
  }, [currentStepIndex, flowState, selectedRoute, triggerNavigationAlert, userLocation]);

  // ====== STEP 13 RE-ROUTING ENGINE ======
  useEffect(() => {
    if (!userLocation || !selectedRoute || !selectedDestination) return;
    if (!isActiveNavigationState(flowState)) return;
    if (flowState === "waiting_bus") return;
    if (isRerouting || rerouteInFlight.current) return;

    const routeLine = activePolylineForDeviation(selectedRoute, currentStepIndex);
    if (routeLine.length < 2) return;

    const distanceFromRoute = distanceToPolylineMeters(userLocation, routeLine);
    const threshold = deviationThresholdForFlow(flowState);

    if (!Number.isFinite(distanceFromRoute)) return;

    if (distanceFromRoute <= threshold) {
      deviationConfirmations.current = 0;
      if (reroutingMessage) setReroutingMessage(null);
      return;
    }

    deviationConfirmations.current += 1;

    if (deviationConfirmations.current < DEVIATION_CONFIRMATIONS_REQUIRED) {
      setReroutingMessage(
        `Tikriname nukrypimą nuo maršruto (${Math.round(distanceFromRoute)} m)`
      );
      return;
    }

    void performReroute(
      `Nukrypai nuo maršruto apie ${Math.round(distanceFromRoute)} m. Perskaičiuojame geriausią kelią.`
    );
  }, [
    currentStepIndex,
    flowState,
    isRerouting,
    performReroute,
    reroutingMessage,
    selectedDestination,
    selectedRoute,
    userLocation,
  ]);

  const resetPlanner = useCallback(() => {
    setFlowState("idle");
    setQuery("");
    setSearchResults([]);
    setSelectedDestination(null);
    setRouteOptions([]);
    setSelectedRoute(null);
    setCurrentStepIndex(0);
    setIsSearching(false);
    setIsPlanning(false);
    setError(null);
    setIsOffline(false);
    setOfflineMessage(null);
    setIsRerouting(false);
    setReroutingMessage(null);
    deviationConfirmations.current = 0;
    rerouteInFlight.current = false;
  }, []);

  return {
    flowState,
    query,
    setQuery,
    searchResults,
    selectedDestination,
    routeOptions,
    selectedRoute,
    activeInstruction,
    currentStepIndex,
    isSearching,
    isPlanning,
    error,
    isOffline,
    offlineMessage,
    isRerouting,
    reroutingMessage,
    runSearch,
    selectDestination,
    chooseRoute,
    startJourney,
    nextStep,
    resetPlanner,
  };
}
