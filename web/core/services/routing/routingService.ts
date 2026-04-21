import { Route } from "../../features/rideBooking/models/route";

const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || "";

type ORSGeoJsonResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: number[][];
    };
    properties?: {
      summary?: {
        distance?: number;
        duration?: number;
      };
    };
  }>;
};

export const routingService = {
  async getRoute(
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number },
    profile: "driving-car" | "foot-walking" = "driving-car"
  ): Promise<Route> {
    if (!ORS_API_KEY) {
      throw new Error("Missing ORS API key");
    }

    const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json, application/geo+json",
      },
      body: JSON.stringify({
        coordinates: [
          [start.longitude, start.latitude],
          [end.longitude, end.latitude],
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Routing failed: ${response.status} ${text}`);
    }

    const data: ORSGeoJsonResponse = await response.json();
    const coords = data.features?.[0]?.geometry?.coordinates ?? [];

    if (!coords.length) {
      throw new Error("Routing returned empty geometry");
    }

    return {
      polyline: coords.map((c) => ({
        latitude: c[1],
        longitude: c[0],
      })),
    };
  },
};