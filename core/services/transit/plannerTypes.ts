export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type TransitStopTimelineItem = {
  stopId: string;
  stopName: string;
  sequence?: number;
  latitude?: number;
  longitude?: number;
  arrivalTime?: string | null;
  departureTime?: string | null;
  isBoardStop?: boolean;
  isAlightStop?: boolean;
};

export type TransitJourneyStep = {
  icon?: string;
  title: string;
  subtitle?: string;
  type?: string;
  instruction?: string;
  mode?: "bus" | "train" | "walk" | "transfer";
  stopId?: string;
  stopName?: string;
  routeId?: string;
  routeLabel?: string;
  fromStopId?: string;
  toStopId?: string;
  stopCount?: number;
  departureTime?: string;
  arrivalTime?: string;
  stops?: TransitStopTimelineItem[];
};

export type TransitNearbyStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
};

export type TransitAlertSignal = {
  type: string;
  title: string;
  message: string;
  severity?: "info" | "warning" | "critical";
};

export type TransitSegment = {
  id: string;
  type: "walk" | "ride";
  mode: "bus" | "train" | "walk";
  label?: string;
  fromName?: string;
  toName?: string;
  durationMinutes?: number | null;
  stopCount?: number;
  departureTime?: string | null;
  arrivalTime?: string | null;
  points: Coordinate[];
  stops?: TransitStopTimelineItem[];
};

export type TransitPlan = {
  id?: string;
  mode: "bus" | "train" | "mixed";
  routeId: string;
  summary: {
    totalDurationMinutes: number;
    totalWalkMinutes: number;
    totalBusMinutes: number;
    boardStopName: string;
    alightStopName: string;
    routeLabel: string;
    etaMinutes: number | null;
    stopCount: number;
    transfersCount?: number;
    directionCode?: string | null;
    headsign?: string | null;
    boardingState?: string | null;
    nextStopName?: string | null;
    journeyMessage?: string | null;
    missedStop?: boolean;
    approximateStopsRemaining?: number;
    alertSignals?: TransitAlertSignal[];
    modes?: Array<"bus" | "train">;
  };
  originStop: TransitNearbyStop;
  destinationStop: TransitNearbyStop;
  previewPoints: Coordinate[];
  segments?: TransitSegment[];
  journeySteps?: TransitJourneyStep[];
  liveVehicle?: {
    vehicleId?: string;
    id?: string;
    directionName?: string;
  } | null;
};

export type TransitPlannerMeta = {
  serviceDate?: string;
  departureSeconds?: number;
  reason?: string;
  nearbyOriginStops?: TransitNearbyStop[];
  nearbyDestinationStops?: TransitNearbyStop[];
  searchProfile?: {
    originRadius?: number;
    destinationRadius?: number;
    stopLimit?: number;
    transferRadius?: number;
    maxTransfers?: number;
  };
};

export type TransitPlannerResponse = {
  ok: boolean;
  plan: TransitPlan | null;
  options: TransitPlan[];
  meta?: TransitPlannerMeta;
  error?: string;
};
