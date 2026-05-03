import type { TransitFlowState, TransitRouteOption, TransitStep } from "./transitTypes";

export type JourneyStage = "routes_list" | "route_details" | "active_step" | "navigation";
export type JourneyActionKind =
  | "search"
  | "choose_route"
  | "start_walk"
  | "wait_bus"
  | "board_bus"
  | "ride_bus"
  | "transfer"
  | "alight"
  | "complete";

export type JourneyViewModel = {
  stage: JourneyStage;
  title: string;
  subtitle: string;
  primaryCta: string;
  action: JourneyActionKind;
  activeStepIndex: number;
  activeStep: TransitStep | null;
  progressLabel: string;
  progressPercent: number;
  routeNumbers: string[];
  durationMinutes: number;
  walkingMinutes: number;
  busMinutes: number;
  transfersCount: number;
  stopCount: number;
  boardStopName: string;
  alightStopName: string;
  etaMinutes: number | null;
  routeLabel: string;
};

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function cleanRouteNumber(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/^Maršrutas\s+/i, "").replace(/^Autobusas\s+/i, "").split("•")[0].trim();
  const technicalMatch = cleaned.match(/(?:^|[_\s-])((?:M|A)?\d{1,3}[A-Z]?)(?:[_\s-]|$)/i);
  if (technicalMatch?.[1]) return technicalMatch[1].toUpperCase();
  const directMatch = cleaned.match(/^((?:M|A)?\d{1,3}[A-Z]?)$/i);
  if (directMatch?.[1]) return directMatch[1].toUpperCase();
  const simpleNumber = cleaned.match(/((?:M|A)?\d{1,3}[A-Z]?)/i);
  if (simpleNumber?.[1]) return simpleNumber[1].toUpperCase();
  return cleaned.length > 14 ? cleaned.slice(0, 14).trim() : cleaned;
}

export function cleanStopName(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "Stotelė";
  return raw.replace(/\s+/g, " ").replace(/\bst\.\b/gi, "st.").replace(/\s+st\.$/i, " st.").slice(0, 42);
}

export function routeNumbersFromRoute(route: TransitRouteOption | null): string[] {
  if (!route) return [];
  const explicit = Array.isArray(route.routeNumbers) ? route.routeNumbers.map(cleanRouteNumber).filter(Boolean) : [];
  const steps = route.journeySteps || route.steps || [];
  const fromSteps = steps
    .filter((step) => ["board", "ride", "bus", "transfer"].includes(step.type))
    .flatMap((step) => [step.routeNumber, step.routeId, step.routeLabel, step.transferToRoute])
    .map(cleanRouteNumber)
    .filter(Boolean);
  const fromRoute = [route.routeLabel, route.routeId, route.title].map(cleanRouteNumber).filter(Boolean);
  return Array.from(new Set([...explicit, ...fromSteps, ...fromRoute])).slice(0, 4);
}

export function getSteps(route: TransitRouteOption | null): TransitStep[] {
  if (!route) return [];
  return Array.isArray(route.journeySteps) && route.journeySteps.length
    ? route.journeySteps
    : Array.isArray(route.steps)
      ? route.steps
      : [];
}

export function getActiveStepIndex(flowState: TransitFlowState, route: TransitRouteOption | null, fallbackIndex = 0) {
  const steps = getSteps(route);
  if (!steps.length) return 0;
  if (flowState === "walking_to_stop") {
    const index = steps.findIndex((s) => s.type === "walk");
    return index >= 0 ? index : 0;
  }
  if (flowState === "waiting_bus") {
    const index = steps.findIndex((s) => s.type === "board");
    return index >= 0 ? index : Math.min(1, steps.length - 1);
  }
  if (flowState === "onboard") {
    const index = steps.findIndex((s) => s.type === "ride" || s.type === "bus");
    return index >= 0 ? index : Math.min(2, steps.length - 1);
  }
  if (flowState === "transfer") {
    const index = steps.findIndex((s) => s.type === "transfer");
    return index >= 0 ? index : Math.min(fallbackIndex, steps.length - 1);
  }
  if (flowState === "arriving") {
    const index = steps.findIndex((s) => s.type === "alight" || s.type === "arrive");
    return index >= 0 ? index : steps.length - 1;
  }
  return Math.max(0, Math.min(fallbackIndex, steps.length - 1));
}

export function deriveJourneyStage(flowState: TransitFlowState, route: TransitRouteOption | null): JourneyStage {
  if (flowState === "route_options" || flowState === "routes_loading" || !route) return "routes_list";
  if (flowState === "route_selected") return "route_details";
  if (["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving", "completed"].includes(flowState)) return "navigation";
  return route ? "route_details" : "routes_list";
}

function actionForState(flowState: TransitFlowState): JourneyActionKind {
  if (flowState === "route_options") return "choose_route";
  if (flowState === "route_selected") return "start_walk";
  if (flowState === "walking_to_stop") return "wait_bus";
  if (flowState === "waiting_bus") return "board_bus";
  if (flowState === "onboard") return "ride_bus";
  if (flowState === "transfer") return "transfer";
  if (flowState === "arriving") return "alight";
  if (flowState === "completed") return "complete";
  return "search";
}

function ctaForState(flowState: TransitFlowState) {
  switch (flowState) {
    case "route_options": return "Rodyti";
    case "route_selected": return "Start";
    case "walking_to_stop": return "Atėjau";
    case "waiting_bus": return "Įlipau";
    case "onboard": return "Toliau";
    case "transfer": return "Persėdau";
    case "arriving": return "Išlipau";
    case "completed": return "Baigta";
    default: return "Ieškoti";
  }
}

function titleForState(flowState: TransitFlowState, route: TransitRouteOption | null, etaMinutes: number | null) {
  const routeLabel = routeNumbersFromRoute(route)[0] || cleanRouteNumber(route?.routeLabel || route?.routeId) || "bus";
  const boardStopName = cleanStopName(route?.boardStopName || route?.originStop?.name || route?.originStop?.title || "stotelė");
  const alightStopName = cleanStopName(route?.alightStopName || route?.destinationStop?.name || route?.destinationStop?.title || "tikslas");
  switch (flowState) {
    case "routes_loading": return { title: "Ieškome maršrutų", subtitle: "Tikriname grafikus, stoteles ir live GPS." };
    case "route_options": return { title: "Pasirink maršrutą", subtitle: "Laikas, autobusai, persėdimai ir išvykimas." };
    case "route_selected": return { title: `${routeLabel} maršrutas`, subtitle: `${boardStopName} → ${alightStopName}` };
    case "walking_to_stop": return { title: "Eik iki stotelės", subtitle: `${boardStopName}${etaMinutes != null ? ` • autobusas po ${etaMinutes} min` : ""}` };
    case "waiting_bus": return { title: `Lauk ${routeLabel}`, subtitle: etaMinutes != null ? `${boardStopName} • ${etaMinutes} min` : boardStopName };
    case "onboard": return { title: `Važiuok ${routeLabel}`, subtitle: `Išlipk: ${alightStopName}` };
    case "transfer": return { title: "Persėsk", subtitle: "Sek kitą autobusą ir stotelę." };
    case "arriving": return { title: "Išlipk dabar", subtitle: alightStopName };
    case "completed": return { title: "Atvykai", subtitle: "Kelionė baigta." };
    default: return { title: "Kur važiuojam?", subtitle: "Įvesk tikslą ir pasirink autobusą." };
  }
}

export function buildJourneyViewModel(flowState: TransitFlowState, route: TransitRouteOption | null, currentStepIndex = 0): JourneyViewModel {
  const steps = getSteps(route);
  const activeStepIndex = getActiveStepIndex(flowState, route, currentStepIndex);
  const activeStep = steps[activeStepIndex] || null;
  const routeNumbers = routeNumbersFromRoute(route);
  const durationMinutes = asNumber(route?.totalDurationMinutes ?? route?.totalMinutes, 0);
  const walkingMinutes = asNumber(route?.totalWalkMinutes ?? route?.walkingMinutes, 0);
  const busMinutes = asNumber(route?.totalBusMinutes, Math.max(0, durationMinutes - walkingMinutes));
  const transfersCount = Math.max(asNumber(route?.transfersCount ?? route?.transfers, 0), Math.max(0, routeNumbers.length - 1));
  const stopCount = asNumber(route?.stopCount, 0);
  const etaMinutes = route?.liveEta?.etaMinutes ?? route?.etaMinutes ?? null;
  const copy = titleForState(flowState, route, etaMinutes);
  return {
    stage: deriveJourneyStage(flowState, route),
    title: copy.title,
    subtitle: copy.subtitle,
    primaryCta: ctaForState(flowState),
    action: actionForState(flowState),
    activeStepIndex,
    activeStep,
    progressLabel: steps.length ? `${Math.min(activeStepIndex + 1, steps.length)}/${steps.length}` : "0/0",
    progressPercent: steps.length ? Math.max(0.08, Math.min(1, (activeStepIndex + 1) / steps.length)) : 0,
    routeNumbers,
    durationMinutes,
    walkingMinutes,
    busMinutes,
    transfersCount,
    stopCount,
    boardStopName: cleanStopName(route?.boardStopName || route?.originStop?.name || route?.originStop?.title),
    alightStopName: cleanStopName(route?.alightStopName || route?.destinationStop?.name || route?.destinationStop?.title),
    etaMinutes,
    routeLabel: routeNumbers[0] || cleanRouteNumber(route?.routeLabel || route?.routeId) || "BUS",
  };
}
