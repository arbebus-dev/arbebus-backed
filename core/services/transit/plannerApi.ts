import { API_BASE } from "../../../constants/api";
import type {
  Coordinate,
  TransitPlan,
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
}): Promise<{ plan: TransitPlan | null; options: TransitPlan[] }> {
  try {
    const response = await fetch(`${API_BASE}/transit/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin,
        destination,
        userLocation,
        serviceDate,
      }),
    });

    if (!response.ok) {
      return { plan: null, options: [] };
    }

    const data = (await response.json()) as TransitPlannerResponse;

    return {
      plan: data?.plan || null,
      options: Array.isArray(data?.options) ? data.options : [],
    };
  } catch (error) {
    console.log("fetchTransitPlanFromApi error:", error);
    return { plan: null, options: [] };
  }
}
