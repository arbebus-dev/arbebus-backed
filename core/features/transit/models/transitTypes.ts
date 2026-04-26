export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type LiveBus = {
  id: string;
  number: string;
  route?: string;
  routeId?: string;
  vehicleId?: string;
  vehicleLabel?: string;
  latitude: number;
  longitude: number;
  coordinate: Coordinate;
  speedKph?: number;
  bearing?: number;
  heading?: number;
  tripStart?: string;
  delaySeconds?: number;
  directionName?: string;
  fetchedAt?: string;
};

export type Bus = LiveBus;

export type PlaceSearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  type?: "stop" | "place" | "address" | string;
  distanceMeters?: number;
  latitude?: number;
  longitude?: number;
  coordinate: Coordinate;
};

export type TransitFlowState =
  | "idle"
  | "searching"
  | "destination_selected"
  | "routes_loading"
  | "route_options"
  | "route_selected"
  | "walking_to_stop"
  | "waiting_bus"
  | "onboard"
  | "transfer"
  | "arriving"
  | "completed";

export type TransitStepType = "walk" | "bus" | "transfer" | "arrive" | "board" | "ride" | "alight";

export type TransitStopPoint = {
  id?: string;
  title: string;
  name?: string;
  latitude: number;
  longitude: number;
  coordinate: Coordinate;
  distanceMeters?: number;
};

export type TransitStep = {
  id: string;
  type: TransitStepType;
  mode?: "walk" | "bus" | "train" | "mixed" | string;
  icon?: string;
  title: string;
  subtitle?: string;
  description?: string;
  routeId?: string;
  routeNumber?: string;
  stopId?: string;
  stopName?: string;
  fromStopId?: string;
  toStopId?: string;
  fromStopName?: string;
  toStopName?: string;
  stopCount?: number;
  minutes?: number;
  durationMinutes?: number;
  distanceMeters?: number;
  departureTime?: string;
  arrivalTime?: string;
  polyline?: Coordinate[];
};

export type TransitRouteOption = {
  id: string;
  title: string;
  subtitle?: string;
  mode?: string;
  routeId?: string;
  routeLabel: string;
  routeNumbers: string[];
  totalMinutes: number;
  totalDurationMinutes: number;
  walkingMinutes: number;
  totalWalkMinutes: number;
  totalBusMinutes?: number;
  etaMinutes?: number | null;
  transfers: number;
  transfersCount: number;
  stopCount: number;
  boardStopName: string;
  alightStopName: string;
  originStop: TransitStopPoint;
  destinationStop: TransitStopPoint;
  previewPoints: Coordinate[];
  polyline: Coordinate[];
  steps: TransitStep[];
  journeySteps: TransitStep[];
  departureText?: string;
  arrivalText?: string;
  journeyMessage?: string;
  headsign?: string | null;
  liveVehicle?: {
    id?: string;
    vehicleId?: string;
    directionName?: string | null;
  } | null;
};

export type TransitPlan = {
  routes: TransitRouteOption[];
  selectedRoute?: TransitRouteOption | null;
  summary?: {
    totalDurationMinutes?: number;
    totalWalkMinutes?: number;
    totalBusMinutes?: number;
    routeLabel?: string;
    boardStopName?: string;
    alightStopName?: string;
    etaMinutes?: number | null;
    stopCount?: number;
    transfersCount?: number;
    nextStopName?: string;
    boardingState?: string;
    journeyMessage?: string;
  };
  segments?: Array<{
    stops?: Array<{
      stopName?: string;
      latitude?: number;
      longitude?: number;
    }>;
  }>;
  previewPoints?: Coordinate[];
};
