export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type TransitStop = {
  id: string;
  name: string;
  location: GeoPoint;
};

export type TransitRoute = {
  id: string;
  shortName: string;
  longName?: string;
};
