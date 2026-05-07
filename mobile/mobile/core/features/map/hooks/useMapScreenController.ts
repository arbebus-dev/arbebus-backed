import { useMemo } from "react";
import type { Coordinate, TransitFlowState, TransitRouteOption } from "../../transit/models/transitTypes";

type Params = {
  userLocation: Coordinate | null;
  flowState: TransitFlowState;
  selectedRoute: TransitRouteOption | null;
  selectedDestination?: { coordinate: Coordinate } | null;
};

export function useMapScreenController({ userLocation, flowState, selectedRoute, selectedDestination }: Params) {
  const focusCoordinates = useMemo(() => {
    const points: Coordinate[] = [];
    if (userLocation) points.push(userLocation);
    if (selectedDestination?.coordinate) points.push(selectedDestination.coordinate);
    if (selectedRoute?.previewPoints?.length) points.push(...selectedRoute.previewPoints);
    return points;
  }, [selectedDestination, selectedRoute, userLocation]);

  const isJourneyActive = ["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving"].includes(flowState);
  const ctaLabel =
    flowState === "waiting_bus"
      ? "Lauk autobuso"
      : flowState === "onboard"
        ? "Važiuok"
        : flowState === "arriving"
          ? "Išlipk dabar"
          : isJourneyActive
            ? "Tęsti kelionę"
            : "Kur važiuojam?";

  return { focusCoordinates, isJourneyActive, ctaLabel };
}
