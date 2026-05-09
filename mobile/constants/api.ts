import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<
  string,
  string | undefined
>;

function cleanApiBase(value?: string | null) {
  const cleaned = String(value || "")
    .trim()
    .replace(/^['\"]|['\"]$/g, "")
    .replace(/\/+$/g, "");

  if (!cleaned || !/^https?:\/\//i.test(cleaned)) return null;
  return cleaned;
}

const resolvedApiBase =
  cleanApiBase(process.env.EXPO_PUBLIC_API_BASE_URL) ||
  cleanApiBase(process.env.EXPO_PUBLIC_API_BASE) ||
  cleanApiBase(extra.API_BASE_URL) ||
  cleanApiBase(extra.API_BASE) ||
  "https://arbebus-backed.onrender.com";

export const API_BASE = resolvedApiBase;

export const API_ENDPOINTS = {
  health: `${API_BASE}/api/health`,

  // Transit
  liveBuses: `${API_BASE}/api/transit/live-buses`,
  liveEta: `${API_BASE}/api/transit/live-eta`,
  transitPlan: `${API_BASE}/api/transit/plan`,
  transitShape: (shapeId: string) =>
    `${API_BASE}/api/transit/shape/${encodeURIComponent(shapeId)}`,
  departures: (stopId: string | number) =>
    `${API_BASE}/api/transit/departures?stopId=${encodeURIComponent(String(stopId))}`,
  vehicle: (id: string | number) =>
    `${API_BASE}/api/transit/vehicle/${encodeURIComponent(String(id))}`,
  stationAccess: (stopId: string | number) =>
    `${API_BASE}/api/transit/station-access?stopId=${encodeURIComponent(String(stopId))}`,

  // Search / places
  placesSearch: `${API_BASE}/api/search`,
  stopsSearch: `${API_BASE}/api/search/stops`,

  // Routing
  routingWalk: `${API_BASE}/api/routing/walk`,
  routingDirections: `${API_BASE}/api/routing/directions`,

  // Alerts / push
  alerts: `${API_BASE}/api/alerts`,
  leaveAlerts: `${API_BASE}/api/alerts/leave`,
  pushTokens: `${API_BASE}/api/alerts/tokens`,

  // Parent / child / trips foundation
  parentDashboard: `${API_BASE}/api/parent/dashboard`,
  childProfiles: `${API_BASE}/api/child/profiles`,
  savedPlaces: `${API_BASE}/api/child/saved-places`,
  childTripsStart: `${API_BASE}/api/trips/start`,
  childTripEvent: (tripId: string) =>
    `${API_BASE}/api/trips/${encodeURIComponent(tripId)}/event`,
} as const;
