import { API_BASE } from "../../../../constants/api";
import type { Coordinate, LiveBus, TransitPlan, TransitRouteOption, TransitStep, TransitStop } from "../models/transitRoute";

export const KLAIPEDA_DEFAULT_LOCATION: Coordinate = { latitude: 55.7033, longitude: 21.1443 };

const FALLBACK_STOPS: TransitStop[] = [
  { id: "akropolis", title: "Akropolis", subtitle: "Taikos pr.", coordinate: { latitude: 55.68894, longitude: 21.15468 } },
  { id: "atgimimo", title: "Atgimimo", subtitle: "Klaipėdos centras", coordinate: { latitude: 55.71046, longitude: 21.13146 } },
  { id: "biblioteka", title: "Biblioteka", subtitle: "Herkaus Manto g.", coordinate: { latitude: 55.71433, longitude: 21.13093 } },
  { id: "ligonine", title: "Klaipėdos ligoninė", subtitle: "Liepojos g.", coordinate: { latitude: 55.73594, longitude: 21.12555 } },
  { id: "universitetas", title: "Universitetas", subtitle: "H. Manto g.", coordinate: { latitude: 55.73021, longitude: 21.12639 } },
  { id: "senamiestis", title: "Senamiestis", subtitle: "Teatro a.", coordinate: { latitude: 55.70774, longitude: 21.13356 } },
];

function toCoordinate(raw: any): Coordinate | null {
  const latitude = Number(raw?.latitude ?? raw?.lat ?? raw?.stop_lat ?? raw?.y);
  const longitude = Number(raw?.longitude ?? raw?.lng ?? raw?.lon ?? raw?.stop_lon ?? raw?.x);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

async function fetchJson<T>(path: string, options: RequestInit = {}, timeoutMs = 10000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.warn(`[Arbebus API] ${path} failed`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeStop(raw: any, index: number): TransitStop | null {
  const coordinate = toCoordinate(raw);
  if (!coordinate) return null;
  const distanceMeters = Number(raw?.distanceMeters ?? raw?.distance_meters);
  return {
    id: String(raw?.id ?? raw?.stop_id ?? raw?.stopId ?? `stop-${index}`),
    title: String(raw?.title ?? raw?.name ?? raw?.stop_name ?? raw?.stopName ?? "Stotelė"),
    subtitle: raw?.subtitle ?? raw?.address ?? raw?.description ?? (Number.isFinite(distanceMeters) ? `${Math.round(distanceMeters)} m` : undefined),
    coordinate,
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : undefined,
  };
}

function normalizeBus(raw: any, index: number): LiveBus | null {
  const coordinate = toCoordinate(raw);
  if (!coordinate) return null;
  return {
    id: String(raw?.id ?? raw?.vehicle_id ?? raw?.vehicleId ?? raw?.busId ?? `bus-${index}`),
    routeNumber: String(raw?.routeNumber ?? raw?.route ?? raw?.routeId ?? raw?.line ?? raw?.nr ?? raw?.name ?? "BUS"),
    coordinate,
    bearing: Number.isFinite(Number(raw?.bearing ?? raw?.heading)) ? Number(raw?.bearing ?? raw?.heading) : undefined,
    title: raw?.title ?? raw?.name,
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? raw?.fetchedAtIso,
  };
}

function minutesFromSeconds(seconds: unknown): number | undefined {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(1, Math.round(n / 60));
}

function cleanRouteNumber(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "Walk") return null;
  return raw.split("•")[0].trim();
}

function routeNumbersFromBackendPlan(raw: any): string[] {
  const fromSummary = String(raw?.summary?.routeLabel ?? "")
    .split("→")
    .map(cleanRouteNumber)
    .filter(Boolean) as string[];
  if (fromSummary.length) return Array.from(new Set(fromSummary));

  const fromSteps = (raw?.journeySteps ?? [])
    .map((step: any) => cleanRouteNumber(step.routeNumber ?? step.routeId ?? step.title?.replace(/.*?(\d+[A-Z]?).*/, "$1")))
    .filter(Boolean) as string[];
  return fromSteps.length ? Array.from(new Set(fromSteps)) : ["?"];
}

function normalizeJourneyStep(raw: any, index: number): TransitStep {
  const title = String(raw?.title ?? "Kelionės žingsnis");
  const subtitle = raw?.subtitle ? String(raw.subtitle) : undefined;
  const routeNumber = cleanRouteNumber(raw?.routeNumber ?? raw?.routeId ?? title.replace(/.*?(\d+[A-Z]?).*/, "$1")) ?? undefined;

  if (raw?.type === "board") {
    return {
      id: String(raw?.id ?? `step-${index}`),
      type: "bus",
      title: routeNumber ? `Lauk autobuso Nr. ${routeNumber}` : title,
      description: subtitle ?? raw?.stopName ?? "Atvykimo laiką tikriname pagal tvarkaraštį ir live GPS.",
      routeNumber,
      fromStopName: raw?.stopName,
      durationMinutes: minutesFromSeconds(raw?.durationSeconds),
    };
  }

  if (raw?.type === "ride") {
    return {
      id: String(raw?.id ?? `step-${index}`),
      type: "bus",
      title: raw?.stopCount ? `Važiuok ${raw.stopCount} stotelių` : title,
      description: subtitle ?? (raw?.toStopName ? `Iki „${raw.toStopName}“` : undefined),
      routeNumber,
      fromStopName: raw?.fromStopName,
      toStopName: raw?.toStopName,
      stopCount: Number.isFinite(Number(raw?.stopCount)) ? Number(raw.stopCount) : undefined,
      durationMinutes: minutesFromSeconds(raw?.durationSeconds),
    };
  }

  if (raw?.type === "alight") {
    return {
      id: String(raw?.id ?? `step-${index}`),
      type: "arrive",
      title: "Išlipk kitoje stotelėje",
      description: subtitle ?? raw?.stopName,
      toStopName: raw?.stopName,
    };
  }

  if (raw?.type === "transfer") {
    return {
      id: String(raw?.id ?? `step-${index}`),
      type: "transfer",
      title: routeNumber ? `Persėsk į autobusą Nr. ${routeNumber}` : title,
      description: subtitle,
      routeNumber,
      durationMinutes: minutesFromSeconds(raw?.durationSeconds),
    };
  }

  const looksLikeTransfer = title.toLowerCase().includes("persė") || title.toLowerCase().includes("pereik");
  return {
    id: String(raw?.id ?? `step-${index}`),
    type: looksLikeTransfer ? "transfer" : "walk",
    title: looksLikeTransfer ? "Persėsk į kitą autobusą" : title,
    description: subtitle,
    routeNumber,
    fromStopName: raw?.fromStopName,
    toStopName: raw?.toStopName ?? raw?.stopName,
    durationMinutes: minutesFromSeconds(raw?.durationSeconds),
    polyline: Array.isArray(raw?.polyline) ? raw.polyline.map(toCoordinate).filter(Boolean) as Coordinate[] : undefined,
  };
}

function splitRideStepsForAppleMaps(steps: TransitStep[]): TransitStep[] {
  const output: TransitStep[] = [];
  steps.forEach((step, index) => {
    if (step.type !== "bus") {
      output.push(step);
      return;
    }

    const isRideInstruction = step.title.toLowerCase().includes("važiuok");
    if (isRideInstruction) {
      output.push({ ...step, id: `${step.id}-ride`, type: "bus" });
      return;
    }

    output.push({ ...step, id: `${step.id}-wait`, type: "bus", title: step.routeNumber ? `Lauk autobuso Nr. ${step.routeNumber}` : step.title });

    if (index === steps.length - 1 || !steps[index + 1]?.title.toLowerCase().includes("važiuok")) {
      output.push({
        ...step,
        id: `${step.id}-onboard`,
        type: "bus",
        title: step.stopCount ? `Važiuok ${step.stopCount} stotelių` : "Važiuok autobusu",
      });
    }
  });
  return output;
}

function fallbackSteps(origin: Coordinate, destination: Coordinate, routeNumber = "?"): TransitStep[] {
  return [
    { id: "walk-to-stop", type: "walk", title: "Eik iki stotelės", description: "Sek punktyrinę liniją žemėlapyje.", durationMinutes: 6, polyline: [origin] },
    { id: "wait-bus", type: "bus", title: `Lauk autobuso Nr. ${routeNumber}`, description: "Stebėk live autobusą žemėlapyje.", routeNumber, durationMinutes: 4 },
    { id: "ride-bus", type: "bus", title: "Važiuok 6 stoteles", description: "Arbebus pasakys kada ruoštis išlipti.", routeNumber, stopCount: 6, durationMinutes: 16, polyline: [origin, destination] },
    { id: "arrive", type: "arrive", title: "Atvykai", description: "Tikslas pasiektas.", durationMinutes: 1, polyline: [destination] },
  ];
}

function normalizeRoute(raw: any, index: number, origin: Coordinate, destination: Coordinate): TransitRouteOption {
  const routeNumbers = routeNumbersFromBackendPlan(raw);
  const rawPoints = raw?.previewPoints ?? raw?.polyline ?? raw?.shape ?? [];
  const polyline = Array.isArray(rawPoints) ? rawPoints.map(toCoordinate).filter(Boolean) as Coordinate[] : [];
  const rawSteps = Array.isArray(raw?.journeySteps) ? raw.journeySteps : Array.isArray(raw?.steps) ? raw.steps : [];
  const steps = splitRideStepsForAppleMaps(rawSteps.map(normalizeJourneyStep));
  const summary = raw?.summary ?? {};

  return {
    id: String(raw?.id ?? raw?.routeId ?? `route-${index}`),
    title: String(raw?.title ?? summary.routeLabel ?? `Autobusas ${routeNumbers.join(" + ")}`),
    subtitle: String(raw?.subtitle ?? summary.journeyMessage ?? `${summary.boardStopName ?? "Stotelė"} → ${summary.alightStopName ?? "tikslas"}`),
    totalMinutes: Math.max(1, Number(summary.totalDurationMinutes ?? raw?.totalMinutes ?? raw?.durationMinutes ?? raw?.duration ?? 24)),
    walkingMinutes: Math.max(0, Number(summary.totalWalkMinutes ?? raw?.walkingMinutes ?? raw?.walkMinutes ?? 0)),
    transfers: Math.max(0, Number(summary.transfersCount ?? raw?.transfers ?? raw?.transferCount ?? Math.max(0, routeNumbers.length - 1))),
    routeNumbers,
    polyline: polyline.length >= 2 ? polyline : [origin, destination],
    steps: steps.length > 0 ? steps : fallbackSteps(origin, destination, routeNumbers[0]),
  };
}

function fallbackPlan(origin: Coordinate, destination: Coordinate, destinationLabel: string): TransitPlan {
  const routes = [normalizeRoute({ id: "fallback-bus", summary: { routeLabel: "?", totalDurationMinutes: 24, totalWalkMinutes: 6, transfersCount: 0 } }, 0, origin, destination)];
  return { origin, destination, destinationLabel, routes, selectedRouteId: routes[0].id };
}

export async function searchTransitStops(query: string, origin?: Coordinate | null): Promise<TransitStop[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  const params = new URLSearchParams({ q: cleanQuery });
  if (origin) {
    params.set("lat", String(origin.latitude));
    params.set("lng", String(origin.longitude));
  }

  const payload: any = await fetchJson<any>(`/stops/search?${params.toString()}`, {}, 8000);
  const rawStops = Array.isArray(payload) ? payload : payload?.stops ?? payload?.results ?? [];
  const normalized = Array.isArray(rawStops) ? rawStops.map(normalizeStop).filter(Boolean) as TransitStop[] : [];
  if (normalized.length > 0) return normalized.slice(0, 10);

  return FALLBACK_STOPS.filter((stop) => `${stop.title} ${stop.subtitle ?? ""}`.toLowerCase().includes(cleanQuery.toLowerCase())).slice(0, 8);
}

export async function fetchLiveBuses(): Promise<LiveBus[]> {
  const payload: any = await fetchJson<any>("/live-buses", {}, 7000);
  const rawBuses = Array.isArray(payload) ? payload : payload?.buses ?? payload?.vehicles ?? [];
  return Array.isArray(rawBuses) ? rawBuses.map(normalizeBus).filter(Boolean) as LiveBus[] : [];
}

export async function planTransitRoute(input: { origin: Coordinate; destination: Coordinate; destinationLabel: string }): Promise<TransitPlan> {
  const payload: any = await fetchJson<any>("/transit/plan", {
    method: "POST",
    body: JSON.stringify({ origin: input.origin, destination: input.destination }),
  }, 15000);

  const rawRoutes = Array.isArray(payload) ? payload : payload?.options ?? payload?.routes ?? payload?.plans ?? (payload?.plan ? [payload.plan] : []);
  if (!Array.isArray(rawRoutes) || rawRoutes.length === 0) {
    return fallbackPlan(input.origin, input.destination, input.destinationLabel);
  }

  const routes = rawRoutes.map((route, index) => normalizeRoute(route, index, input.origin, input.destination));
  return { origin: input.origin, destination: input.destination, destinationLabel: input.destinationLabel, routes, selectedRouteId: routes[0]?.id ?? "route-0" };
}
