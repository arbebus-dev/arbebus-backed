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
  const latitude = Number(
    input?.latitude ?? input?.lat ?? input?.coordinate?.latitude
  );
  const longitude = Number(
    input?.longitude ?? input?.lon ?? input?.lng ?? input?.coordinate?.longitude
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function normalizePlace(item: ApiPlaceResult | any): PlaceSearchResult | null {
  const coordinate = toCoordinate(item);
  if (!coordinate) return null;

  return {
    id: String(item.id ?? item.stop_id ?? `${coordinate.latitude},${coordinate.longitude}`),
    title: String(item.title ?? item.name ?? item.stopName ?? item.stop_name ?? "Vieta"),
    subtitle:
      item.subtitle ??
      item.address ??
      item.description ??
      item.stop_desc ??
      "Klaipėda",
    type: item.type ?? (item.stop_id ? "stop" : "place"),
    distanceMeters:
      item.distanceMeters != null ? Number(item.distanceMeters) : undefined,
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
    title: String(
      step?.title ??
        (type === "walk"
          ? "Eik iki stotelės"
          : type === "board"
            ? "Lipk į autobusą"
            : type === "alight"
              ? "Išlipk"
              : "Važiuok autobusu")
    ),
    subtitle: step?.subtitle,
    description: step?.description ?? step?.subtitle,
    routeNumber:
      step?.routeNumber != null
        ? String(step.routeNumber)
        : step?.route != null
          ? String(step.route)
          : step?.routeId != null
            ? String(step.routeId)
            : undefined,
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
    departureTime: step?.departureTime ?? step?.departureText,
    arrivalTime: step?.arrivalTime ?? step?.arrivalText,
    polyline: Array.isArray(step?.polyline)
      ? (step.polyline.map(toCoordinate).filter(Boolean) as Coordinate[])
      : undefined,
  } as TransitStep;
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
    distanceMeters:
      raw?.distanceMeters != null ? Number(raw.distanceMeters) : undefined,
  };
}

function normalizeRoute(
  route: ApiTransitRouteOption | any,
  index: number,
  origin: Coordinate,
  destination: PlaceSearchResult
): TransitRouteOption {
  const summary = route?.summary ?? {};

  const apiSteps = Array.isArray(route?.journeySteps)
    ? route.journeySteps
    : Array.isArray(route?.steps)
      ? route.steps
      : [];

  const steps = apiSteps.map(normalizeStep);

  const routeLabel = String(
    route?.routeLabel ??
      summary?.routeLabel ??
      route?.title ??
      "Autobusas"
  );

  const routeNumbers = Array.isArray(route?.routeNumbers)
    ? route.routeNumbers.map(String).filter(Boolean)
    : routeLabel
        .split("→")
        .map((part) => part.trim())
        .filter(Boolean);

  const previewPoints =
    Array.isArray(route?.previewPoints) && route.previewPoints.length >= 2
      ? (route.previewPoints.map(toCoordinate).filter(Boolean) as Coordinate[])
      : Array.isArray(route?.polyline) && route.polyline.length >= 2
        ? (route.polyline.map(toCoordinate).filter(Boolean) as Coordinate[])
        : [origin, destination.coordinate];

  const originStopCoordinate =
    toCoordinate(route?.originStop) ?? previewPoints[0] ?? origin;

  const destinationStopCoordinate =
    toCoordinate(route?.destinationStop) ??
    previewPoints[previewPoints.length - 1] ??
    destination.coordinate;

  const boardStopName = String(
    route?.boardStopName ??
      summary?.boardStopName ??
      route?.originStop?.name ??
      "Artimiausia stotelė"
  );

  const alightStopName = String(
    route?.alightStopName ??
      summary?.alightStopName ??
      route?.destinationStop?.name ??
      destination.title
  );

  const totalMinutes = Number(
    route?.totalMinutes ??
      route?.totalDurationMinutes ??
      summary?.totalDurationMinutes ??
      0
  );

  const walkingMinutes = Number(
    route?.walkingMinutes ??
      route?.totalWalkMinutes ??
      summary?.totalWalkMinutes ??
      0
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
      steps.reduce((sum: number, step: TransitStep) => {
        return sum + Number(step.stopCount ?? 0);
      }, 0)
  );

  return {
    id: String(route?.id ?? `route-${index}`),
    title: routeLabel,
    subtitle:
      route?.subtitle ??
      summary?.journeyMessage ??
      `${boardStopName} → ${alightStopName}`,
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
    transfers,
    transfersCount: transfers,
    stopCount,
    boardStopName,
    alightStopName,
    originStop: stopPoint(boardStopName, originStopCoordinate, route?.originStop),
    destinationStop: stopPoint(
      alightStopName,
      destinationStopCoordinate,
      route?.destinationStop
    ),
    previewPoints,
    polyline: previewPoints,
    steps,
    journeySteps: steps,
    departureText:
      route?.departureText ??
      (summary?.etaMinutes != null
        ? `Atvyksta po ${summary.etaMinutes} min`
        : undefined),
    arrivalText: route?.arrivalText,
    journeyMessage: route?.journeyMessage ?? summary?.journeyMessage,
    totalBusMinutes: route?.totalBusMinutes ?? summary?.totalBusMinutes,
    headsign:
      route?.headsign ??
      summary?.headsign ??
      summary?.directionCode ??
      null,
    liveVehicle: route?.liveVehicle ?? null,
    summary,
  } as TransitRouteOption;
}

export function useTransitPlanner(userLocation: Coordinate | null) {
  const [flowState, setFlowState] = useState<TransitFlowState>("idle");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [selectedDestination, setSelectedDestination] =
    useState<PlaceSearchResult | null>(null);
  const [routeOptions, setRouteOptions] = useState<TransitRouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] =
    useState<TransitRouteOption | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeInstruction = useMemo(() => {
    if (!selectedRoute) return null;
    return selectedRoute.journeySteps?.[currentStepIndex] || null;
  }, [currentStepIndex, selectedRoute]);

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

      try {
        const rawResults = await searchPlaces(nextQuery);
        const results = rawResults
          .map(normalizePlace)
          .filter(Boolean) as PlaceSearchResult[];

        setSearchResults(results);

        if (!results.length) {
          setError("Nieko nerasta. Įvesk vietą, stotelę arba miestą.");
        }
      } catch (err: any) {
        setError(err?.message || "Paieška nepavyko");
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
      setFlowState("destination_selected");

      if (!userLocation) {
        setError("Nepavyko gauti tavo lokacijos");
        return;
      }

      setFlowState("routes_loading");
      setIsPlanning(true);

      try {
        const rawOptions = await planTransitRoute({
          from: userLocation,
          to: destination.coordinate,
          destination: {
            id: destination.id ?? "destination",
            title: destination.title ?? "Tikslas",
            subtitle: destination.subtitle ?? "",
            coordinate: destination.coordinate,
            latitude: destination.coordinate.latitude,
            longitude: destination.coordinate.longitude,
            type: destination.type ?? "destination",
            distanceMeters: destination.distanceMeters ?? 0,
          },
        });

        const options = rawOptions
          .map((route, index) =>
            normalizeRoute(route, index, userLocation, destination)
          )
          .filter((route) => {
            return (
              Array.isArray(route.previewPoints) &&
              route.previewPoints.length >= 2 &&
              Array.isArray(route.journeySteps) &&
              route.journeySteps.length > 0
            );
          });

        setRouteOptions(options);
        setSelectedRoute(options[0] || null);
        setCurrentStepIndex(0);

        if (options.length) {
          setFlowState("route_options");
          setError(null);
        } else {
          setFlowState("destination_selected");
          setError("Maršrutų nerasta. Backend atsakė, bet nėra tinkamų steps/polyline.");
        }
      } catch (err: any) {
        setError(err?.message || "Maršruto planavimas nepavyko");
        setFlowState("destination_selected");
        setRouteOptions([]);
        setSelectedRoute(null);
      } finally {
        setIsPlanning(false);
      }
    },
    [userLocation]
  );

  const chooseRoute = useCallback((route: TransitRouteOption) => {
    setSelectedRoute(route);
    setCurrentStepIndex(0);
    setFlowState("route_selected");
  }, []);

  const startJourney = useCallback(() => {
    if (!selectedRoute) return;

    setCurrentStepIndex(0);

    const firstType = selectedRoute.journeySteps?.[0]?.type;
    if (firstType === "walk") {
      setFlowState("walking_to_stop");
    } else {
      setFlowState("waiting_bus");
    }
  }, [selectedRoute]);

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