import { API_BASE, API_ENDPOINTS } from "@/constants/api";
import type {
  Coordinate,
  LiveBus,
  PlaceSearchResult,
  TransitRouteOption,
  TransitStep,
  TransitStepType,
} from "../models/transitTypes";

export type { LiveBus } from "../models/transitTypes";
export type { TransitRouteOption };
export type PlaceResult = PlaceSearchResult;

export type LiveEtaResult = {
  ok: boolean;
  routeId: string;
  eta?: {
    etaSeconds: number;
    etaMinutes: number;
    distanceMeters?: number | null;
  } | null;
  boardingState?: "boarding_soon" | "on_the_way" | "later" | "unknown" | string;
  vehicle?: LiveBus | null;
  message?: string;
};

export type WalkingRouteResult = {
  geometry: Coordinate[];
  polyline: Coordinate[];
  points: Coordinate[];
  durationSeconds: number | null;
  durationMinutes: number | null;
  distanceMeters: number | null;
};


export type TransitScheduleRoute = {
  id: string;
  routeId: string;
  shortName: string;
  longName?: string;
  title: string;
  subtitle?: string;
  from?: string | null;
  to?: string | null;
  color?: string | null;
  textColor?: string | null;
};

export type TransitRouteShapePayload = {
  ok: boolean;
  route: TransitScheduleRoute;
  routeId: string;
  tripId?: string | null;
  shapeId?: string | null;
  polyline: Coordinate[];
  points: Coordinate[];
  stops: any[];
};

function apiBase() {
  return API_BASE.replace(/\/$/, "");
}

const API_TIMEOUT_MS = 12000;
const SEARCH_TIMEOUT_MS = 1800;
const SEARCH_MEMORY_TTL_MS = 5 * 60 * 1000;
const API_RETRY_COUNT = 1;
const SEARCH_RETRY_DELAYS_MS = [220, 650];

type SearchLocation = Partial<Coordinate> | null | undefined;
type SearchCacheEntry = { createdAt: number; results: PlaceResult[] };
const searchMemoryCache = new Map<string, SearchCacheEntry>();

let lastSearchLocation: Coordinate | null = null;
let lastSearchLocationReadAt = 0;
let activeSearchController: AbortController | null = null;

function normalizeSearchLocation(location?: SearchLocation): Coordinate | null {
  const latitude = Number(
    (location as any)?.latitude ?? (location as any)?.lat,
  );
  const longitude = Number(
    (location as any)?.longitude ??
      (location as any)?.lon ??
      (location as any)?.lng,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { latitude, longitude };
}

function locationCacheBucket(location?: SearchLocation) {
  const coordinate = normalizeSearchLocation(location);
  if (!coordinate) return "no-location";

  // ~1.1 km bucket. This keeps autocomplete cache stable while still separating cities.
  return `${coordinate.latitude.toFixed(2)},${coordinate.longitude.toFixed(2)}`;
}

function searchCacheKey(query: string, location?: SearchLocation) {
  return `${query.trim().toLowerCase().replace(/\s+/g, " ")}:${locationCacheBucket(location)}`;
}

function getSearchMemoryCache(query: string, location?: SearchLocation) {
  const key = searchCacheKey(query, location);
  const cached = searchMemoryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > SEARCH_MEMORY_TTL_MS) {
    searchMemoryCache.delete(key);
    return null;
  }
  return cached.results;
}

function setSearchMemoryCache(
  query: string,
  results: PlaceResult[],
  location?: SearchLocation,
) {
  searchMemoryCache.set(searchCacheKey(query, location), {
    createdAt: Date.now(),
    results,
  });
}

async function getBestEffortDeviceLocation(): Promise<Coordinate | null> {
  // Primary path should be explicit location from MapScreen/useTransitPlanner.
  // This fallback only helps old call sites if React Native exposes navigator.geolocation.
  if (lastSearchLocation && Date.now() - lastSearchLocationReadAt < 60_000) {
    return lastSearchLocation;
  }

  const geolocation = (globalThis as any)?.navigator?.geolocation;
  if (!geolocation?.getCurrentPosition) return null;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 1200);

    try {
      geolocation.getCurrentPosition(
        (position: any) => {
          clearTimeout(timer);
          const coordinate = normalizeSearchLocation({
            latitude: position?.coords?.latitude,
            longitude: position?.coords?.longitude,
          });

          if (coordinate) {
            lastSearchLocation = coordinate;
            lastSearchLocationReadAt = Date.now();
          }

          resolve(coordinate);
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 1000, maximumAge: 60000 },
      );
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs = API_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  const abortFromExternal = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else
      externalSignal.addEventListener("abort", abortFromExternal, {
        once: true,
      });
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...(init || {}),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal)
      externalSignal.removeEventListener("abort", abortFromExternal);
  }
}

async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  retries = API_RETRY_COUNT,
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, init);
      if (response.ok || attempt >= retries || response.status < 500)
        return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    }

    await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Network request failed");
}

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Bad JSON response: ${text.slice(0, 250)}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function looksLikeHtml(text: string) {
  const value = text.trim().toLowerCase();
  return (
    value.startsWith("<!doctype html") ||
    value.startsWith("<html") ||
    value.includes("<body") ||
    value.includes("window.location.replace") ||
    value.includes("loading...")
  );
}

function isColdStartResponse(response: Response, text: string) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html") || looksLikeHtml(text);
}

function shouldRetrySearchStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function wakeBackend(baseUrl: string) {
  try {
    await fetchWithTimeout(`${baseUrl}/api/health`, undefined, 4500);
  } catch {
    // Best-effort Render wake-up only. Search retry below is the real protection.
  }
}

async function fetchSearchJson(
  url: string,
  signal?: AbortSignal,
): Promise<any | null> {
  const base = apiBase();
  let lastError: unknown = null;

  for (
    let attempt = 0;
    attempt <= SEARCH_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      if (signal?.aborted) return null;
      const response = await fetchWithTimeout(
        url,
        signal ? { signal } : undefined,
        SEARCH_TIMEOUT_MS,
      );
      const text = await response.text();

      if (response.status === 429) {
        if (attempt < SEARCH_RETRY_DELAYS_MS.length) {
          await sleep(SEARCH_RETRY_DELAYS_MS[attempt]);
          continue;
        }
        console.warn(
          "[Arbebus search] backend rate limited; skipping this keystroke",
        );
        return null;
      }

      if (!response.ok) {
        if (
          shouldRetrySearchStatus(response.status) &&
          attempt < SEARCH_RETRY_DELAYS_MS.length
        ) {
          await sleep(SEARCH_RETRY_DELAYS_MS[attempt]);
          continue;
        }
        console.warn(`[Arbebus search] HTTP ${response.status}`);
        return null;
      }

      if (isColdStartResponse(response, text)) {
        if (attempt < SEARCH_RETRY_DELAYS_MS.length) {
          await wakeBackend(base);
          await sleep(SEARCH_RETRY_DELAYS_MS[attempt]);
          continue;
        }
        console.warn(
          `[Arbebus search] backend returned HTML instead of JSON: ${text.slice(0, 120)}`,
        );
        return null;
      }

      try {
        return JSON.parse(text);
      } catch (error) {
        lastError = error;
        if (attempt < SEARCH_RETRY_DELAYS_MS.length) {
          await sleep(SEARCH_RETRY_DELAYS_MS[attempt]);
          continue;
        }
        console.warn(
          `[Arbebus search] Bad JSON response: ${text.slice(0, 180)}`,
        );
        return null;
      }
    } catch (error) {
      lastError = error;
      if (attempt < SEARCH_RETRY_DELAYS_MS.length) {
        await wakeBackend(base);
        await sleep(SEARCH_RETRY_DELAYS_MS[attempt]);
        continue;
      }
    }
  }

  console.warn("[Arbebus search] failed after retry", lastError);
  return null;
}

function toCoordinate(input: any): Coordinate | null {
  const latitude = Number(
    input?.latitude ??
      input?.lat ??
      input?.stop_lat ??
      input?.coordinate?.latitude,
  );

  const longitude = Number(
    input?.longitude ??
      input?.lon ??
      input?.lng ??
      input?.stop_lon ??
      input?.coordinate?.longitude,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}
function isUsableCoordinate(
  coordinate: Coordinate | null,
): coordinate is Coordinate {
  if (!coordinate) return false;
  const { latitude, longitude } = coordinate;
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude !== 0 &&
    longitude !== 0 &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

function isAddressOrStreetQuery(query: string) {
  const q = String(query || "").trim();
  return (
    /\d/.test(q) ||
    /\b(g|g\.|gatv[eė]|pr|pr\.|prospektas|al|al\.|pl|pl\.|kelias)\b/i.test(q) ||
    /^[a-ząčęėįšųūž\s.-]{2,}$/i.test(q)
  );
}

function normalizeGeometry(raw: any): Coordinate[] {
  const candidates =
    raw?.geometry ??
    raw?.polyline ??
    raw?.points ??
    raw?.coordinates ??
    raw?.route?.geometry ??
    raw?.route?.polyline ??
    raw?.features?.[0]?.geometry?.coordinates ??
    [];

  if (!Array.isArray(candidates)) return [];

  // GeoJSON format: [[lon, lat], [lon, lat]]
  if (Array.isArray(candidates[0])) {
    return candidates
      .map((point: any) => {
        const longitude = Number(point?.[0]);
        const latitude = Number(point?.[1]);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
          return null;
        return { latitude, longitude };
      })
      .filter(Boolean) as Coordinate[];
  }

  // App format: [{ latitude, longitude }]
  return candidates.map(toCoordinate).filter(Boolean) as Coordinate[];
}

function normalizeId(value: any) {
  return String(value ?? "").trim();
}

function normalizeRouteNumber(value: any) {
  return String(value ?? "")
    .trim()
    .split("•")[0]
    .split(" ")[0]
    .replace(/^0+/, "")
    .toUpperCase();
}

function normalizeLiveBus(raw: any, index = 0): LiveBus | null {
  const coordinate = toCoordinate(raw);
  if (!coordinate) return null;

  const number = String(
    raw?.routeShortName ??
      raw?.routeLabel ??
      raw?.number ??
      raw?.route ??
      raw?.routeId ??
      raw?.line ??
      raw?.vehicleLabel ??
      "BUS",
  );

  const vehicleId = normalizeId(
    raw?.vehicleId ??
      raw?.vehicle_id ??
      raw?.id ??
      raw?.vehicleLabel ??
      `${number}-${index}`,
  );

  const id = normalizeId(raw?.id ?? vehicleId);

  return {
    id,
    number,
    route: raw?.route != null ? String(raw.route) : number,
    routeId:
      raw?.routeId != null ? String(raw.routeId) : normalizeRouteNumber(number),
    vehicleId,
    vehicleLabel:
      raw?.vehicleLabel != null
        ? String(raw.vehicleLabel)
        : raw?.label != null
          ? String(raw.label)
          : vehicleId,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    speedKph: raw?.speedKph != null ? Number(raw.speedKph) : undefined,
    bearing: raw?.bearing != null ? Number(raw.bearing) : undefined,
    heading:
      raw?.heading != null
        ? Number(raw.heading)
        : raw?.bearing != null
          ? Number(raw.bearing)
          : undefined,
    tripStart: raw?.tripStart,
    delaySeconds:
      raw?.delaySeconds != null ? Number(raw.delaySeconds) : undefined,
    directionName: raw?.directionName,
    fetchedAt: raw?.fetchedAt ?? raw?.fetchedAtIso,
  };
}

function normalizeStop(raw: any) {
  const coordinate = toCoordinate(raw);
  if (!coordinate) return null;

  return {
    id:
      raw?.id != null
        ? String(raw.id)
        : raw?.stop_id != null
          ? String(raw.stop_id)
          : undefined,
    title: String(
      raw?.title ?? raw?.name ?? raw?.stopName ?? raw?.stop_name ?? "Stotelė",
    ),
    name: String(
      raw?.name ?? raw?.title ?? raw?.stopName ?? raw?.stop_name ?? "Stotelė",
    ),
    stopName: String(
      raw?.stopName ?? raw?.stop_name ?? raw?.name ?? raw?.title ?? "Stotelė",
    ),
    stopSequence:
      raw?.stopSequence != null
        ? Number(raw.stopSequence)
        : raw?.stop_sequence != null
          ? Number(raw.stop_sequence)
          : undefined,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    distanceMeters:
      raw?.distanceMeters != null ? Number(raw.distanceMeters) : undefined,
    arrivalTime: raw?.arrivalTime ?? raw?.arrival_time ?? raw?.arrivalText,
    departureTime:
      raw?.departureTime ?? raw?.departure_time ?? raw?.departureText,
    arrivalText: raw?.arrivalText ?? raw?.arrivalTime ?? raw?.arrival_time,
    departureText:
      raw?.departureText ?? raw?.departureTime ?? raw?.departure_time,
    displayTime:
      raw?.displayTime ??
      raw?.departureText ??
      raw?.departureTime ??
      raw?.departure_time ??
      raw?.arrivalText ??
      raw?.arrivalTime ??
      raw?.arrival_time,
    arrivalSeconds:
      raw?.arrivalSeconds != null
        ? Number(raw.arrivalSeconds)
        : raw?.arrival_seconds != null
          ? Number(raw.arrival_seconds)
          : undefined,
    departureSeconds:
      raw?.departureSeconds != null
        ? Number(raw.departureSeconds)
        : raw?.departure_seconds != null
          ? Number(raw.departure_seconds)
          : undefined,
  };
}

function normalizeStops(rawStops: any): any[] {
  if (!Array.isArray(rawStops)) return [];

  return rawStops
    .map((stop) => {
      if (typeof stop === "string") {
        return {
          title: stop,
          name: stop,
          stopName: stop,
          latitude: NaN,
          longitude: NaN,
        };
      }

      return normalizeStop(stop);
    })
    .filter((stop): stop is NonNullable<typeof stop> => Boolean(stop))
    .filter(
      (stop) =>
        Number.isFinite(Number(stop.latitude)) &&
        Number.isFinite(Number(stop.longitude)),
    );
}

function cleanRouteLabel(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function routeNumbersFromLabel(label?: string | null) {
  return cleanRouteLabel(label)
    .split("→")
    .map((part) => cleanRouteLabel(part).split("•")[0]?.trim())
    .filter(Boolean);
}

function normalizeStep(raw: any, index: number): TransitStep {
  const rawType = String(raw?.type ?? raw?.mode ?? "bus").toLowerCase();

  const type = (
    rawType === "walk" ||
    rawType === "transfer" ||
    rawType === "arrive" ||
    rawType === "board" ||
    rawType === "ride" ||
    rawType === "alight" ||
    rawType === "bus" ||
    rawType === "ferry"
      ? rawType
      : "bus"
  ) as TransitStepType | "ferry";

  const stops = normalizeStops(
    raw?.stops ??
      raw?.rideStops ??
      raw?.routeStops ??
      raw?.stopList ??
      raw?.passedStops ??
      raw?.summary?.stops,
  );

  const routeNumber =
    raw?.routeNumber != null
      ? cleanRouteLabel(raw.routeNumber)
      : raw?.routeLabel != null
        ? cleanRouteLabel(raw.routeLabel)
        : raw?.routeId != null
          ? cleanRouteLabel(raw.routeId)
          : undefined;

  const polyline = Array.isArray(raw?.polyline)
    ? (raw.polyline.map(toCoordinate).filter(Boolean) as Coordinate[])
    : Array.isArray(raw?.points)
      ? (raw.points.map(toCoordinate).filter(Boolean) as Coordinate[])
      : undefined;

  const normalized: any = {
    id: String(raw?.id ?? `${type}-${index}`),
    type,
    mode:
      raw?.mode ??
      (type === "ride" || type === "board" || type === "bus"
        ? "bus"
        : type === "ferry"
          ? "ferry"
          : type),
    icon: raw?.icon,
    title: String(
      raw?.title ??
        (type === "ferry"
          ? "Kelkis keltu"
          : type === "walk"
            ? "Eik pėsčiomis"
            : "Kelionės žingsnis"),
    ),
    subtitle: raw?.subtitle,
    description: raw?.description ?? raw?.subtitle,
    routeId: raw?.routeId != null ? String(raw.routeId) : undefined,
    routeNumber,
    routeLabel:
      raw?.routeLabel != null ? cleanRouteLabel(raw.routeLabel) : routeNumber,
    stopId: raw?.stopId != null ? String(raw.stopId) : undefined,
    stopName: raw?.stopName,
    fromStopId: raw?.fromStopId != null ? String(raw.fromStopId) : undefined,
    toStopId: raw?.toStopId != null ? String(raw.toStopId) : undefined,
    fromStopName: raw?.fromStopName ?? raw?.fromStop?.name ?? raw?.fromStop,
    toStopName: raw?.toStopName ?? raw?.toStop?.name ?? raw?.toStop,
    stopCount:
      raw?.stopCount != null
        ? Number(raw.stopCount)
        : stops.length > 0
          ? Math.max(0, stops.length - 1)
          : undefined,
    stops,
    rideStops: stops,
    routeStops: stops,
    minutes:
      raw?.minutes != null
        ? Number(raw.minutes)
        : raw?.durationMinutes != null
          ? Number(raw.durationMinutes)
          : undefined,
    durationMinutes:
      raw?.durationMinutes != null
        ? Number(raw.durationMinutes)
        : raw?.minutes != null
          ? Number(raw.minutes)
          : undefined,
    distanceMeters:
      raw?.distanceMeters != null ? Number(raw.distanceMeters) : undefined,
    departureTime: raw?.departureTime ?? raw?.departureText,
    arrivalTime: raw?.arrivalTime ?? raw?.arrivalText,
    livePosition: raw?.livePosition ?? raw?.live_position ?? raw?.liveFerry ?? null,
    live_position: raw?.live_position ?? raw?.livePosition ?? raw?.liveFerry ?? null,
    ferryRouteId: raw?.ferryRouteId ?? raw?.ferry_route_id ?? undefined,
    ferryTerminalFrom: raw?.ferryTerminalFrom ?? raw?.fromTerminal ?? undefined,
    ferryTerminalTo: raw?.ferryTerminalTo ?? raw?.toTerminal ?? undefined,
    polyline,
  };

  return normalized as TransitStep;
}

function buildStepsFromBackendPlan(raw: any, summary: any): TransitStep[] {
  const routeLabel = cleanRouteLabel(
    summary.routeLabel ?? raw?.routeLabel ?? "Autobusas",
  );
  const routeNumbers = routeNumbersFromLabel(routeLabel);
  const boardStopName = String(
    summary.boardStopName ?? raw?.originStop?.name ?? "Įlipimo stotelė",
  );
  const alightStopName = String(
    summary.alightStopName ?? raw?.destinationStop?.name ?? "Išlipimo stotelė",
  );
  const totalWalkMinutes = Number(
    summary.totalWalkMinutes ??
      raw?.totalWalkMinutes ??
      raw?.walkingMinutes ??
      0,
  );
  const totalBusMinutes = Number(
    summary.totalBusMinutes ?? raw?.totalBusMinutes ?? 0,
  );
  const stopCount = Number(summary.stopCount ?? raw?.stopCount ?? 0);
  const transfersCount = Number(
    summary.transfersCount ??
      raw?.transfersCount ??
      Math.max(0, routeNumbers.length - 1),
  );
  const numbers = routeNumbers.length
    ? routeNumbers
    : [cleanRouteLabel(raw?.routeId ?? routeLabel ?? "Autobusas")];
  const steps: TransitStep[] = [];

  if (totalWalkMinutes > 0) {
    steps.push(
      normalizeStep(
        {
          id: "walk-to-stop",
          type: "walk",
          mode: "walk",
          icon: "walk",
          title: "Eik iki stotelės",
          subtitle: `Iki „${boardStopName}“ • ${totalWalkMinutes} min pėsčiomis`,
          stopName: boardStopName,
          durationMinutes: totalWalkMinutes,
          minutes: totalWalkMinutes,
        },
        steps.length,
      ),
    );
  }

  numbers.forEach((number, routeIndex) => {
    const isLast = routeIndex === numbers.length - 1;

    steps.push(
      normalizeStep(
        {
          id: `board-${routeIndex}`,
          type: "board",
          mode: "bus",
          icon: "bus",
          title: `Lipk į autobusą ${number}`,
          subtitle:
            routeIndex === 0
              ? `Stotelė „${boardStopName}“`
              : "Persėdimo stotelė",
          routeId: number,
          routeNumber: number,
          stopName: routeIndex === 0 ? boardStopName : undefined,
        },
        steps.length,
      ),
    );

    steps.push(
      normalizeStep(
        {
          id: `ride-${routeIndex}`,
          type: "ride",
          mode: "bus",
          icon: "bus",
          title: "Važiuok autobusu",
          subtitle: isLast
            ? `Iki „${alightStopName}“ • ${totalBusMinutes || "?"} min • ${stopCount || "?"} st.`
            : "Iki persėdimo stotelės",
          routeId: number,
          routeNumber: number,
          stopCount: isLast ? stopCount : undefined,
          durationMinutes: isLast ? totalBusMinutes : undefined,
          minutes: isLast ? totalBusMinutes : undefined,
          toStopName: isLast ? alightStopName : undefined,
        },
        steps.length,
      ),
    );

    if (!isLast || transfersCount > routeIndex) {
      steps.push(
        normalizeStep(
          {
            id: `transfer-${routeIndex}`,
            type: "transfer",
            mode: "walk",
            icon: "swap-horizontal",
            title: "Persėsk",
            subtitle:
              `Toliau važiuok autobusu ${numbers[routeIndex + 1] ?? ""}`.trim(),
          },
          steps.length,
        ),
      );
    }
  });

  steps.push(
    normalizeStep(
      {
        id: "alight-final",
        type: "alight",
        icon: "flag-checkered",
        title: "Išlipk",
        subtitle: `„${alightStopName}“`,
        stopName: alightStopName,
      },
      steps.length,
    ),
  );

  return steps;
}

function stopPoint(title: string, fallback: Coordinate, raw?: any) {
  const coordinate = toCoordinate(raw) ?? fallback;

  return {
    id: raw?.id != null ? String(raw.id) : undefined,
    title: String(raw?.title ?? raw?.name ?? title),
    name: String(raw?.name ?? raw?.title ?? title),
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    distanceMeters:
      raw?.distanceMeters != null ? Number(raw.distanceMeters) : undefined,
  };
}

function normalizeBackendPlan(
  raw: any,
  index: number,
  fallbackFrom: Coordinate,
  fallbackTo: Coordinate,
): TransitRouteOption {
  const summary = raw?.summary ?? {};

  const rawPolyline = Array.isArray(raw?.polyline)
    ? (raw.polyline.map(toCoordinate).filter(Boolean) as Coordinate[])
    : [];

  const previewPoints =
    Array.isArray(raw?.previewPoints) && raw.previewPoints.length
      ? (raw.previewPoints.map(toCoordinate).filter(Boolean) as Coordinate[])
      : rawPolyline.length >= 2
        ? rawPolyline
        : [fallbackFrom, fallbackTo];

  const journeyStepsRaw = Array.isArray(raw?.journeySteps)
    ? raw.journeySteps
    : Array.isArray(raw?.steps)
      ? raw.steps
      : [];

  const parsedSteps = journeyStepsRaw.map(normalizeStep);
  const routeLabel = cleanRouteLabel(
    summary.routeLabel ?? raw?.routeLabel ?? raw?.title ?? "Autobusas",
  );
  const steps = parsedSteps.length
    ? parsedSteps
    : buildStepsFromBackendPlan(raw, summary);

  const boardStopName = String(
    summary.boardStopName ??
      raw?.boardStopName ??
      raw?.originStop?.name ??
      "Artimiausia stotelė",
  );
  const alightStopName = String(
    summary.alightStopName ??
      raw?.alightStopName ??
      raw?.destinationStop?.name ??
      "Tikslas",
  );

  const from =
    toCoordinate(raw?.originStop) ?? previewPoints[0] ?? fallbackFrom;
  const to =
    toCoordinate(raw?.destinationStop) ??
    previewPoints[previewPoints.length - 1] ??
    fallbackTo;
  const totalDurationMinutes = Number(
    summary.totalDurationMinutes ??
      raw?.totalDurationMinutes ??
      raw?.totalMinutes ??
      0,
  );
  const totalWalkMinutes = Number(
    summary.totalWalkMinutes ??
      raw?.totalWalkMinutes ??
      raw?.walkingMinutes ??
      0,
  );
  const transfersCount = Number(
    summary.transfersCount ??
      raw?.transfersCount ??
      raw?.transfers ??
      Math.max(0, routeNumbersFromLabel(routeLabel).length - 1),
  );
  const stopCount = Number(
    summary.stopCount ??
      raw?.stopCount ??
      steps.reduce(
        (sum: number, step: TransitStep) => sum + Number(step.stopCount ?? 0),
        0,
      ),
  );

  return {
    id: String(raw?.id ?? `route-${index}`),
    title: routeLabel,
    subtitle: summary.journeyMessage ?? raw?.subtitle ?? undefined,
    mode: raw?.mode,
    routeId:
      raw?.routeId != null
        ? String(raw.routeId)
        : normalizeRouteNumber(routeLabel),
    shapeId: raw?.shapeId ?? summary.shapeId ?? null,
    routeLabel,
    routeNumbers: routeNumbersFromLabel(routeLabel),
    totalMinutes: totalDurationMinutes,
    totalDurationMinutes,
    walkingMinutes: totalWalkMinutes,
    totalWalkMinutes,
    totalBusMinutes:
      summary.totalBusMinutes != null
        ? Number(summary.totalBusMinutes)
        : raw?.totalBusMinutes != null
          ? Number(raw.totalBusMinutes)
          : undefined,
    etaMinutes:
      summary.etaMinutes != null
        ? Number(summary.etaMinutes)
        : raw?.etaMinutes != null
          ? Number(raw.etaMinutes)
          : null,
    liveEta: raw?.liveEta ?? null,
    liveFerry: raw?.liveFerry ?? raw?.live_position ?? raw?.livePosition ?? null,
    boardingState: raw?.boardingState ?? null,
    transfers: transfersCount,
    transfersCount,
    stopCount,
    boardStopName,
    alightStopName,
    originStop: stopPoint(boardStopName, from, raw?.originStop),
    destinationStop: stopPoint(alightStopName, to, raw?.destinationStop),
    previewPoints,
    polyline: rawPolyline.length >= 2 ? rawPolyline : previewPoints,
    steps,
    journeySteps: steps,
    departureText:
      summary.etaMinutes != null
        ? `Atvyksta po ${summary.etaMinutes} min`
        : raw?.departureText,
    arrivalText: raw?.arrivalText,
    journeyMessage: summary.journeyMessage ?? raw?.journeyMessage,
    headsign:
      summary.headsign ?? summary.directionCode ?? raw?.headsign ?? null,
    liveVehicle: raw?.liveVehicle ? normalizeLiveBus(raw.liveVehicle) : null,
    summary,
  } as TransitRouteOption;
}

export async function getLiveBuses(): Promise<LiveBus[]> {
  const endpoints = [API_ENDPOINTS.liveBuses];

  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithRetry(endpoint);

      if (!response.ok) {
        lastError = new Error(`Live buses failed: ${response.status}`);
        continue;
      }

      const data = await safeJson<any>(response);
      const rawBuses = Array.isArray(data)
        ? data
        : Array.isArray(data.buses)
          ? data.buses
          : Array.isArray(data.vehicles)
            ? data.vehicles
            : [];

      return rawBuses
        .map((bus: any, index: number) => normalizeLiveBus(bus, index))
        .filter(Boolean) as LiveBus[];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Live buses failed");
}

function normalizePlaceType(item: any): PlaceResult["type"] {
  const rawType = String(
    item?.type ?? item?.kind ?? item?.category ?? "poi",
  ).toLowerCase();

  // IMPORTANT: do not convert POI/address into stop just because the title contains
  // a stop-like word. Stops are only stops when backend explicitly returns stop type
  // or GTFS stop identifiers. This keeps Akropolis as POI, not Akropolio st.
  if (
    rawType === "stop" ||
    rawType === "bus_stop" ||
    item?.stop_id ||
    item?.stopId
  ) {
    return "stop" as PlaceResult["type"];
  }

  if (rawType === "street") {
    return "street" as PlaceResult["type"];
  }

  if (
    rawType === "settlement" ||
    rawType === "village" ||
    rawType === "hamlet"
  ) {
    return "city" as PlaceResult["type"];
  }

  if (rawType === "address" || rawType === "house") {
    return "address" as PlaceResult["type"];
  }

  if (
    rawType === "city" ||
    rawType === "town" ||
    rawType === "village" ||
    rawType === "locality"
  ) {
    return "city" as PlaceResult["type"];
  }

  if (
    rawType === "region" ||
    rawType === "county" ||
    rawType === "state" ||
    rawType === "area"
  ) {
    return "region" as PlaceResult["type"];
  }

  return "poi" as PlaceResult["type"];
}

function normalizeSearchPayload(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.places)) return data.places;
  if (Array.isArray(data?.addresses)) return data.addresses;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  return [];
}

function rankPlaceResult(
  item: PlaceResult & { score?: number; priority?: number },
  query: string,
): number {
  const q = query.toLowerCase();
  const title = String(item.title ?? "").toLowerCase();
  const subtitle = String(item.subtitle ?? "").toLowerCase();
  const source = String((item as any).source ?? "").toLowerCase();

  let score = Number((item as any).score ?? (item as any).priority ?? 0);

  // Mobile-side safety ranking. Backend already ranks, but this protects TestFlight
  // from stale cached JS and keeps address autocomplete above POI/stops.
  if (item.type === "address") score += 1400;
  if (item.type === "street") score += 1100;
  if (item.type === "poi") score += isAddressLikeSearchQuery(query) ? -220 : 80;
  if (item.type === "stop")
    score += isAddressLikeSearchQuery(query) ? -320 : 40;
  if (item.type === "city") score += 900;
  if (item.type === "region")
    score += isAddressLikeSearchQuery(query) ? 350 : -80;

  if (source.includes("postgres_address")) score += 700;
  if (source.includes("rc_address")) score += 650;
  if (source.includes("local_poi")) score -= 60;
  if (source.includes("nominatim")) score -= 80;
  if (source.includes("overpass")) score -= 100;
  if (source.includes("gtfs")) score -= 60;

  if (title === q) score += 500;
  if (title.startsWith(q)) score += 250;
  if (title.includes(q)) score += 120;
  if (subtitle.includes(q)) score += 60;

  return score;
}

function dedupePlaceResults(results: PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>();

  return results.filter((item) => {
    const lat = Number(item.latitude).toFixed(5);
    const lng = Number(item.longitude).toFixed(5);
    const key = `${String(item.type).toLowerCase()}|${String(item.title).toLowerCase()}|${lat}|${lng}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function absoluteMediaUrl(url?: string) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

function normalizePhotos(raw: any): any[] {
  const items = raw?.photos ?? raw?.photoUrls ?? [];
  if (!Array.isArray(items)) return [];
  return items
    .map((photo: any) => {
      if (typeof photo === "string") return { url: absoluteMediaUrl(photo) };
      return {
        name: photo?.name,
        url: absoluteMediaUrl(photo?.url),
        widthPx: photo?.widthPx,
        heightPx: photo?.heightPx,
      };
    })
    .filter((photo: any) => photo?.url || photo?.name);
}

function isAddressLikeSearchQuery(query: string) {
  const q = String(query || "").trim();
  return (
    /\d/.test(q) ||
    /\b(g|g\.|gatv[eė]|pr|pr\.|prospektas|al|al\.|pl|pl\.|kelias)\b/i.test(q) ||
    q.split(/\s+/).length >= 2
  );
}

function normalizePlaceResult(item: any, index = 0): PlaceResult | null {
  const coordinate = toCoordinate(item);
  const type = normalizePlaceType(item);
  const selectable =
    item?.selectable !== false && item?.requiresHouseNumber !== true;

  if (!isUsableCoordinate(coordinate) && selectable) return null;
  if (!coordinate) return null;
  const placeId =
    item?.placeId ??
    item?.googlePlaceId ??
    (item?.source === "google_places" ? item?.id : undefined);

  return {
    id: String(
      item.id ??
        placeId ??
        item.osmId ??
        item.stop_id ??
        item.stopId ??
        `${type}-${index}`,
    ),
    title: String(
      item.title ??
        item.name ??
        item.displayName ??
        item.stopName ??
        item.stop_name ??
        "Vieta",
    ),
    subtitle:
      item.subtitle ??
      item.address ??
      item.description ??
      item.label ??
      item.formattedAddress ??
      item.stop_desc ??
      (type === "address" ? "Adresas" : type === "stop" ? "Stotelė" : "Vieta"),
    type,
    source: item.source,
    distanceMeters:
      item.distanceMeters != null ? Number(item.distanceMeters) : undefined,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    selectable: item?.selectable,
    requiresHouseNumber: item?.requiresHouseNumber,
    needsGeocoding: item?.needsGeocoding,
    placeId: placeId != null ? String(placeId) : undefined,
    googlePlaceId:
      item.googlePlaceId != null
        ? String(item.googlePlaceId)
        : placeId != null
          ? String(placeId)
          : undefined,
    category:
      item.category ??
      (Array.isArray(item.keywords) ? item.keywords[0] : undefined),
    rating: item.rating != null ? Number(item.rating) : undefined,
    userRatingCount:
      item.userRatingCount != null ? Number(item.userRatingCount) : undefined,
    openNow: typeof item.openNow === "boolean" ? item.openNow : undefined,
    openNowText: item.openNowText,
    openingHours: Array.isArray(item.openingHours) ? item.openingHours : [],
    photos: normalizePhotos(item),
    photoUrls: Array.isArray(item.photoUrls)
      ? item.photoUrls
      : normalizePhotos(item)
          .map((p: any) => p.url)
          .filter(Boolean),
    phone: item.phone,
    website: item.website,
    googleMapsUri: item.googleMapsUri,
    ...(item.score != null ? { score: Number(item.score) } : {}),
    ...(item.priority != null ? { priority: Number(item.priority) } : {}),
  } as PlaceResult;
}

function searchUrls(params: string) {
  // Production autocomplete must call ONE canonical endpoint only.
  // This is the endpoint that uses the 1M+ RC/Postgres address table first.
  const base = apiBase();
  return [`${base}/api/search/autocomplete?${params}`];
}

async function runSearchRequest(
  q: string,
  userLocation?: SearchLocation,
): Promise<PlaceResult[]> {
  // Use internal/local providers first. External providers are expensive and can trigger rate limits.
  const location =
    normalizeSearchLocation(userLocation) ??
    (await getBestEffortDeviceLocation());

  const params = new URLSearchParams({
    q,
    limit: "10",
    // Apple Maps-style autocomplete: local DB first; external providers only after
    // backend decides they are needed. This keeps typing instant and avoids POI noise.
    external: "false",
    includeExternal: "false",
    autocomplete: "true",
    mode: "autocomplete",
  });

  if (location) {
    params.set("lat", String(location.latitude));
    params.set("lon", String(location.longitude));
    params.set("latitude", String(location.latitude));
    params.set("longitude", String(location.longitude));
  }

  const url = searchUrls(params.toString())[0];

  activeSearchController?.abort();
  const controller = new AbortController();
  activeSearchController = controller;

  try {
    const data = await fetchSearchJson(url, controller.signal);
    if (!data) return [];

    const rawResults = normalizeSearchPayload(data);
    if (!rawResults.length) return [];

    const normalized = rawResults
      .map((item: any, index: number): PlaceResult | null =>
        normalizePlaceResult(item, index),
      )
      .filter(Boolean) as PlaceResult[];

    // Unified Local Search already ranks addresses, settlements, POI and stops on the backend.
    // Do not filter the list down to only addresses here; otherwise places like
    // Melnragė / Smiltynė / ferry terminals / POI disappear while typing.
    const safeResults = normalized.filter((item: any) => {
      if (item.selectable === false || item.requiresHouseNumber === true) {
        return String(item.type || "").toLowerCase() === "street";
      }
      return isUsableCoordinate(item.coordinate || null);
    });

    return dedupePlaceResults(safeResults)
      .sort(
        (a, b) => rankPlaceResult(b as any, q) - rankPlaceResult(a as any, q),
      )
      .slice(0, 10);
  } catch (error) {
    if ((error as any)?.name !== "AbortError") {
      console.warn("[Arbebus search] failed", error);
    }
    return [];
  } finally {
    if (activeSearchController === controller) {
      activeSearchController = null;
    }
  }
}

export async function searchPlaces(
  query: string,
  userLocation?: SearchLocation,
): Promise<PlaceResult[]> {
  const q = query.replace(/\s{2,}/g, " ").trim();
  if (q.length < 2) return [];

  const explicitLocation = normalizeSearchLocation(userLocation);
  const cached = getSearchMemoryCache(q, explicitLocation);
  if (cached && cached.length) return cached.slice(0, 10);

  const results = await runSearchRequest(q, explicitLocation);

  const ranked = dedupePlaceResults(results)
    .sort((a, b) => rankPlaceResult(b as any, q) - rankPlaceResult(a as any, q))
    .slice(0, 10);

  if (ranked.length) setSearchMemoryCache(q, ranked, explicitLocation);
  return ranked;
}

export async function reverseGeocodePlace(
  coordinate: Coordinate,
): Promise<PlaceResult> {
  const lat = Number(coordinate.latitude);
  const lng = Number(coordinate.longitude);

  const fallback: PlaceResult = {
    id: `map-${lat.toFixed(6)}-${lng.toFixed(6)}`,
    title: "Pasirinkta vieta",
    subtitle: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    type: "address" as PlaceResult["type"],
    latitude: lat,
    longitude: lng,
    coordinate: { latitude: lat, longitude: lng },
    source: "map_tap",
  } as PlaceResult;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fallback;

  const urls = [
    `${apiBase()}/api/search/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    `${API_ENDPOINTS.placesSearch}/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetchWithRetry(url, undefined, 0);
      if (!response.ok) continue;
      const data = await safeJson<any>(response);
      const raw = data?.place || data?.result || data?.results?.[0];
      const coordinateFromResponse = toCoordinate(raw) ?? fallback.coordinate;
      if (!raw || !coordinateFromResponse) continue;

      return (normalizePlaceResult(
        { ...raw, coordinate: coordinateFromResponse },
        0,
      ) || fallback) as PlaceResult;
    } catch {
      // Try compatible fallback endpoint.
    }
  }

  return fallback;
}

export async function fetchPlaceDetails(
  placeId: string,
): Promise<PlaceResult | null> {
  const id = String(placeId || "").trim();
  if (!id) return null;

  const urls = [
    `${apiBase()}/api/search/details?placeId=${encodeURIComponent(id)}`,
    `${API_ENDPOINTS.placesSearch}/details?placeId=${encodeURIComponent(id)}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetchWithRetry(url, undefined, 0);
      if (!response.ok) continue;
      const data = await safeJson<any>(response);
      const raw = data?.place || data?.result || data?.results?.[0];
      const normalized = normalizePlaceResult(raw, 0);
      if (normalized) return normalized;
    } catch {
      // Try next compatible endpoint.
    }
  }

  return null;
}

export async function planTransitRoute(params: {
  from: Coordinate;
  to: Coordinate;
  destination?: PlaceResult;
  timeMode?: "now" | "depart" | "arrive";
  travelAt?: string | Date | null;
}): Promise<TransitRouteOption[]> {
  const destination = params.destination ?? {
    id: "destination",
    title: "Tikslas",
    subtitle: "",
    type: "place",
    distanceMeters: 0,
    latitude: params.to.latitude,
    longitude: params.to.longitude,
    coordinate: params.to,
  };

  const response = await fetchWithTimeout(
    API_ENDPOINTS.transitPlan,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: {
          latitude: params.from.latitude,
          longitude: params.from.longitude,
        },
        destination: {
          latitude: params.to.latitude,
          longitude: params.to.longitude,
        },
        from: params.from,
        to: params.to,
        selectedDestination: destination,
        timeMode: params.timeMode || "now",
        travelAt:
          params.travelAt instanceof Date
            ? new Date(
                params.travelAt.toLocaleString("en-US", {
                  timeZone: "Europe/Vilnius",
                }),
              ).toISOString()
            : params.travelAt || null,
        // Important: keep the first plan response fast. Detailed walking geometry is
        // hydrated lazily later, so route cards never get stuck on "checking stops".
        includeWalkingGeometry: false,
      }),
    },
    15000,
  );

  const data = await safeJson<any>(response);

  if (!response.ok || data?.ok !== true) {
    throw new Error(
      data?.error || data?.message || `Transit plan failed: ${response.status}`,
    );
  }

  const rawRoutes = [
    ...(data?.plan ? [data.plan] : []),
    ...(Array.isArray(data?.options) ? data.options : []),
    ...(Array.isArray(data?.routes) ? data.routes : []),
  ];

  const uniqueRoutes = rawRoutes.filter(
    (route, index, arr) =>
      route &&
      arr.findIndex((item) => String(item?.id) === String(route?.id)) === index,
  );

  return uniqueRoutes
    .slice(0, 6)
    .map((route: any, index: number) =>
      normalizeBackendPlan(route, index, params.from, params.to),
    );
}

export async function fetchWalkingRoute(
  fromOrParams: Coordinate | { from: Coordinate; to: Coordinate },
  maybeTo?: Coordinate,
): Promise<WalkingRouteResult | null> {
  const from = "from" in fromOrParams ? fromOrParams.from : fromOrParams;

  const to = "from" in fromOrParams ? fromOrParams.to : maybeTo;

  if (!from || !to) return null;
  const body = JSON.stringify({
    origin: {
      latitude: from.latitude,
      longitude: from.longitude,
    },
    destination: {
      latitude: to.latitude,
      longitude: to.longitude,
    },
    from,
    to,
  });

  const urls = [
    API_ENDPOINTS.routingWalk,
    `${apiBase()}/routing/walk`,
    `${apiBase()}/route/walk`,
    `${apiBase()}/directions/walk`,
    `${apiBase()}/directions/foot-walking`,
    `${apiBase()}/walk/route`,
  ];

  for (const url of urls) {
    try {
      const response = await fetchWithRetry(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
        0,
      );

      if (!response.ok) continue;

      const data = await safeJson<any>(response);
      const geometry = normalizeGeometry(data);

      if (geometry.length >= 2) {
        const durationSeconds =
          data?.durationSeconds ??
          data?.duration ??
          data?.summary?.duration ??
          data?.features?.[0]?.properties?.summary?.duration ??
          null;

        const distanceMeters =
          data?.distanceMeters ??
          data?.distance ??
          data?.summary?.distance ??
          data?.features?.[0]?.properties?.summary?.distance ??
          null;

        const durationNumber = Number(durationSeconds);
        const distanceNumber = Number(distanceMeters);

        return {
          geometry,
          polyline: geometry,
          points: geometry,
          durationSeconds: Number.isFinite(durationNumber)
            ? durationNumber
            : null,
          durationMinutes: Number.isFinite(durationNumber)
            ? Math.max(1, Math.round(durationNumber / 60))
            : null,
          distanceMeters: Number.isFinite(distanceNumber)
            ? distanceNumber
            : null,
        };
      }
    } catch {
      // Try next walking endpoint.
    }
  }

  return null;
}

export type StationAccessPoint = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  code?: string | null;
  priority?: number | null;
  latitude: number;
  longitude: number;
  coordinate: Coordinate;
  source?: string | null;
};

export type DepartureBoardItem = {
  tripId: string;
  routeId?: string | null;
  routeLabel?: string | null;
  routeColor?: string | null;
  headsign?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  countdownMinutes?: number | null;
  stopSequence?: number | null;
};

export async function fetchDepartures(
  stopId?: string | number | null,
): Promise<DepartureBoardItem[]> {
  if (!stopId) return [];

  const response = await fetchWithRetry(API_ENDPOINTS.departures(stopId));

  if (!response.ok) {
    throw new Error(`Departures failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);
  const rawDepartures = Array.isArray(data)
    ? data
    : Array.isArray(data?.departures)
      ? data.departures
      : [];

  return rawDepartures.map((item: any, index: number) => ({
    tripId: String(item?.tripId ?? item?.trip_id ?? `departure-${index}`),
    routeId:
      item?.routeId != null
        ? String(item.routeId)
        : item?.route_id != null
          ? String(item.route_id)
          : null,
    routeLabel:
      item?.routeLabel != null
        ? String(item.routeLabel)
        : item?.route_short_name != null
          ? String(item.route_short_name)
          : null,
    routeColor: item?.routeColor ?? null,
    headsign: item?.headsign ?? null,
    arrivalTime: item?.arrivalTime ?? item?.arrival_time ?? null,
    departureTime: item?.departureTime ?? item?.departure_time ?? null,
    countdownMinutes:
      item?.countdownMinutes != null ? Number(item.countdownMinutes) : null,
    stopSequence: item?.stopSequence != null ? Number(item.stopSequence) : null,
  }));
}

export async function fetchStationAccess(
  stopId?: string | number | null,
): Promise<StationAccessPoint[]> {
  if (!stopId) return [];
  const response = await fetchWithRetry(API_ENDPOINTS.stationAccess(stopId));

  if (!response.ok) {
    throw new Error(`Station access failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);
  const rawAccess = Array.isArray(data)
    ? data
    : Array.isArray(data?.accessPoints)
      ? data.accessPoints
      : Array.isArray(data?.stationAccess)
        ? data.stationAccess
        : [];

  return rawAccess
    .map((item: any, index: number) => {
      const coordinate = toCoordinate(item);
      if (!coordinate) return null;
      return {
        id: String(item?.id ?? `access-${stopId}-${index}`),
        type: String(item?.type ?? "entrance"),
        title: String(item?.title ?? item?.name ?? `Įėjimas ${index + 1}`),
        description: item?.description ?? null,
        code: item?.code ?? null,
        priority: item?.priority != null ? Number(item.priority) : index + 1,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        coordinate,
        source: item?.source ?? null,
      };
    })
    .filter(Boolean) as StationAccessPoint[];
}


export async function fetchTransitRoutes(): Promise<TransitScheduleRoute[]> {
  const response = await fetchWithRetry(API_ENDPOINTS.transitRoutes);
  if (!response.ok) throw new Error(`Transit routes failed: ${response.status}`);
  const data = await safeJson<any>(response);
  const routes = Array.isArray(data?.routes) ? data.routes : [];
  return routes.map((route: any) => ({
    id: String(route.id ?? route.routeId ?? route.shortName),
    routeId: String(route.routeId ?? route.id ?? route.shortName),
    shortName: String(route.shortName ?? route.routeId ?? route.id ?? ""),
    longName: route.longName ? String(route.longName) : undefined,
    title: String(route.title ?? `${route.shortName ?? route.routeId} Autobusas`),
    subtitle: route.subtitle ? String(route.subtitle) : undefined,
    from: route.from ?? null,
    to: route.to ?? null,
    color: route.color ?? null,
    textColor: route.textColor ?? null,
  }));
}

export async function fetchTransitRouteStops(routeId: string | number): Promise<any[]> {
  const response = await fetchWithRetry(API_ENDPOINTS.transitRouteStops(routeId));
  if (!response.ok) throw new Error(`Transit route stops failed: ${response.status}`);
  const data = await safeJson<any>(response);
  return Array.isArray(data?.stops) ? data.stops : [];
}

export async function fetchTransitRouteShape(routeId: string | number): Promise<TransitRouteShapePayload> {
  const response = await fetchWithRetry(API_ENDPOINTS.transitRouteShape(routeId));
  if (!response.ok) throw new Error(`Transit route shape failed: ${response.status}`);
  const data = await safeJson<any>(response);
  const polyline = (Array.isArray(data?.polyline) ? data.polyline : data?.points || [])
    .map(toCoordinate)
    .filter(Boolean) as Coordinate[];
  const stops = Array.isArray(data?.stops) ? data.stops : [];
  const route = data?.route || { routeId: String(routeId), shortName: String(routeId), title: `${routeId} Autobusas` };
  return { ...data, route, routeId: String(data?.routeId ?? routeId), polyline, points: polyline, stops };
}

export async function fetchVehicle(
  id?: string | number | null,
): Promise<any | null> {
  if (!id) return null;
  const response = await fetchWithRetry(API_ENDPOINTS.vehicle(id));

  if (!response.ok) {
    throw new Error(`Vehicle failed: ${response.status}`);
  }

  return safeJson<any>(response);
}

export async function fetchTransitShape(
  shapeId?: string | null,
): Promise<Coordinate[]> {
  if (!shapeId) return [];

  const url = API_ENDPOINTS.transitShape(shapeId);
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`Transit shape failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);
  const points = Array.isArray(data?.points) ? data.points : [];

  return points.map(toCoordinate).filter(Boolean) as Coordinate[];
}

export async function fetchLiveEta(
  route: TransitRouteOption,
): Promise<LiveEtaResult | null> {
  const routeId = route.routeNumbers?.[0] ?? route.routeId ?? route.routeLabel;
  const stop = route.originStop;

  if (!routeId || !stop?.coordinate) return null;

  const params = new URLSearchParams({
    routeId: normalizeRouteNumber(routeId),
    stopLat: String(stop.coordinate.latitude),
    stopLon: String(stop.coordinate.longitude),
    stopName: stop.name ?? stop.title ?? route.boardStopName,
  });

  if (route.destinationStop?.coordinate) {
    params.set(
      "destinationStopLat",
      String(route.destinationStop.coordinate.latitude),
    );
    params.set(
      "destinationStopLon",
      String(route.destinationStop.coordinate.longitude),
    );
    params.set(
      "destinationStopName",
      route.destinationStop.name ??
        route.destinationStop.title ??
        route.alightStopName,
    );
  }

  if (route.headsign) {
    params.set("headsign", route.headsign);
  }

  const response = await fetchWithRetry(
    `${API_ENDPOINTS.liveEta}?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Live ETA failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);

  return {
    ...data,
    vehicle: data?.vehicle ? normalizeLiveBus(data.vehicle) : null,
  } as LiveEtaResult;
}
