import type { TransitFlowState } from "./transitFlowState";

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type TransitStop = {
  id: string;
  title: string;
  coordinate: Coordinate;
  distanceMeters?: number;
  subtitle?: string;
};

export type LiveBus = {
  id: string;
  routeNumber: string;
  coordinate: Coordinate;
  bearing?: number;
  title?: string;
  updatedAt?: string;
};

export type TransitStepType = "walk" | "bus" | "transfer" | "arrive";

export type TransitStep = {
  id: string;
  type: TransitStepType;
  title: string;
  description?: string;
  routeNumber?: string;
  fromStopName?: string;
  toStopName?: string;
  stopCount?: number;
  durationMinutes?: number;
  departureTime?: string;
  arrivalTime?: string;
  polyline?: Coordinate[];
};

export type TransitRouteOption = {
  id: string;
  title: string;
  subtitle?: string;
  totalMinutes: number;
  walkingMinutes: number;
  transfers: number;
  routeNumbers: string[];
  polyline: Coordinate[];
  steps: TransitStep[];
};

export type TransitPlan = {
  origin: Coordinate;
  destination: Coordinate;
  destinationLabel: string;
  selectedRouteId: string;
  routes: TransitRouteOption[];
};

export type TransitPlannerSnapshot = {
  flowState: TransitFlowState;
  query: string;
  results: TransitStop[];
  selectedDestination: TransitStop | null;
  plan: TransitPlan | null;
  selectedRouteId: string | null;
  selectedRoute: TransitRouteOption | null;
  activeStepIndex: number;
  activeStep: TransitStep | null;
  isSearching: boolean;
  isPlanning: boolean;
  error: string | null;
};
