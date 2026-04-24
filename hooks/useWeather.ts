import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WeatherNow } from "../types/home";

type Coordinate = {
  latitude: number;
  longitude: number;
};

export function useWeather() {
  const [weatherNow, setWeatherNow] = useState<WeatherNow | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastWeatherFetchAtRef = useRef<number>(0);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    const now = Date.now();

    if (now - lastWeatherFetchAtRef.current < 60_000) {
      return;
    }

    lastWeatherFetchAtRef.current = now;

    try {
      const res = await fetch(
        `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
        {
          headers: {
            "User-Agent": "Arbebus/1.0",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Weather HTTP ${res.status}`);
      }

      const data = await res.json();
      const instant = data?.properties?.timeseries?.[0]?.data?.instant?.details;
      const symbolCode =
        data?.properties?.timeseries?.[0]?.data?.next_1_hours?.summary?.symbol_code;

      setWeatherNow({
        temperature: Math.round(instant?.air_temperature ?? 0),
        windSpeed: instant?.wind_speed,
        symbolCode: symbolCode ?? "partlycloudy_day",
      });
    } catch (error) {
      console.log("weather error", error);
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
  }, []);

  const hydrateLastKnownLocation = useCallback(async () => {
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.status !== "granted") return;

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (!lastKnown) return;

      const coords = {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };

      setUserLocation(coords);
      void fetchWeather(coords.latitude, coords.longitude);
    } catch (error) {
      console.log("hydrateLastKnownLocation error", error);
    }
  }, [fetchWeather]);

  const requestLocation = useCallback(async () => {
    try {
      setIsRequestingLocation(true);

      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;

      if (status !== "granted") {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }

      if (status !== "granted") {
        return null;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };

      setUserLocation(coords);
      void fetchWeather(coords.latitude, coords.longitude);

      stopWatching();
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 4000,
          distanceInterval: 10,
        },
        (loc) => {
          const nextCoords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          setUserLocation(nextCoords);
          void fetchWeather(nextCoords.latitude, nextCoords.longitude);
        }
      );

      return coords;
    } catch (error) {
      console.log("useWeather requestLocation error", error);
      return null;
    } finally {
      setIsRequestingLocation(false);
    }
  }, [fetchWeather, stopWatching]);

  useEffect(() => {
    void hydrateLastKnownLocation();

    return () => {
      stopWatching();
    };
  }, [hydrateLastKnownLocation, stopWatching]);

  return {
    weatherNow,
    userLocation,
    isRequestingLocation,
    requestLocation,
  };
}
