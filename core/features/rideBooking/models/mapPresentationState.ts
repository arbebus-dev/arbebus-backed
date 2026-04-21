// core/features/rideBooking/models/mapPresentationState.ts
import type { Coordinate } from "./place";

export type MapPresentationState = {
  userCoordinate: Coordinate | null;
  pickupCoordinate: Coordinate | null;
  destinationCoordinate: Coordinate | null;
  driverCoordinate: Coordinate | null;
};