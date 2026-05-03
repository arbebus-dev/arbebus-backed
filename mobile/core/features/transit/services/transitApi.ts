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

export type WalkingRouteResult = {
  geometry: Coordinate[];
  polyline: Coordinate[];
  points: Coordinate[];
  durationSeconds: number | null;
  durationMinutes: number | null;
  distanceMeters: number | null;
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
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
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
    title: String(raw?.title ?? raw?.name ?? raw?.stopName ?? raw?.stop_name ?? "Stotelė"),
    name: String(raw?.name ?? raw?.title ?? raw?.stopName ?? raw?.stop_name ?? "Stotelė"),
    stopName: String(raw?.stopName ?? raw?.stop_name ?? raw?.name ?? raw?.title ?? "Stotelė"),
    stopSequence:
      raw?.stopSequence != null
        ? Number(raw.stopSequence)
        : raw?.stop_sequence != null
          ? Number(raw.stop_sequence)
          : undefined,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinate,
    distanceMeters: raw?.distanceMeters != null ? Number(raw.distanceMeters) : undefined,
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
    .filter(Boolean)
    .filter((stop) => Number.isFinite(Number(stop.latitude)) && Number.isFinite(Number(stop.longitude)));
}

function cleanRouteLabel(value?: string | null) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function routeNumbersFromLabel(label?: string | null) {
  return cleanRouteLabel(label)
    .split("→")
    .map((part) => cleanRouteLabel(part).split("•")[0]?.trim())
    .filter(Boolean);
}

function normalizeStep(raw: any, index: number): TransitStep {
  const rawType = String(raw?.type ?? raw?.mode ?? "bus").toLowerCase();

  const type: TransitStepType =
    rawType === "walk" ||
    rawType === "transfer" ||
    rawType === "arrive" ||
    rawType === "board" ||
    rawType === "ride" ||
    rawType === "alight"
      ? (rawType as TransitStepType)
      : "bus";

  const stops = normalizeStops(
    raw?.stops ??
      raw?.rideStops ??
      raw?.routeStops ??
      raw?.stopList ??
      raw?.passedStops ??
      raw?.summary?.stops
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
    mode: raw?.mode ?? (type === "ride" || type === "board" || type === "bus" ? "bus" : type),
    icon: raw?.icon,
    title: String(raw?.title ?? "Kelionės žingsnis"),
    subtitle: raw?.subtitle,
    description: raw?.description ?? raw?.subtitle,
    routeId: raw?.routeId != null ? String(raw.routeId) : undefined,
    routeNumber,
    routeLabel: raw?.routeLabel != null ? cleanRouteLabel(raw.routeLabel) : routeNumber,
    stopId: raw?.stopId != null ? String(raw.stopId) : undefined,
    stopName: raw?.stopName,
    fromStopId: raw?.fromStopId != null ? String(raw.fromStopId) : undefined,
    toStopId: raw?.toStopId != null ? String(raw.toStopId) : undefined,
    fromStopName: raw?.fromStopName ?? raw?.fromStop?.name ?? raw?.fromStop,
    toStopName: raw?.toStopName ?? raw?.toStop?.name ?? raw?.toStop,
    stopCount: raw?.stopCount != null ? Number(raw.stopCount) : stops.length > 0 ? Math.max(0, stops.length - 1) : undefined,
    stops,
    rideStops: stops,
    routeStops: stops,
    minutes: raw?.minutes != null ? Number(raw.minutes) : raw?.durationMinutes != null ? Number(raw.durationMinutes) : undefined,
    durationMinutes: raw?.durationMinutes != null ? Number(raw.durationMinutes) : raw?.minutes != null ? Number(raw.minutes) : undefined,
    distanceMeters: raw?.distanceMeters != null ? Number(raw.distanceMeters) : undefined,
    departureTime: raw?.departureTime ?? raw?.departureText,
    arrivalTime: raw?.arrivalTime ?? raw?.arrivalText,
    polyline,
  };

  return normalized as TransitStep;
}

function buildStepsFromBackendPlan(raw: any, summary: any): TransitStep[] {
  const routeLabel = cleanRouteLabel(summary.routeLabel ?? raw?.routeLabel ?? "Autobusas");
  const routeNumbers = routeNumbersFromLabel(routeLabel);
  const boardStopName = String(summary.boardStopName ?? raw?.originStop?.name ?? "Įlipimo stotelė");
  const alightStopName = String(summary.alightStopName ?? raw?.destinationStop?.name ?? "Išlipimo stotelė");
  const totalWalkMinutes = Number(summary.totalWalkMinutes ?? raw?.totalWalkMinutes ?? raw?.walkingMinutes ?? 0);
  const totalBusMinutes = Number(summary.totalBusMinutes ?? raw?.totalBusMinutes ?? 0);
  const stopCount = Number(summary.stopCount ?? raw?.stopCount ?? 0);
  const transfersCount = Number(summary.transfersCount ?? raw?.transfersCount ?? Math.max(0, routeNumbers.length - 1));
  const numbers = routeNumbers.length ? routeNumbers : [cleanRouteLabel(raw?.routeId ?? routeLabel ?? "Autobusas")];
  const steps: TransitStep[] = [];

  if (totalWalkMinutes > 0) {
    steps.push(normalizeStep({
      id: "walk-to-stop",
      type: "walk",
      mode: "walk",
      icon: "walk",
      title: "Eik iki stotelės",
      subtitle: `Iki „${boardStopName}“ • ${totalWalkMinutes} min pėsčiomis`,
      stopName: boardStopName,
      durationMinutes: totalWalkMinutes,
      minutes: totalWalkMinutes,
    }, steps.length));
  }

  numbers.forEach((number, routeIndex) => {
    const isLast = routeIndex === numbers.length - 1;

    steps.push(normalizeStep({
      id: `board-${routeIndex}`,
      type: "board",
      mode: "bus",
      icon: "bus",
      title: `Lipk į autobusą ${number}`,
      subtitle: routeIndex === 0 ? `Stotelė „${boardStopName}“` : "Persėdimo stotelė",
      routeId: number,
      routeNumber: number,
      stopName: routeIndex === 0 ? boardStopName : undefined,
    }, steps.length));

    steps.push(normalizeStep({
      id: `ride-${routeIndex}`,
      type: "ride",
      mode: "bus",
      icon: "bus",
      title: "Važiuok autobusu",
      subtitle: isLast ? `Iki „${alightStopName}“ • ${totalBusMinutes || "?"} min • ${stopCount || "?"} st.` : "Iki persėdimo stotelės",
      routeId: number,
      routeNumber: number,
      stopCount: isLast ? stopCount : undefined,
      durationMinutes: isLast ? totalBusMinutes : undefined,
      minutes: isLast ? totalBusMinutes : undefined,
      toStopName: isLast ? alightStopName : undefined,
    }, steps.length));

    if (!isLast || transfersCount > routeIndex) {
      steps.push(normalizeStep({
        id: `transfer-${routeIndex}`,
        type: "transfer",
        mode: "walk",
        icon: "swap-horizontal",
        title: "Persėsk",
        subtitle: `Toliau važiuok autobusu ${numbers[routeIndex + 1] ?? ""}`.trim(),
      }, steps.length));
    }
  });

  steps.push(normalizeStep({
    id: "alight-final",
    type: "alight",
    icon: "flag-checkered",
    title: "Išlipk",
    subtitle: `„${alightStopName}“`,
    stopName: alightStopName,
  }, steps.length));

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
  fallbackTo: Coordinate
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
  const routeLabel = cleanRouteLabel(summary.routeLabel ?? raw?.routeLabel ?? raw?.title ?? "Autobusas");
  const steps = parsedSteps.length ? parsedSteps : buildStepsFromBackendPlan(raw, summary);

  const boardStopName = String(summary.boardStopName ?? raw?.boardStopName ?? raw?.originStop?.name ?? "Artimiausia stotelė");
  const alightStopName = String(summary.alightStopName ?? raw?.alightStopName ?? raw?.destinationStop?.name ?? "Tikslas");

  const from = toCoordinate(raw?.originStop) ?? previewPoints[0] ?? fallbackFrom;
  const to = toCoordinate(raw?.destinationStop) ?? previewPoints[previewPoints.length - 1] ?? fallbackTo;
  const totalDurationMinutes = Number(summary.totalDurationMinutes ?? raw?.totalDurationMinutes ?? raw?.totalMinutes ?? 0);
  const totalWalkMinutes = Number(summary.totalWalkMinutes ?? raw?.totalWalkMinutes ?? raw?.walkingMinutes ?? 0);
  const transfersCount = Number(summary.transfersCount ?? raw?.transfersCount ?? raw?.transfers ?? Math.max(0, routeNumbersFromLabel(routeLabel).length - 1));
  const stopCount = Number(summary.stopCount ?? raw?.stopCount ?? steps.reduce((sum: number, step: TransitStep) => sum + Number(step.stopCount ?? 0), 0));

  return {
    id: String(raw?.id ?? `route-${index}`),
    title: routeLabel,
    subtitle: summary.journeyMessage ?? raw?.subtitle ?? undefined,
    mode: raw?.mode,
    routeId: raw?.routeId != null ? String(raw.routeId) : normalizeRouteNumber(routeLabel),
    shapeId: raw?.shapeId ?? summary.shapeId ?? null,
    routeLabel,
    routeNumbers: routeNumbersFromLabel(routeLabel),
    totalMinutes: totalDurationMinutes,
    totalDurationMinutes,
    walkingMinutes: totalWalkMinutes,
    totalWalkMinutes,
    totalBusMinutes: summary.totalBusMinutes != null ? Number(summary.totalBusMinutes) : raw?.totalBusMinutes != null ? Number(raw.totalBusMinutes) : undefined,
    etaMinutes: summary.etaMinutes != null ? Number(summary.etaMinutes) : raw?.etaMinutes != null ? Number(raw.etaMinutes) : null,
    liveEta: raw?.liveEta ?? null,
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
    departureText: summary.etaMinutes != null ? `Atvyksta po ${summary.etaMinutes} min` : raw?.departureText,
    arrivalText: raw?.arrivalText,
    journeyMessage: summary.journeyMessage ?? raw?.journeyMessage,
    headsign: summary.headsign ?? summary.directionCode ?? raw?.headsign ?? null,
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

  const url = `${API_ENDPOINTS.placesSearch}?q=${encodeURIComponent(q)}&limit=24`;

  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) return [];

    const data = await safeJson<any>(response);
    const rawResults = data.results || data.places || data.items || [];

    if (!Array.isArray(rawResults) || !rawResults.length) return [];

    return rawResults
      .map((item: any, index: number): PlaceResult | null => {
        const coordinate = toCoordinate(item);
        if (!coordinate) return null;

        const rawType = String(item.type ?? item.kind ?? "place").toLowerCase();
        const type =
          rawType === "stop" || item.stop_id || item.stopId
            ? "stop"
            : rawType === "address" || rawType === "street"
              ? "address"
              : rawType === "city" || rawType === "locality"
                ? "city"
                : rawType === "region" || rawType === "county"
                  ? "region"
                  : "poi";

        return {
          id: String(item.id ?? item.stop_id ?? item.stopId ?? `${type}-${index}`),
          title: String(item.title ?? item.name ?? item.stopName ?? item.stop_name ?? "Vieta"),
          subtitle:
            item.subtitle ??
            item.address ??
            item.description ??
            item.label ??
            item.stop_desc ??
            (type === "address" ? "Adresas" : "Lietuva"),
          type,
          source: item.source,
          distanceMeters:
            item.distanceMeters != null ? Number(item.distanceMeters) : undefined,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          coordinate,
        } as PlaceResult;
      })
      .filter(Boolean) as PlaceResult[];
  } catch {
    return [];
  }
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

export async function fetchWalkingRoute(
  fromOrParams: Coordinate | { from: Coordinate; to: Coordinate },
  maybeTo?: Coordinate
): Promise<WalkingRouteResult | null> {
  const from =
    "from" in fromOrParams ? fromOrParams.from : fromOrParams;

  const to =
    "from" in fromOrParams ? fromOrParams.to : maybeTo;

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
        0
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
          durationSeconds: Number.isFinite(durationNumber) ? durationNumber : null,
          durationMinutes: Number.isFinite(durationNumber)
            ? Math.max(1, Math.round(durationNumber / 60))
            : null,
          distanceMeters: Number.isFinite(distanceNumber) ? distanceNumber : null,
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

export async function fetchDepartures(stopId?: string | number | null): Promise<DepartureBoardItem[]> {
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
    routeId: item?.routeId != null ? String(item.routeId) : item?.route_id != null ? String(item.route_id) : null,
    routeLabel: item?.routeLabel != null ? String(item.routeLabel) : item?.route_short_name != null ? String(item.route_short_name) : null,
    routeColor: item?.routeColor ?? null,
    headsign: item?.headsign ?? null,
    arrivalTime: item?.arrivalTime ?? item?.arrival_time ?? null,
    departureTime: item?.departureTime ?? item?.departure_time ?? null,
    countdownMinutes: item?.countdownMinutes != null ? Number(item.countdownMinutes) : null,
    stopSequence: item?.stopSequence != null ? Number(item.stopSequence) : null,
  }));
}


export async function fetchStationAccess(stopId?: string | number | null): Promise<StationAccessPoint[]> {
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
        type: String(item?.type ?? 'entrance'),
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

export async function fetchVehicle(id?: string | number | null): Promise<any | null> {
  if (!id) return null;
  const response = await fetchWithRetry(API_ENDPOINTS.vehicle(id));

  if (!response.ok) {
    throw new Error(`Vehicle failed: ${response.status}`);
  }

  return safeJson<any>(response);
}

export async function fetchTransitShape(shapeId?: string | null): Promise<Coordinate[]> {
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

  const response = await fetchWithRetry(`${API_ENDPOINTS.liveEta}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Live ETA failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);

  return {
    ...data,
    vehicle: data?.vehicle ? normalizeLiveBus(data.vehicle) : null,
  } as LiveEtaResult;
}
