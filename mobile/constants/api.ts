import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE ||
  extra.API_BASE_URL ||
  extra.API_BASE ||
  "https://arbebus-backed.onrender.com";

export const API_ENDPOINTS = {
  health: `${API_BASE}/api/health`,
  liveBuses: `${API_BASE}/api/transit/live-buses`,
  liveEta: `${API_BASE}/api/transit/live-eta`,
  transitPlan: `${API_BASE}/api/transit/plan`,
  transitShape: (shapeId: string) => `${API_BASE}/api/transit/shape/${encodeURIComponent(shapeId)}`,
  departures: (stopId: string | number) => `${API_BASE}/api/transit/departures?stopId=${encodeURIComponent(String(stopId))}`,
  vehicle: (id: string | number) => `${API_BASE}/api/transit/vehicle/${encodeURIComponent(String(id))}`,
  stationAccess: (stopId: string | number) => `${API_BASE}/api/transit/station-access?stopId=${encodeURIComponent(String(stopId))}`,
  placesSearch: `${API_BASE}/api/search`,
  stopsSearch: `${API_BASE}/api/search/stops`,
  routingWalk: `${API_BASE}/api/routing/walk`,
  routingDirections: `${API_BASE}/api/routing/directions`,
  alerts: `${API_BASE}/api/alerts`,
  leaveAlerts: `${API_BASE}/api/alerts/leave`,
  pushTokens: `${API_BASE}/api/alerts/tokens`,
};
