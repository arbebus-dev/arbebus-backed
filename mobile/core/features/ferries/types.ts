export type FerryTerminal = {
  id: string;
  name: string;
  shortName?: string;
  address?: string;
  latitude: number;
  longitude: number;
};

export type FerryRoute = {
  id: string;
  routeCode: string;
  title: string;
  from: FerryTerminal;
  to: FerryTerminal;
  via?: string[];
  durationMinutes: number;
  operator: string;
  serviceType: "passenger_ferry" | "seasonal_passenger_boat" | string;
  sourceName?: string;
  sourceUrl?: string;
  sourceNote?: string;
  season?: { from: string; to: string } | null;
  activeNow?: boolean;
  departures?: string[];
  schedule?: string[];
  polyline?: { latitude: number; longitude: number }[];
};

export type FerryDeparture = {
  routeId: string;
  routeCode: string;
  title: string;
  from: FerryTerminal;
  to: FerryTerminal;
  via?: string[];
  departureTime: string;
  departureAt: string;
  arrivalAt: string;
  minutesUntil: number;
  durationMinutes: number;
  operator: string;
  serviceType: string;
  activeNow?: boolean;
  sourceName?: string;
  sourceUrl?: string;
  sourceNote?: string;
};

export type FerryOverview = {
  ok: boolean;
  module?: string;
  updatedAt?: string;
  routes: FerryRoute[];
  terminals: FerryTerminal[];
  nextDepartures: FerryDeparture[];
};


export type LiveFerry = {
  id: string;
  routeId: string;
  routeCode?: string;
  title: string;
  pierType?: "old" | "new" | "nida" | string;
  pierName?: string;
  ferryLine?: string;
  from: FerryTerminal;
  to: FerryTerminal;
  via?: string[];
  latitude: number;
  longitude: number;
  coordinate?: { latitude: number; longitude: number };
  heading?: number;
  bearing?: number;
  progress?: number;
  status: "sailing" | "docked" | string;
  departureTime?: string | null;
  departureAt?: string | null;
  arrivalAt?: string | null;
  minutesUntilDeparture?: number | null;
  minutesUntilArrival?: number | null;
  durationMinutes?: number;
  operator?: string;
  serviceType?: string;
  source?: string;
  isRealtime?: boolean;
  timeZone?: string;
  updatedAt?: string;
};
