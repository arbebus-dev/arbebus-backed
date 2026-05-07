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

export type PlacePhoto = {
  name?: string;
  url?: string;
  widthPx?: number;
  heightPx?: number;
};

export type PlaceSearchResult = {
  id: string;
  title: string;
  name?: string;
  subtitle?: string;
  type?: "stop" | "poi" | "place" | "address" | "city" | "region" | string;
  source?: "gtfs" | "seed" | "poi" | "ors" | "google_places" | string;
  distanceMeters?: number;
  latitude?: number;
  longitude?: number;
  coordinate: Coordinate;
  placeId?: string;
  googlePlaceId?: string;
  category?: string | null;
  rating?: number;
  userRatingCount?: number;
  openNow?: boolean | null;
  openNowText?: string | null;
  openingHours?: string[];
  photos?: PlacePhoto[];
  photoUrls?: string[];
  phone?: string;
  website?: string;
  googleMapsUri?: string;
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

export type TransitStepType =
  | "walk"
  | "bus"
  | "ferry"
  | "train"
  | "bolt"
  | "transfer"
  | "arrive"
  | "board"
  | "ride"
  | "alight";

export type TransitStopPoint = {
  id?: string;
  stopId?: string;
  title?: string;
  name?: string;
  stopName?: string;
  stopSequence?: number;
  latitude: number;
  longitude: number;
  coordinate?: Coordinate;
  distanceMeters?: number;
  arrivalSeconds?: number;
  departureSeconds?: number;
};

export type TransitStep = {
  id: string;
  type: TransitStepType;
  legIndex?: number;
  sequenceIndex?: number;
  mode?: "walk" | "bus" | "ferry" | "train" | "bolt" | "mixed" | string;
  icon?: string;
  title: string;
  subtitle?: string;
  description?: string;
  routeId?: string;
  routeNumber?: string;
  routeLabel?: string;
  transferFromRoute?: string;
  transferToRoute?: string;
  transferWaitMinutes?: number;
  stopId?: string;
  stopName?: string;
  fromStopId?: string;
  toStopId?: string;
  fromStopName?: string;
  toStopName?: string;
  stopCount?: number;
  stops?: TransitStopPoint[];
  rideStops?: TransitStopPoint[];
  routeStops?: TransitStopPoint[];
  minutes?: number;
  durationMinutes?: number;
  distanceMeters?: number;
  departureTime?: string;
  arrivalTime?: string;
  platform?: string;
  headsign?: string | null;
  polyline?: Coordinate[];
};

export type TransitLiveEta = {
  etaSeconds?: number;
  etaMinutes?: number;
  distanceMeters?: number | null;
};

export type TransitRouteLeg = {
  id?: string;
  type?: TransitStepType | string;
  mode?: "walk" | "bus" | "ferry" | "train" | "bolt" | "mixed" | string;
  routeId?: string;
  routeNumber?: string;
  routeLabel?: string;
  fromStopName?: string;
  toStopName?: string;
  fromStop?: TransitStopPoint;
  toStop?: TransitStopPoint;
  stops?: TransitStopPoint[];
  durationMinutes?: number;
  stopCount?: number;
  polyline?: Coordinate[];
};

export type TransitRouteOption = {
  id: string;
  title: string;
  subtitle?: string;
  mode?: string;
  routeId?: string;
  shapeId?: string | null;
  routeLabel: string;
  routeNumbers: string[];
  legs?: TransitRouteLeg[];
  transferStops?: TransitStopPoint[];
  transferMessages?: string[];
  totalMinutes: number;
  totalDurationMinutes: number;
  walkingMinutes: number;
  totalWalkMinutes: number;
  totalBusMinutes?: number;
  etaMinutes?: number | null;
  liveEta?: TransitLiveEta | null;
  boardingState?: string | null;
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
    vehicleLabel?: string;
    routeId?: string;
    route?: string;
    latitude?: number;
    longitude?: number;
    heading?: number;
    speedKph?: number;
    directionName?: string | null;
    delaySeconds?: number;
    fetchedAt?: string;
  } | null;
  summary?: any;
};

export type TransitPlan = {
  routes: TransitRouteOption[];
  selectedRoute?: TransitRouteOption | null;
  summary?: {
    totalDurationMinutes?: number;
    totalWalkMinutes?: number;
    totalBusMinutes?: number;
    routeLabel?: string;
    shapeId?: string | null;
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
    stops?: TransitStopPoint[];
  }>;
  previewPoints?: Coordinate[];
};