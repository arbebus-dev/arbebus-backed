// core/features/rideBooking/models/place.ts
export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type Place = {
  id: string;
  title: string;
  subtitle?: string;
  coordinate: Coordinate;
};