
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import type { WeatherNow } from "../types/home";

type Coordinate = {
  latitude: number;
  longitude: number;
};

export function useWeather() {
  const [weatherNow, setWeatherNow] = useState<WeatherNow | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastWeatherFetchAtRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    const fetchWeather = async (lat: number, lon: number) => {
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

        if (!isMounted) return;

        setWeatherNow({
          temperature: Math.round(instant?.air_temperature ?? 0),
          windSpeed: instant?.wind_speed,
          symbolCode: symbolCode ?? "partlycloudy_day",
        });
      } catch (error) {
        console.log("weather error", error);
      }
    };

    const init = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          const coords = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          };

          setUserLocation(coords);
          void fetchWeather(coords.latitude, coords.longitude);
        }

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            if (!isMounted) return;

            const coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };

            setUserLocation(coords);
            void fetchWeather(coords.latitude, coords.longitude);
          }
        );
      } catch (error) {
        console.log("useWeather init error", error);
      }
    };

    void init();

    return () => {
      isMounted = false;

      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, []);

  return {
    weatherNow,
    userLocation,
  };
}