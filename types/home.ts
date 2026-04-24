// types/home.ts

export type TravelMode =
  | "smart"
  | "taxi"
  | "bus"
  | "walk"
  | "train"
  | "airport";

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type BusAnimationEntry = {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  rotation: number;
  targetCoordinate?: {
    latitude: number;
    longitude: number;
  };
  targetRotation?: number;
  startedAt?: number;
  durationMs?: number;
};

export type LiveBus = {
  id: string;

  // pagrindinis numeris (pvz. "8", "17A")
  number: string;

  // kryptis (pvz. "Centras", "Universitetas")
  directionName?: string;

  // dabartinė lokacija
  coordinate: Coordinate;

  // heading kampas (optional animacijai)
  heading?: number;

  // vėlavimas sekundėmis (gali būti 0)
  delaySeconds: number;

  // timestamp (optional backend debug)
  timestamp?: number;

  // papildomi laukai jei backend duoda
  [key: string]: any;
};

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type Recommendation = {
  id: string;

  mode: TravelMode;

  title: string;
  subtitle?: string;
  description?: string;

  etaLabel?: string;
  price?: string;

  icon?: string;
  accent?: string;

  // pvz. right icons UI (optional)
  rightIcons?: string[];
};

export type SmartRouteResult = {
  recommendations: Recommendation[];

  bestRecommendationId: string;

  routeCoords: RouteCoordinate[];

  eta: number | null;
};

export type BottomSheetSnapPoint =
  | "closed"
  | "mid"
  | "open";

export type HomeState = {
  selectedMode: TravelMode;

  selectedBus: LiveBus | null;

  destination: string;

  eta: number | null;

  isPro: boolean;
};

export type DriverState = {
  coordinate: Coordinate | null;
  heading: number;
  etaSeconds: number | null;
};

export type RideStatus =
  | "idle"
  | "searching"
  | "driver_assigned"
  | "driver_arriving"
  | "driver_arrived"
  | "ride_started"
  | "ride_completed";

export type WeatherNow = {
  temperature: number;
  windSpeed?: number;
  symbolCode?: string;
};