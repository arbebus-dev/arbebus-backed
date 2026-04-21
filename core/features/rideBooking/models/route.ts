// core/features/rideBooking/models/route.ts
import type { Coordinate } from "./place";

export type Route = {
  polyline: Coordinate[];
};