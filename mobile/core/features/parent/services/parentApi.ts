import { API_ENDPOINTS } from "../../../../constants/api";
import type { PlaceSearchResult, TransitRouteOption } from "../../transit/models/transitTypes";

const DEFAULT_PARENT_ID = "local-parent";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...(init || {}),
    headers: {
      "Content-Type": "application/json",
      "x-parent-id": DEFAULT_PARENT_ID,
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data?.error || `Request failed ${response.status}`);
  return data as T;
}

export type ParentDashboard = {
  ok: boolean;
  parentId: string;
  children: any[];
  savedPlaces: any[];
  activeTrips: any[];
  recentEvents: any[];
};

export function fetchParentDashboard() {
  return request<ParentDashboard>(API_ENDPOINTS.parentDashboard);
}

export function createChildProfile(payload: { displayName: string; grade?: string | null }) {
  return request<{ ok: boolean; child: any }>(API_ENDPOINTS.childProfiles, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function syncSavedPlace(payload: { placeType: string; label?: string; place: PlaceSearchResult }) {
  const coordinate = payload.place.coordinate || { latitude: payload.place.latitude, longitude: payload.place.longitude };
  return request<{ ok: boolean; place: any }>(API_ENDPOINTS.savedPlaces, {
    method: "POST",
    body: JSON.stringify({
      placeType: payload.placeType,
      label: payload.label || payload.placeType,
      title: payload.place.title,
      subtitle: payload.place.subtitle,
      coordinate,
      metadata: { sourcePlace: payload.place },
    }),
  });
}

export function startChildTrip(payload: { childId?: string | null; origin: PlaceSearchResult; destination: PlaceSearchResult; routeOption: TransitRouteOption }) {
  return request<{ ok: boolean; trip: any }>(API_ENDPOINTS.childTripsStart, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendChildTripEvent(tripId: string, payload: { type: string; title: string; childId?: string | null; latitude?: number; longitude?: number; payload?: any }) {
  return request<{ ok: boolean; event: any }>(API_ENDPOINTS.childTripEvent(tripId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
