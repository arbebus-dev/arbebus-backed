// core/features/rideBooking/models/rideDraft.ts
import type { Place } from "./place";
import type { Route } from "./route";

export type RideDraft = {
  pickup: Place | null;
  destination: Place | null;
  selectedProductId: string | null;
  route: Route | null;
};