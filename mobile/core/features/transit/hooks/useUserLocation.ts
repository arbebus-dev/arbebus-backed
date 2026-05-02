import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Coordinate } from "../models/transitTypes";

const KLAIPEDA: Coordinate = { latitude: 55.7033, longitude: 21.1443 };

export function useUserLocation() {
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isLocating, setIsLocating] = useState(true);
  const mountedRef = useRef(true);

  const refreshLocation = useCallback(async () => {
    try {
      setIsLocating(true);

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        if (!mountedRef.current) return;
        setPermissionDenied(true);
        setUserLocation((prev) => prev ?? KLAIPEDA);
        return;
      }

      if (!mountedRef.current) return;
      setPermissionDenied(false);

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!mountedRef.current) return;
      setUserLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (error) {
      console.log("useUserLocation error:", error);
      if (mountedRef.current) setUserLocation((prev) => prev ?? KLAIPEDA);
    } finally {
      if (mountedRef.current) setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let subscription: Location.LocationSubscription | null = null;

    async function start() {
      await refreshLocation();

      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== "granted") return;

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (next) => {
            if (!mountedRef.current) return;
            setUserLocation({
              latitude: next.coords.latitude,
              longitude: next.coords.longitude,
            });
          }
        );
      } catch (error) {
        console.log("watchPosition error:", error);
      }
    }

    void start();

    return () => {
      mountedRef.current = false;
      subscription?.remove();
    };
  }, [refreshLocation]);

  return {
    userLocation,
    permissionDenied,
    isLocating,
    refreshLocation,
  };
}
