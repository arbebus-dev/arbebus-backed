import { getDistanceMeters } from "./geo";
import type { Coordinate, TransitStop } from "./types";

export type NearbyStop = TransitStop & {
  distanceMeters: number;
};

export function getNearbyStops(
  point: Coordinate,
  stops: TransitStop[],
  maxDistanceMeters: number,
  limit = 5
): NearbyStop[] {
  return stops
    .map((stop) => ({
      ...stop,
      distanceMeters: getDistanceMeters(point, {
        latitude: stop.latitude,
        longitude: stop.longitude,
      }),
    }))
    .filter((stop) => stop.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}