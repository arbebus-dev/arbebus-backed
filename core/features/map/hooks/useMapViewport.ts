import { useEffect, useMemo } from "react";
import type MapView from "react-native-maps";
import type { TransitPlan } from "../../../services/transit/plannerTypes";

type Coordinate = { latitude: number; longitude: number };

export function useMapViewport({
  mapRef,
  mapState,
  routeCoords,
  transitPlan,
  rideUiStatus,
}: {
  mapRef: React.RefObject<MapView | null>;
  mapState: { userCoordinate: Coordinate | null; pickupCoordinate: Coordinate | null; destinationCoordinate: Coordinate | null; };
  routeCoords: Coordinate[];
  transitPlan?: TransitPlan | null;
  rideUiStatus: string;
}) {
  const initialRegion = useMemo(() => ({ latitude: 55.7033, longitude: 21.1443, latitudeDelta: 0.12, longitudeDelta: 0.12 }), []);

  const nextStopCoordinate = useMemo(() => {
    if (!transitPlan?.summary.nextStopName) return null;
    for (const segment of transitPlan.segments || []) {
      for (const stop of segment.stops || []) {
        if (stop.stopName === transitPlan.summary.nextStopName && typeof stop.latitude === 'number' && typeof stop.longitude === 'number') {
          return { latitude: stop.latitude, longitude: stop.longitude };
        }
      }
    }
    return null;
  }, [transitPlan]);

  useEffect(() => {
    const points = transitPlan?.previewPoints?.length ? transitPlan.previewPoints : routeCoords;
    if (!mapRef.current || !points?.length) return;
    const coordinates = [
      ...(mapState.pickupCoordinate ? [mapState.pickupCoordinate] : []),
      ...points,
      ...(mapState.destinationCoordinate ? [mapState.destinationCoordinate] : []),
    ];
    if (coordinates.length < 2) return;
    mapRef.current.fitToCoordinates(coordinates, { edgePadding: { top: 180, right: 60, bottom: 360, left: 60 }, animated: true });
  }, [mapRef, mapState.destinationCoordinate, mapState.pickupCoordinate, routeCoords, transitPlan]);

  useEffect(() => {
    if (!mapRef.current || !transitPlan) return;
    if (!["journey_active", "near_stop", "board_now", "ride_in_progress", "exit_now"].includes(rideUiStatus)) return;

    const focusCoordinates = [
      ...(mapState.userCoordinate ? [mapState.userCoordinate] : []),
      ...(nextStopCoordinate ? [nextStopCoordinate] : []),
      ...(mapState.destinationCoordinate ? [mapState.destinationCoordinate] : []),
    ];

    if (focusCoordinates.length >= 2) {
      mapRef.current.fitToCoordinates(focusCoordinates, { edgePadding: { top: 180, right: 80, bottom: 320, left: 80 }, animated: true });
      return;
    }

    const target = nextStopCoordinate || mapState.destinationCoordinate || mapState.userCoordinate;
    if (target) {
      mapRef.current.animateCamera({ center: target, zoom: 15.5 }, { duration: 700 });
    }
  }, [mapRef, mapState.destinationCoordinate, mapState.userCoordinate, nextStopCoordinate, rideUiStatus, transitPlan]);

  return { initialRegion };
}
