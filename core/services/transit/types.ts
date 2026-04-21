export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type TransitStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  routes: string[];
};

export type TransitLegWalk = {
  type: "walk";
  fromLabel: string;
  toLabel: string;
  from: Coordinate;
  to: Coordinate;
  distanceMeters: number;
  durationMinutes: number;
};

export type TransitLegBus = {
  type: "bus";
  routeId: string;
  routeLabel: string;
  fromStopId: string;
  fromStopName: string;
  toStopId: string;
  toStopName: string;
  stopCount: number;
  durationMinutes: number;
  etaMinutes: number | null;
};

export type TransitJourneyLeg = TransitLegWalk | TransitLegBus;

export type TransitJourney = {
  mode: "bus";
  summary: {
    totalDurationMinutes: number;
    totalWalkMinutes: number;
    totalBusMinutes: number;
    boardStopName: string;
    alightStopName: string;
    routeLabel: string;
    etaMinutes: number | null;
  };
  legs: TransitJourneyLeg[];
};

export type PlannerInput = {
  origin: Coordinate;
  destination: Coordinate;
  stops: TransitStop[];
  maxOriginWalkMeters?: number;
  maxDestinationWalkMeters?: number;
  walkingSpeedMetersPerMinute?: number;
};