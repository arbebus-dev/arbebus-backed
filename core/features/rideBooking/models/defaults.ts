import type { MapPresentationState, RideDraft } from "./index";

export const emptyRideDraft: RideDraft = {
  pickup: undefined,
  destination: undefined,
  route: undefined,
  selectedProduct: undefined,
};

export const emptyMapPresentationState: MapPresentationState = {
  userCoordinate: undefined,
  pickupCoordinate: undefined,
  destinationCoordinate: undefined,
  routePolyline: [],
};