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

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Bad JSON response: ${text.slice(0, 200)}`);
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

function normalizeStep(raw: any, index: number): TransitStep {
  const rawType = String(raw?.type ?? "bus");

  const type: TransitStepType =
    rawType === "walk" ||
    rawType === "transfer" ||
    rawType === "arrive"
      ? rawType
      : "bus";

  const minutes = raw?.minutes ?? raw?.durationMinutes;

  return {
    id: String(raw?.id ?? index),
    type,
    title: String(
      raw?.title ??
        (type === "walk"
          ? "Eik iki stotelės"
          : type === "transfer"
            ? "Persėdimas"
            : "Važiuok autobusu")
    ),
    subtitle: raw?.subtitle,
    description: raw?.description ?? raw?.subtitle,
    routeNumber:
      raw?.routeNumber != null
        ? String(raw.routeNumber)
        : raw?.route != null
          ? String(raw.route)
          : raw?.routeId != null
            ? String(raw.routeId)
            : undefined,
    fromStopName: raw?.fromStopName ?? raw?.fromStop ?? raw?.from,
    toStopName: raw?.toStopName ?? raw?.toStop ?? raw?.to,
    stopCount: raw?.stopCount != null ? Number(raw.stopCount) : undefined,
    minutes: minutes != null ? Number(minutes) : undefined,
    durationMinutes: minutes != null ? Number(minutes) : undefined,
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
  };
}

function normalizeRoute(
  raw: any,
  index: number,
  fallbackFrom?: Coordinate,
  fallbackTo?: Coordinate
): TransitRouteOption {
  const steps: TransitStep[] = Array.isArray(raw?.steps)
    ? raw.steps.map(normalizeStep)
    : [];

  const routeNumbers = Array.isArray(raw?.routeNumbers)
    ? raw.routeNumbers.map(String).filter(Boolean)
    : Array.isArray(raw?.routes)
      ? raw.routes.map(String).filter(Boolean)
      : steps
          .map((step) => step.routeNumber)
          .filter(Boolean)
          .map(String);

  const routeLabel = String(
    raw?.routeLabel ?? raw?.routeNumber ?? routeNumbers[0] ?? "BUS"
  );

  const rawPolyline = raw?.previewPoints ?? raw?.polyline ?? raw?.coordinates;

  const polyline = Array.isArray(rawPolyline)
    ? (rawPolyline.map(toCoordinate).filter(Boolean) as Coordinate[])
    : [];

  const from =
    toCoordinate(raw?.originStop) ??
    polyline[0] ??
    fallbackFrom ?? {
      latitude: 55.7033,
      longitude: 21.1443,
    };

  const to =
    toCoordinate(raw?.destinationStop) ??
    polyline[polyline.length - 1] ??
    fallbackTo ??
    from;

  const previewPoints = polyline.length >= 2 ? polyline : [from, to];

  const firstBusStep = steps.find((step) => step.type === "bus");

  const boardStopName = String(
    raw?.boardStopName ?? firstBusStep?.fromStopName ?? "Artimiausia stotelė"
  );

  const alightStopName = String(
    raw?.alightStopName ??
      firstBusStep?.toStopName ??
      raw?.destination?.title ??
      "Tikslas"
  );

  const walkingMinutes = Number(
    raw?.walkingMinutes ??
      raw?.totalWalkMinutes ??
      steps
        .filter((step) => step.type === "walk")
        .reduce((sum: number, step: TransitStep) => {
          return sum + Number(step.minutes ?? 0);
        }, 0)
  );

  const totalMinutes = Number(
    raw?.totalMinutes ??
      raw?.minutes ??
      raw?.totalDurationMinutes ??
      steps.reduce((sum: number, step: TransitStep) => {
        return sum + Number(step.minutes ?? step.durationMinutes ?? 0);
      }, 0)
  );

  const transfers = Number(
    raw?.transfers ?? raw?.transfersCount ?? Math.max(0, routeNumbers.length - 1)
  );

  const stopCount = Number(
    raw?.stopCount ??
      steps.reduce((sum: number, step: TransitStep) => {
        return sum + Number(step.stopCount ?? 0);
      }, 0)
  );

  return {
    id: String(raw?.id ?? index),
    title: String(raw?.title ?? `Autobusas ${routeLabel}`),
    subtitle: raw?.subtitle ?? raw?.summary ?? undefined,
    routeLabel,
    routeNumbers,
    totalMinutes,
    totalDurationMinutes: Number(raw?.totalDurationMinutes ?? totalMinutes),
    walkingMinutes,
    totalWalkMinutes: Number(raw?.totalWalkMinutes ?? walkingMinutes),
    etaMinutes: raw?.etaMinutes != null ? Number(raw.etaMinutes) : null,
    transfers,
    transfersCount: transfers,
    stopCount,
    boardStopName,
    alightStopName,
    originStop: stopPoint(boardStopName, from, raw?.originStop),
    destinationStop: stopPoint(alightStopName, to, raw?.destinationStop),
    previewPoints,
    polyline: previewPoints,
    steps,
    journeySteps: steps,
    departureText: raw?.departureText,
    arrivalText: raw?.arrivalText,
  };
}

export async function getLiveBuses(): Promise<LiveBus[]> {
  const response = await fetch(API_ENDPOINTS.liveBuses);

  if (!response.ok) {
    throw new Error(`Live buses failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);
  const rawBuses = Array.isArray(data)
    ? data
    : Array.isArray(data.buses)
      ? data.buses
      : [];

  return rawBuses
    .map((bus: any, index: number): LiveBus | null => {
      const coordinate = toCoordinate(bus);
      if (!coordinate) return null;

      const number = String(
        bus.number ??
          bus.route ??
          bus.routeId ??
          bus.line ??
          bus.vehicleLabel ??
          "BUS"
      );

      return {
        id: String(bus.id ?? bus.vehicleId ?? bus.vehicleLabel ?? `${number}-${index}`),
        number,
        route: bus.route != null ? String(bus.route) : number,
        routeId: bus.routeId != null ? String(bus.routeId) : undefined,
        vehicleId: bus.vehicleId != null ? String(bus.vehicleId) : undefined,
        vehicleLabel:
          bus.vehicleLabel != null ? String(bus.vehicleLabel) : undefined,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        coordinate,
        speedKph: bus.speedKph != null ? Number(bus.speedKph) : undefined,
        bearing: bus.bearing != null ? Number(bus.bearing) : undefined,
        heading:
          bus.heading != null
            ? Number(bus.heading)
            : bus.bearing != null
              ? Number(bus.bearing)
              : undefined,
        tripStart: bus.tripStart,
        delaySeconds:
          bus.delaySeconds != null ? Number(bus.delaySeconds) : undefined,
        directionName: bus.directionName,
        fetchedAt: bus.fetchedAt,
      };
    })
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
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await safeJson<any>(response);

      const rawResults =
        data.results || data.places || data.stops || data.items || [];

      if (!Array.isArray(rawResults) || !rawResults.length) continue;

      return rawResults
        .map((item: any, index: number): PlaceResult | null => {
          const coordinate = toCoordinate(item);
          if (!coordinate) return null;

          return {
            id: String(item.id ?? item.stop_id ?? index),
            title: String(
              item.title ?? item.name ?? item.stopName ?? item.stop_name ?? "Vieta"
            ),
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
              item.distanceMeters != null
                ? Number(item.distanceMeters)
                : undefined,
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
  const destination: PlaceResult =
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

  const response = await fetch(API_ENDPOINTS.transitPlan, {
    method: "POST",
    headers: { "Content-Type": "application/json" },

    // SVARBU:
    // Siunčiam ir naują formatą, ir seną formatą,
    // kad backend nebeatmestų su 400.
    body: JSON.stringify({
      origin: params.from,
      from: params.from,

      destination,
      to: params.to,

      userLocation: params.from,
      selectedDestination: destination,
    }),
  });

  if (!response.ok) {
    throw new Error(`Transit plan failed: ${response.status}`);
  }

  const data = await safeJson<any>(response);

  const rawRoutes =
    data.routes || data.options || data.plans || data.itineraries || [];

  if (!Array.isArray(rawRoutes)) return [];

  return rawRoutes.map((route: any, index: number) =>
    normalizeRoute(route, index, params.from, params.to)
  );
}