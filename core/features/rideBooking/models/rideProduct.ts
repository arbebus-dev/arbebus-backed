// core/features/rideBooking/models/rideProduct.ts
export type RideProduct = {
  id: string;
  name: string;
  etaMinutes: number;
  estimatedPrice: number;
  capacity: number;
};