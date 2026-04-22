import { API_BASE } from "../../../constants/api";
import type {
  Coordinate,
  TransitPlan,
  TransitPlannerMeta,
  TransitPlannerResponse,
} from "./plannerTypes";

export async function fetchTransitPlanFromApi({
  origin,
  destination,
  userLocation,
  serviceDate,
}: {
  origin: Coordinate;
  destination: Coordinate;
  userLocation?: Coordinate | null;
  serviceDate?: string;
}): Promise<{ plan: TransitPlan | null; options: TransitPlan[]; meta?: TransitPlannerMeta }> {
  try {
    const response = await fetch(`${API_BASE}/transit/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
        destination: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
        userLocation: userLocation
          ? {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }
          : null,
        serviceDate,
      }),
    });

    let data: TransitPlannerResponse | null = null;

    try {
      data = (await response.json()) as TransitPlannerResponse;
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.log("fetchTransitPlanFromApi HTTP error:", response.status, data);
      return {
        plan: null,
        options: [],
        meta: data?.meta || { reason: "HTTP_ERROR" },
      };
    }

    const normalizedOptions = Array.isArray(data?.options)
      ? data.options
      : data?.plan
      ? [data.plan]
      : [];

    return {
      plan: data?.plan || normalizedOptions[0] || null,
      options: normalizedOptions,
      meta: data?.meta,
    };
  } catch (error) {
    console.log("fetchTransitPlanFromApi error:", error);
    return { plan: null, options: [], meta: { reason: "FETCH_ERROR" } };
  }
}
