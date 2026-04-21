import * as Location from "expo-location";
import type { Coordinate } from "../../features/rideBooking/models";

export type LocationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined";

export type CurrentLocationResult = {
  coordinate: Coordinate;
  accuracy?: number | null;
};

export type LocationWatchCallback = (result: CurrentLocationResult) => void;

export const locationService = {
  async requestForegroundPermission(): Promise<LocationPermissionStatus> {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status === "granted") return "granted";
    if (status === "denied") return "denied";
    return "undetermined";
  },

  async getCurrentLocation(): Promise<CurrentLocationResult> {
    const result = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      coordinate: {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      },
      accuracy: result.coords.accuracy,
    };
  },

  async getLastKnownLocation(): Promise<CurrentLocationResult | null> {
    const result = await Location.getLastKnownPositionAsync();

    if (!result) return null;

    return {
      coordinate: {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      },
      accuracy: result.coords.accuracy,
    };
  },

  async watchLocation(callback: LocationWatchCallback) {
    return Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 5,
        mayShowUserSettingsDialog: true,
      },
      (result) => {
        callback({
          coordinate: {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude,
          },
          accuracy: result.coords.accuracy,
        });
      }
    );
  },
};