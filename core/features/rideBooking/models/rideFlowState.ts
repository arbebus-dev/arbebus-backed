// core/features/rideBooking/models/rideFlowState.ts
export type RideFlowState =
  | "idle"
  | "searching"
  | "loadingRoute"
  | "routePreview"
  | "confirmRide"
  | "rideStarted";