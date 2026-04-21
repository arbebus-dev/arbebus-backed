import { useEffect, useRef } from "react";
import MapView from "react-native-maps";
import { LiveBus } from "../types/home";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type UseRideStatusEffectsParams = {
  rideStatus: string;
  etaBadgeText?: string | null;
  driverInfo: any;
  mapRef: React.RefObject<MapView | null>;
  driverCoordinate?: Coordinate | null;
  pickupCoordinate?: Coordinate | null;
  destinationCoordinate?: Coordinate | null;
  selectedBus: LiveBus | null;
  isPro: boolean;
  leaveAlertEnabled: boolean;
  notificationsReady: boolean;
  leaveNotificationIdRef: React.MutableRefObject<string | null>;
  setLiveEtaSeconds: React.Dispatch<React.SetStateAction<number | null>>;
  setShowRideSummary: (value: boolean) => void;
};

function isValidCoordinate(value: any): value is Coordinate {
  return (
    value &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

export function useRideStatusEffects({
  rideStatus,
  etaBadgeText,
  driverInfo,
  mapRef,
  driverCoordinate,
  pickupCoordinate,
  destinationCoordinate,
  selectedBus,
  isPro,
  leaveAlertEnabled,
  notificationsReady,
  leaveNotificationIdRef,
  setLiveEtaSeconds,
  setShowRideSummary,
}: UseRideStatusEffectsParams) {
  const lastDriverCameraUpdateRef = useRef(0);
  const lastArrivalFitRef = useRef<string | null>(null);

  useEffect(() => {
    if (rideStatus === "ride_completed") {
      setShowRideSummary(true);
    }
  }, [rideStatus, setShowRideSummary]);

  useEffect(() => {
    const shouldFollowDriver =
      rideStatus === "driver_arriving" || rideStatus === "ride_started";

    if (!mapRef.current || !driverCoordinate || !shouldFollowDriver) return;

    const now = Date.now();

    if (now - lastDriverCameraUpdateRef.current < 1400) {
      return;
    }

    lastDriverCameraUpdateRef.current = now;

    try {
      mapRef.current.animateToRegion(
        {
          latitude: driverCoordinate.latitude,
          longitude: driverCoordinate.longitude,
          latitudeDelta: rideStatus === "ride_started" ? 0.02 : 0.028,
          longitudeDelta: rideStatus === "ride_started" ? 0.02 : 0.028,
        },
        950
      );
    } catch {}
  }, [driverCoordinate, mapRef, rideStatus]);

  useEffect(() => {
    const shouldFitArrivalRoute =
      rideStatus === "driver_arrived" || rideStatus === "driver_assigned";

    if (!mapRef.current || !shouldFitArrivalRoute) return;

    const coords = [pickupCoordinate, destinationCoordinate].filter(
      isValidCoordinate
    ) as Coordinate[];

    if (coords.length < 2) return;

    const signature = coords
      .map((point) => `${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}`)
      .join("|");

    if (lastArrivalFitRef.current === `${rideStatus}:${signature}`) {
      return;
    }

    lastArrivalFitRef.current = `${rideStatus}:${signature}`;

    const timer = setTimeout(() => {
      try {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: {
            top: 180,
            right: 64,
            bottom: 420,
            left: 64,
          },
          animated: true,
        });
      } catch {}
    }, rideStatus === "driver_arrived" ? 120 : 240);

    return () => clearTimeout(timer);
  }, [destinationCoordinate, mapRef, pickupCoordinate, rideStatus]);

  useEffect(() => {
    const shouldRunCountdown =
      rideStatus === "driver_assigned" || rideStatus === "driver_arriving";

    if (!shouldRunCountdown) {
      setLiveEtaSeconds(null);
      return;
    }

    const parsedMinutes =
      typeof etaBadgeText === "string"
        ? Number.parseInt(etaBadgeText.replace(/[^\d]/g, ""), 10)
        : NaN;

    const fallbackMinutes = Number.isFinite(parsedMinutes)
      ? parsedMinutes
      : null;

    if (fallbackMinutes == null) {
      setLiveEtaSeconds(null);
      return;
    }

    setLiveEtaSeconds((prev) => {
      if (prev != null) return prev;
      return Math.max(0, fallbackMinutes * 60);
    });

    const interval = setInterval(() => {
      setLiveEtaSeconds((prev) => {
        if (prev == null) return prev;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rideStatus, etaBadgeText, driverInfo, setLiveEtaSeconds]);

  useEffect(() => {
    if (
      rideStatus === "driver_arrived" ||
      rideStatus === "ride_started" ||
      rideStatus === "ride_completed" ||
      rideStatus === "idle"
    ) {
      setLiveEtaSeconds(null);
    }
  }, [rideStatus, setLiveEtaSeconds]);

  // Leave alert schedulinimas dabar pilnai valdomas per useLeaveAlert / useLeaveAlerts hook.
  // Čia sąmoningai nebeschedule'inam papildomo local notification, kad nebūtų double alertų.
}