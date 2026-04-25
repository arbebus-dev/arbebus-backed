import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { KLAIPEDA_DEFAULT_LOCATION } from "../services/transitApi";
import type { Coordinate } from "../models/transitRoute";

export function useUserLocation() {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Lokacijos leidimas nesuteiktas");
        setLocation(KLAIPEDA_DEFAULT_LOCATION);
        return KLAIPEDA_DEFAULT_LOCATION;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setLocation(next);
      return next;
    } catch (locationError) {
      console.warn("Location failed", locationError);
      setError("Nepavyko gauti lokacijos");
      setLocation(KLAIPEDA_DEFAULT_LOCATION);
      return KLAIPEDA_DEFAULT_LOCATION;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let active = true;

    async function start() {
      await requestLocation();
      if (!active) return;
      try {
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 6000 },
          (position) => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        );
      } catch (watchError) {
        console.warn("Location watch failed", watchError);
      }
    }

    start();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [requestLocation]);

  return { location, isLoading, error, requestLocation };
}
