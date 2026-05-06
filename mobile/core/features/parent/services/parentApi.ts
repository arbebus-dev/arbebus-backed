import { API_ENDPOINTS } from "@/constants/api";
import type {
    PlaceSearchResult,
    TransitRouteOption,
} from "../../transit/models/transitTypes";

interface Child {
  id: string;
  displayName: string;
  grade?: string;
}

interface SavedPlace {
  id: string;
  placeType: string;
  label?: string;
  place: PlaceSearchResult;
}

interface Trip {
  id: string;
  // add more fields as needed
}

interface TripEvent {
  id: string;
  title?: string;
  event_type?: string;
  type?: string;
  created_at?: string;
  createdAt?: string;
}

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
  let data: unknown = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || `Request failed ${response.status}` };
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String(
            (data as { error?: unknown }).error ||
              `Request failed ${response.status}`,
          )
        : `Request failed ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export type ParentDashboard = {
  ok: boolean;
  parentId: string;
  children: Child[];
  savedPlaces: SavedPlace[];
  activeTrips: Trip[];
  recentEvents: TripEvent[];
};

export function fetchParentDashboard() {
  return request<ParentDashboard>(API_ENDPOINTS.parentDashboard);
}

export function createChildProfile(payload: {
  displayName: string;
  grade?: string | null;
}) {
  return request<{ ok: boolean; child: Child }>(API_ENDPOINTS.childProfiles, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function syncSavedPlace(payload: {
  placeType: string;
  label?: string;
  place: PlaceSearchResult;
}) {
  const coordinate = payload.place.coordinate || {
    latitude: payload.place.latitude,
    longitude: payload.place.longitude,
  };

  return request<{ ok: boolean; place: SavedPlace }>(
    API_ENDPOINTS.savedPlaces,
    {
      method: "POST",
      body: JSON.stringify({
        placeType: payload.placeType,
        label: payload.label || payload.placeType,
        title: payload.place.title,
        subtitle: payload.place.subtitle,
        coordinate,
        metadata: { sourcePlace: payload.place },
      }),
    },
  );
}

export function startChildTrip(payload: {
  childId?: string | null;
  origin: PlaceSearchResult;
  destination: PlaceSearchResult;
  routeOption: TransitRouteOption;
}) {
  return request<{ ok: boolean; trip: Trip }>(API_ENDPOINTS.childTripsStart, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendChildTripEvent(
  tripId: string,
  payload: {
    type: string;
    title: string;
    childId?: string | null;
    latitude?: number;
    longitude?: number;
    payload?: unknown;
  },
) {
  return request<{ ok: boolean; event: TripEvent }>(
    API_ENDPOINTS.childTripEvent(tripId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
