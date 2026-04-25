import { useCallback, useMemo, useState } from "react";
import type {
  Coordinate,
  PlaceSearchResult,
  TransitFlowState,
  TransitRouteOption,
  TransitStep,
  TransitStepType,
} from "../models/transitTypes";
import {
  planTransitRoute,
  searchPlaces,
  type PlaceResult as ApiPlaceResult,
  type TransitRouteOption as ApiTransitRouteOption,
} from "../services/transitApi";

function toCoordinate(input: any): Coordinate | null {
  const latitude = Number(input?.latitude ?? input?.lat ?? input?.coordinate?.latitude);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng ?? input?.coordinate?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
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
  const rawType = String(step?.type ?? "bus");
  const type: TransitStepType =
    rawType === "walk" || rawType === "transfer" || rawType === "arrive" ? rawType : "bus";

  return {
    id: String(step?.id ?? index),
    type,
    title: String(step?.title ?? (type === "walk" ? "Eik iki stotelės" : "Važiuok autobusu")),
    subtitle: step?.subtitle,
    description: step?.description ?? step?.subtitle,
    routeNumber: step?.routeNumber ?? step?.route ?? step?.routeId,
    fromStopName: step?.fromStopName ?? step?.fromStop ?? step?.from,
    toStopName: step?.toStopName ?? step?.toStop ?? step?.to,
    stopCount: step?.stopCount != null ? Number(step.stopCount) : undefined,
    minutes: step?.minutes != null ? Number(step.minutes) : undefined,
    durationMinutes: step?.durationMinutes != null ? Number(step.durationMinutes) : step?.minutes != null ? Number(step.minutes) : undefined,
    departureTime: step?.departureTime ?? step?.departureText,
    arrivalTime: step?.arrivalTime ?? step?.arrivalText,
    polyline: Array.isArray(step?.polyline) ? step.polyline.map(toCoordinate).filter(Boolean) as Coordinate[] : undefined,
  };
}

function stopPoint(name: string, coordinate: Coordinate) {
  return {
    title: name,
    name,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
  };
}

function normalizeRoute(route: ApiTransitRouteOption | any, index: number, origin: Coordinate, destination: PlaceSearchResult): TransitRouteOption {
  const apiSteps = Array.isArray(route?.steps) ? route.steps : [];
  const steps = apiSteps.map(normalizeStep);
  const routeNumbers = Array.isArray(route?.routeNumbers)
    ? route.routeNumbers.map(String).filter(Boolean)
    : steps.map((s: TransitStep) => s.routeNumber).filter(Boolean).map(String);

  const routeLabel = String(route?.routeLabel ?? routeNumbers[0] ?? route?.routeNumber ?? "BUS");

  const polyline = Array.isArray(route?.polyline)
    ? (route.polyline.map(toCoordinate).filter(Boolean) as Coordinate[])
    : Array.isArray(route?.coordinates)
      ? (route.coordinates.map(toCoordinate).filter(Boolean) as Coordinate[])
      : [];

  const previewPoints = polyline.length >= 2 ? polyline : [origin, destination.coordinate];

  const firstBusStep = steps.find((s: TransitStep) => s.type === "bus");
  const boardStopName = String(route?.boardStopName ?? firstBusStep?.fromStopName ?? "Artimiausia stotelė");
  const alightStopName = String(route?.alightStopName ?? firstBusStep?.toStopName ?? destination.title);

  const originStopCoordinate = toCoordinate(route?.originStop) ?? previewPoints[0] ?? origin;
  const destinationStopCoordinate = toCoordinate(route?.destinationStop) ?? previewPoints[previewPoints.length - 1] ?? destination.coordinate;

  const totalMinutes = Number(route?.totalMinutes ?? route?.minutes ?? route?.totalDurationMinutes ?? 0);
  const walkingMinutes = Number(route?.walkingMinutes ?? route?.totalWalkMinutes ?? 0);
  const transfers = Number(route?.transfers ?? route?.transfersCount ?? Math.max(0, routeNumbers.length - 1));
  const stopCount = Number(route?.stopCount ?? steps.reduce((sum: number, step: TransitStep) => sum + Number(step.stopCount ?? 0), 0));

  return {
    id: String(route?.id ?? index),
    title: String(route?.title ?? `Autobusas ${routeLabel}`),
    subtitle: route?.subtitle ?? route?.summary ?? undefined,
    routeLabel,
    routeNumbers,
    totalMinutes,
    totalDurationMinutes: Number(route?.totalDurationMinutes ?? totalMinutes),
    walkingMinutes,
    totalWalkMinutes: Number(route?.totalWalkMinutes ?? walkingMinutes),
    etaMinutes: route?.etaMinutes != null ? Number(route.etaMinutes) : null,
    transfers,
    transfersCount: transfers,
    stopCount,
    boardStopName,
    alightStopName,
    originStop: stopPoint(boardStopName, originStopCoordinate),
    destinationStop: stopPoint(alightStopName, destinationStopCoordinate),
    previewPoints,
    polyline: previewPoints,
    steps,
    journeySteps: steps,
    departureText: route?.departureText,
    arrivalText: route?.arrivalText,
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

  const activeInstruction = useMemo(() => {
    if (!selectedRoute) return null;
    return selectedRoute.journeySteps[currentStepIndex] || null;
  }, [currentStepIndex, selectedRoute]);

  const runSearch = useCallback(async (text?: string) => {
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

    try {
      const rawResults = await searchPlaces(nextQuery);
      const results = rawResults.map(normalizePlace).filter(Boolean) as PlaceSearchResult[];
      setSearchResults(results);
      if (!results.length) setError("Nieko nerasta. Pabandyk įvesti stotelę, adresą arba vietą.");
    } catch (err: any) {
      setError(err?.message || "Paieška nepavyko");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const selectDestination = useCallback(async (rawDestination: PlaceSearchResult) => {
    const destination = normalizePlace(rawDestination) ?? rawDestination;

    setSelectedDestination(destination);
    setSelectedRoute(null);
    setRouteOptions([]);
    setCurrentStepIndex(0);
    setFlowState("destination_selected");

    if (!userLocation) {
      setError("Nepavyko gauti tavo lokacijos");
      return;
    }

    setFlowState("routes_loading");
    setIsPlanning(true);
    setError(null);

    try {
      const rawOptions = await planTransitRoute({
  from: userLocation,
  to: destination.coordinate,
  destination: {
    id: "destination",
    title: destination.title ?? "Tikslas",
    subtitle: destination.subtitle ?? "",
    coordinate: destination.coordinate,
    latitude: destination.coordinate.latitude,
    longitude: destination.coordinate.longitude,
    type: "destination",
    distanceMeters: 0,
  },
});

      const options = rawOptions.map((route, index) => normalizeRoute(route, index, userLocation, destination));
      setRouteOptions(options);
      setSelectedRoute(options[0] || null);
      setFlowState(options.length ? "route_options" : "destination_selected");

      if (!options.length) {
        setError("Maršrutų nerasta. Pabandyk kitą vietą arba patikrink backend/GTFS.");
      }
    } catch (err: any) {
      setError(err?.message || "Maršruto planavimas nepavyko");
      setFlowState("destination_selected");
    } finally {
      setIsPlanning(false);
    }
  }, [userLocation]);

  const chooseRoute = useCallback((route: TransitRouteOption) => {
    setSelectedRoute(route);
    setCurrentStepIndex(0);
    setFlowState("route_selected");
  }, []);

  const startJourney = useCallback(() => {
    if (!selectedRoute) return;
    setCurrentStepIndex(0);
    setFlowState("walking_to_stop");
  }, [selectedRoute]);

  const nextStep = useCallback(() => {
    setFlowState((state: TransitFlowState) => {
      if (state === "route_selected") return "walking_to_stop";
      if (state === "walking_to_stop") return "waiting_bus";
      if (state === "waiting_bus") return "onboard";
      if (state === "onboard") return (selectedRoute?.transfersCount || 0) > 0 ? "transfer" : "arriving";
      if (state === "transfer") return "onboard";
      if (state === "arriving") return "completed";
      return state;
    });

    setCurrentStepIndex((index: number) => Math.min(index + 1, Math.max(0, (selectedRoute?.journeySteps.length || 1) - 1)));
  }, [selectedRoute]);

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
    runSearch,
    selectDestination,
    chooseRoute,
    startJourney,
    nextStep,
    resetPlanner,
  };
}
