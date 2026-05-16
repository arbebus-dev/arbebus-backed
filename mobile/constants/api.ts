import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<
  string,
  string | undefined
>;

function cleanApiBase(value?: string | null) {
  const cleaned = String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/+$/g, "");

  if (!cleaned || !/^https?:\/\//i.test(cleaned)) return null;
  return cleaned;
}

// IMPORTANT:
// Mobile must never use backend-only keys (GOOGLE_PLACES_API_KEY, ORS_API_KEY).
// It only needs the public backend base URL. Keep several names for old builds
// and EAS/Expo extra compatibility.
const resolvedApiBase =
  cleanApiBase(process.env.EXPO_PUBLIC_API_BASE_URL) ||
  cleanApiBase(process.env.EXPO_PUBLIC_API_BASE) ||
  cleanApiBase(extra.EXPO_PUBLIC_API_BASE_URL) ||
  cleanApiBase(extra.API_BASE_URL) ||
  cleanApiBase(extra.apiBaseUrl) ||
  cleanApiBase(extra.API_BASE) ||
  "https://arbebus-backed.onrender.com";

export const API_BASE = resolvedApiBase;

export function apiUrl(path: string) {
  const suffix = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}

export const API_ENDPOINTS = {
  health: apiUrl("/api/health"),

  // Transit
  liveBuses: apiUrl("/api/transit/live-buses"),
  liveEta: apiUrl("/api/transit/live-eta"),
  transitPlan: apiUrl("/api/transit/plan"),
  transitShape: (shapeId: string) =>
    apiUrl(`/api/transit/shape/${encodeURIComponent(shapeId)}`),
  departures: (stopId: string | number) =>
    apiUrl(`/api/transit/departures?stopId=${encodeURIComponent(String(stopId))}`),
  vehicle: (id: string | number) =>
    apiUrl(`/api/transit/vehicle/${encodeURIComponent(String(id))}`),
  stationAccess: (stopId: string | number) =>
    apiUrl(`/api/transit/station-access?stopId=${encodeURIComponent(String(stopId))}`),

  // Ferries
  ferries: apiUrl("/api/ferries"),
  ferryRoutes: apiUrl("/api/ferries/routes"),
  ferrySchedule: apiUrl("/api/ferries/schedule"),
  ferryNext: apiUrl("/api/ferries/next"),
  ferryHealth: apiUrl("/api/ferries/health"),

  // Search / places
  placesSearch: apiUrl("/api/search"),
  stopsSearch: apiUrl("/api/search/stops"),

  // Routing
  routingWalk: apiUrl("/api/routing/walk"),
  routingDirections: apiUrl("/api/routing/directions"),

  // Alerts / push
  alerts: apiUrl("/api/alerts"),
  leaveAlerts: apiUrl("/api/alerts/leave"),
  pushTokens: apiUrl("/api/alerts/tokens"),

  // Parent / child / trips foundation
  parentDashboard: apiUrl("/api/parent/dashboard"),
  childProfiles: apiUrl("/api/child/profiles"),
  savedPlaces: apiUrl("/api/child/saved-places"),
  childTripsStart: apiUrl("/api/trips/start"),
  childTripEvent: (tripId: string) =>
    apiUrl(`/api/trips/${encodeURIComponent(tripId)}/event`),
} as const;
