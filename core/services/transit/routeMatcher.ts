import type { NearbyStop } from "./stopService";
import type { TransitStop } from "./types";

export type DirectRouteMatch = {
  routeId: string;
  originStop: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
    routes: string[];
  };
  destinationStop: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    distanceMeters: number;
    routes: string[];
  };
};

function normalizeRouteId(routeId: string) {
  return String(routeId || "").trim().toUpperCase();
}

function getSharedRouteId(
  originStop: TransitStop,
  destinationStop: TransitStop
): string | null {
  const originRoutes = Array.isArray(originStop.routes)
    ? originStop.routes.map(normalizeRouteId).filter(Boolean)
    : [];

  const destinationRoutes = new Set(
    Array.isArray(destinationStop.routes)
      ? destinationStop.routes.map(normalizeRouteId).filter(Boolean)
      : []
  );

  for (const routeId of originRoutes) {
    if (destinationRoutes.has(routeId)) {
      return routeId;
    }
  }

  return null;
}

export function findDirectRouteMatch(
  originStops: NearbyStop[],
  destinationStops: NearbyStop[]
): DirectRouteMatch | null {
  if (!originStops.length || !destinationStops.length) {
    return null;
  }

  let bestMatch: DirectRouteMatch | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const originStop of originStops) {
    for (const destinationStop of destinationStops) {
      if (originStop.id === destinationStop.id) {
        continue;
      }

      const sharedRouteId = getSharedRouteId(originStop, destinationStop);
      if (!sharedRouteId) {
        continue;
      }

      const score =
        Number(originStop.distanceMeters || 0) +
        Number(destinationStop.distanceMeters || 0);

      if (score < bestScore) {
        bestScore = score;
        bestMatch = {
          routeId: sharedRouteId,
          originStop: {
            id: originStop.id,
            name: originStop.name,
            latitude: originStop.latitude,
            longitude: originStop.longitude,
            distanceMeters: originStop.distanceMeters,
            routes: originStop.routes || [],
          },
          destinationStop: {
            id: destinationStop.id,
            name: destinationStop.name,
            latitude: destinationStop.latitude,
            longitude: destinationStop.longitude,
            distanceMeters: destinationStop.distanceMeters,
            routes: destinationStop.routes || [],
          },
        };
      }
    }
  }

  return bestMatch;
}