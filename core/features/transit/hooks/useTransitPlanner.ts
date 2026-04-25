import { useCallback, useMemo, useRef, useState } from "react";
import type { TransitFlowState } from "../models/transitFlowState";
import type { Coordinate, TransitPlan, TransitRouteOption, TransitStep, TransitStop } from "../models/transitRoute";
import { KLAIPEDA_DEFAULT_LOCATION, planTransitRoute, searchTransitStops } from "../services/transitApi";

function stateForStep(step: TransitStep | null): TransitFlowState {
  if (!step) return "completed";
  if (step.type === "walk") return "walking_to_stop";
  if (step.type === "transfer") return "transfer";
  if (step.type === "arrive") return "arriving";
  if (step.type === "bus") {
    const title = step.title.toLowerCase();
    if (title.includes("važiuok")) return "onboard";
    return "waiting_bus";
  }
  return "walking_to_stop";
}

export function useTransitPlanner(userLocation: Coordinate | null) {
  const [flowState, setFlowState] = useState<TransitFlowState>("idle");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TransitStop[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<TransitStop | null>(null);
  const [plan, setPlan] = useState<TransitPlan | null>(null);
  const [selectedRouteId, setSelectedRouteIdState] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRunRef = useRef(0);

  const selectedRoute = useMemo<TransitRouteOption | null>(() => {
    if (!plan) return null;
    return plan.routes.find((route) => route.id === selectedRouteId) ?? plan.routes[0] ?? null;
  }, [plan, selectedRouteId]);

  const activeStep = selectedRoute?.steps?.[activeStepIndex] ?? null;

  const search = useCallback(async (value: string) => {
    setQuery(value);
    setError(null);

    const cleanValue = value.trim();
    if (cleanValue.length < 2) {
      setResults([]);
      setSelectedDestination(null);
      setPlan(null);
      setSelectedRouteIdState(null);
      setActiveStepIndex(0);
      setFlowState("idle");
      return;
    }

    const runId = ++searchRunRef.current;
    setIsSearching(true);
    setFlowState("searching");

    try {
      const nextResults = await searchTransitStops(cleanValue, userLocation ?? KLAIPEDA_DEFAULT_LOCATION);
      if (runId !== searchRunRef.current) return;
      setResults(nextResults);
    } catch (searchError) {
      console.warn("Search failed", searchError);
      if (runId === searchRunRef.current) setError("Nepavyko rasti stotelių");
    } finally {
      if (runId === searchRunRef.current) setIsSearching(false);
    }
  }, [userLocation]);

  const selectDestination = useCallback(async (stop: TransitStop) => {
    const origin = userLocation ?? KLAIPEDA_DEFAULT_LOCATION;
    setSelectedDestination(stop);
    setQuery(stop.title);
    setResults([]);
    setError(null);
    setPlan(null);
    setSelectedRouteIdState(null);
    setActiveStepIndex(0);
    setFlowState("destination_selected");
    setIsPlanning(true);

    try {
      setFlowState("routes_loading");
      const nextPlan = await planTransitRoute({ origin, destination: stop.coordinate, destinationLabel: stop.title });
      setPlan(nextPlan);
      setSelectedRouteIdState(nextPlan.selectedRouteId);
      setFlowState("route_options");
    } catch (planningError) {
      console.warn("Planning failed", planningError);
      setError("Nepavyko suplanuoti maršruto");
      setFlowState("destination_selected");
    } finally {
      setIsPlanning(false);
    }
  }, [userLocation]);

  const setSelectedRouteId = useCallback((routeId: string) => {
    setSelectedRouteIdState(routeId);
    setActiveStepIndex(0);
    setFlowState("route_selected");
  }, []);

  const startRoute = useCallback(() => {
    if (!selectedRoute) return;
    setActiveStepIndex(0);
    setFlowState(stateForStep(selectedRoute.steps[0] ?? null));
  }, [selectedRoute]);

  const nextStep = useCallback(() => {
    if (!selectedRoute) return;
    const nextIndex = activeStepIndex + 1;
    if (nextIndex >= selectedRoute.steps.length) {
      setFlowState("completed");
      return;
    }
    const nextStepValue = selectedRoute.steps[nextIndex];
    setActiveStepIndex(nextIndex);
    setFlowState(stateForStep(nextStepValue));
  }, [activeStepIndex, selectedRoute]);

  const complete = useCallback(() => setFlowState("completed"), []);

  const clear = useCallback(() => {
    searchRunRef.current += 1;
    setFlowState("idle");
    setQuery("");
    setResults([]);
    setSelectedDestination(null);
    setPlan(null);
    setSelectedRouteIdState(null);
    setActiveStepIndex(0);
    setIsSearching(false);
    setIsPlanning(false);
    setError(null);
  }, []);

  return {
    flowState,
    query,
    results,
    selectedDestination,
    plan,
    selectedRouteId,
    selectedRoute,
    activeStepIndex,
    activeStep,
    isSearching,
    isPlanning,
    error,
    search,
    clear,
    selectDestination,
    setSelectedRouteId,
    startRoute,
    nextStep,
    complete,
  };
}
