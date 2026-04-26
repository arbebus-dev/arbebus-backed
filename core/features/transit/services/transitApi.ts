import { API_ENDPOINTS } from "../../../../constants/api";
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

function apiBase() {
  return API_ENDPOINTS.transitPlan.replace(/\/transit\/plan$/, "");
}

const API_TIMEOUT_MS = 9000;
const API_RETRY_COUNT = 1;

async function fetchWithTimeout(input: string, init?: RequestInit, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...(init || {}),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(input: string, init?: RequestInit, retries = API_RETRY_COUNT) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(input, init);
      if (response.ok || attempt >= retries || response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    }

    await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
  }

  throw lastError instanceof Error ? lastError : new Error("Network request failed");
}

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Bad JSON response: ${text.slice(0, 250)}`);
  }
}

function toCoordinate(input: any): Coordinate | null {
  const latitude = Number(
    input?.latitude ??
      input?.lat ??
      input?.stop_lat ??
      input?.coordinate?.latitude
  );

  const longitude = Number(
    input?.longitude ??
      input?.lon ??
      input?.lng ??
      input?.stop_lon ??
      input?.coordinate?.longitude
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
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
    raw?.number ??
      raw?.route ??
      raw?.routeId ??
      raw?.line ??
      raw?.vehicleLabel ??
      "BUS"
  );

  const vehicleId = normalizeId(
    raw?.vehicleId ??
      raw?.vehicle_id ??
      raw?.id ??
      raw?.vehicleLabel ??
      `${number}-${index}`
  );

  const id = normalizeId(raw?.id ?? vehicleId);

  return {
    id,
    number,
    route: raw?.route != null ? String(raw.route) : number,
    routeId: raw?.routeId != null ? String(raw.routeId) : normalizeRouteNumber(number),
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

function normalizeStep(raw: any, index: number): TransitStep {
  const rawType = String(raw?.type ?? raw?.mode ?? "bus");

  const type: TransitStepType =
    rawType === "walk" ||
    rawType === "transfer" ||
    rawType === "arrive" ||
    rawType === "board" ||
    rawType === "ride" ||
    rawType === "alight"
      ? rawType
      : "bus";

  return {
    id: String(raw?.id ?? index),
    type,
    mode: raw?.mode,
    icon: raw?.icon,
    title: String(raw?.title ?? "Kelionės žingsnis"),
    subtitle: raw?.subtitle,
    description: raw?.description ?? raw?.subtitle,
    routeId: raw?.routeId != null ? String(raw.routeId) : undefined,
    routeNumber:
      raw?.routeNumber != null
        ? String(raw.routeNumber)
        : raw?.routeId != null
          ? String(raw.routeId)
          : undefined,
    stopId: raw?.stopId != null ? String(raw.stopId) : undefined,
    stopName: raw?.stopName,
    fromStopId: raw?.fromStopId != null ? String(raw.fromStopId) : undefined,
    toStopId: raw?.toStopId != null ? String(raw.toStopId) : undefined,
    fromStopName: raw?.fromStopName ?? raw?.fromStop ?? raw?.stopName,
    toStopName: raw?.toStopName ?? raw?.toStop,
    stopCount: raw?.stopCount != null ? Number(raw.stopCount) : undefined,
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
    polyline: Array.isArray(raw?.polyline)
      ? (raw.polyline.map(toCoordinate).filter(Boolean) as Coordinate[])
      : undefined,
  };
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
  fallbackTo: Coordinate
): TransitRouteOption {
  const summary = raw?.summary ?? {};

  const previewPoints =
    Array.isArray(raw?.previewPoints) && raw.previewPoints.length
      ? (raw.previewPoints.map(toCoordinate).filter(Boolean) as Coordinate[])
      : [fallbackFrom, fallbackTo];

  const journeyStepsRaw = Array.isArray(raw?.journeySteps)
    ? raw.journeySteps
    : Array.isArray(raw?.steps)
      ? raw.steps
      : [];

  const steps = journeyStepsRaw.map(normalizeStep);

  const routeLabel = String(summary.routeLabel ?? raw?.routeLabel ?? "Autobusas");

  const boardStopName = String(
    summary.boardStopName ?? raw?.originStop?.name ?? "Artimiausia stotelė"
  );

  const alightStopName = String(
    summary.alightStopName ?? raw?.destinationStop?.name ?? "Tikslas"
  );

  const from = toCoordinate(raw?.originStop) ?? previewPoints[0] ?? fallbackFrom;
  const to =
    toCoordinate(raw?.destinationStop) ??
    previewPoints[previewPoints.length - 1] ??
    fallbackTo;

  return {
    id: String(raw?.id ?? `route-${index}`),
    title: routeLabel,
    subtitle: summary.journeyMessage ?? undefined,
    mode: raw?.mode,
    routeId: raw?.routeId != null ? String(raw.routeId) : normalizeRouteNumber(routeLabel),
    shapeId: raw?.shapeId ?? summary.shapeId ?? null,
    routeLabel,
    routeNumbers: routeLabel
      .split("→")
      .map((x) => x.trim())
      .filter(Boolean),
    totalMinutes: Number(summary.totalDurationMinutes ?? 0),
    totalDurationMinutes: Number(summary.totalDurationMinutes ?? 0),
    walkingMinutes: Number(summary.totalWalkMinutes ?? 0),
    totalWalkMinutes: Number(summary.totalWalkMinutes ?? 0),
    totalBusMinutes:
      summary.totalBusMinutes != null ? Number(summary.totalBusMinutes) : undefined,
    etaMinutes: summary.etaMinutes != null ? Number(summary.etaMinutes) : null,
    transfers: Number(summary.transfersCount ?? 0),
    transfersCount: Number(summary.transfersCount ?? 0),
    stopCount: Number(summary.stopCount ?? 0),
    boardStopName,
    alightStopName,
    originStop: stopPoint(boardStopName, from, raw?.originStop),
    destinationStop: stopPoint(alightStopName, to, raw?.destinationStop),
    previewPoints,
    polyline: previewPoints,
    steps,
    journeySteps: steps,
    departureText:
      summary.etaMinutes != null ? `Atvyksta po ${summary.etaMinutes} min` : undefined,
    arrivalText: undefined,
    journeyMessage: summary.journeyMessage,
    headsign: summary.headsign ?? summary.directionCode ?? null,
    liveVehicle: raw?.liveVehicle ? normalizeLiveBus(raw.liveVehicle) : null,
    summary,
  } as TransitRouteOption;
}

export async function getLiveBuses(): Promise<LiveBus[]> {
  const response = await fetchWithRetry(API_ENDPOINTS.liveBuses);

  if (!response.ok) {
    throw new Error(`Live buses failed: ${response.status}`);
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
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const urls = [
    `${API_ENDPOINTS.placesSearch}?q=${encodeURIComponent(q)}`,
    `${API_ENDPOINTS.stopsSearch}?q=${encodeURIComponent(q)}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetchWithRetry(url);
      if (!response.ok) continue;

      const data = await safeJson<any>(response);
      const rawResults = data.results || data.places || data.stops || data.items || [];

      if (!Array.isArray(rawResults) || !rawResults.length) continue;

      return rawResults
        .map((item: any, index: number): PlaceResult | null => {
          const coordinate = toCoordinate(item);
          if (!coordinate) return null;

          return {
            id: String(item.id ?? item.stop_id ?? index),
            title: String(item.title ?? item.name ?? item.stopName ?? item.stop_name ?? "Vieta"),
            subtitle:
              item.subtitle ??
              item.address ??
              item.description ??
              item.stop_desc ??
              "Klaipėda",
            type:
              item.type === "address"
                ? "address"
                : item.type === "stop" || item.stop_id
                  ? "stop"
                  : "place",
            distanceMeters:
              item.distanceMeters != null ? Number(item.distanceMeters) : undefined,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            coordinate,
          };
        })
        .filter(Boolean) as PlaceResult[];
    } catch {
      // Try next endpoint.
    }
  }

  return [];
}

export async function planTransitRoute(params: {
  from: Coordinate;
  to: Coordinate;
  destination?: PlaceResult;
}): Promise<TransitRouteOption[]> {
  const destination =
    params.destination ?? {
      id: "destination",
      title: "Tikslas",
      subtitle: "",
      type: "place",
      distanceMeters: 0,
      latitude: params.to.latitude,
      longitude: params.to.longitude,
      coordinate: params.to,
    };

  const response = await fetchWithRetry(API_ENDPOINTS.transitPlan, {
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
    }),
  });

  if (!response.ok) {
    throw new Error(`Transit plan failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);

  const rawRoutes = [
    ...(data?.plan ? [data.plan] : []),
    ...(Array.isArray(data?.options) ? data.options : []),
    ...(Array.isArray(data?.routes) ? data.routes : []),
  ];

  const uniqueRoutes = rawRoutes.filter(
    (route, index, arr) =>
      route &&
      arr.findIndex((item) => String(item?.id) === String(route?.id)) === index
  );

  return uniqueRoutes.map((route: any, index: number) =>
    normalizeBackendPlan(route, index, params.from, params.to)
  );
}

export async function fetchTransitShape(shapeId?: string | null): Promise<Coordinate[]> {
  if (!shapeId) return [];

  const url = `${apiBase()}/transit/shape/${encodeURIComponent(shapeId)}`;
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`Transit shape failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);
  const points = Array.isArray(data?.points) ? data.points : [];

  return points.map(toCoordinate).filter(Boolean) as Coordinate[];
}

export async function fetchLiveEta(route: TransitRouteOption): Promise<LiveEtaResult | null> {
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
    params.set("destinationStopLat", String(route.destinationStop.coordinate.latitude));
    params.set("destinationStopLon", String(route.destinationStop.coordinate.longitude));
    params.set(
      "destinationStopName",
      route.destinationStop.name ?? route.destinationStop.title ?? route.alightStopName
    );
  }

  if (route.headsign) {
    params.set("headsign", route.headsign);
  }

  const response = await fetchWithRetry(`${apiBase()}/transit/live-eta?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Live ETA failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);

  return {
    ...data,
    vehicle: data?.vehicle ? normalizeLiveBus(data.vehicle) : null,
  } as LiveEtaResult;
}