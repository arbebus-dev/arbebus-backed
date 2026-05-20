import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import React from "react";
import { Polyline } from "react-native-maps";
import type {
  Coordinate,
  TransitRouteOption,
} from "../../transit/models/transitTypes";
import {
  cleanPolyline,
  polylineLengthMeters,
  smoothPolyline,
} from "../../../utils/polylineAppleMaps";

type Props = {
  route: TransitRouteOption | null;
  userLocation?: Coordinate | null;
};

function pointFromStop(stop?: any): Coordinate | null {
  const point = stop?.coordinate || stop;
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function hasWalkStepGeometry(route: TransitRouteOption | null): boolean {
  const steps = route?.journeySteps || route?.steps || [];

  return steps.some((step: any) => {
    const mode = String(step.mode || step.type || "").toLowerCase();
    const points = cleanPolyline(step.polyline);
    if (!mode.includes("walk") && mode !== "transfer") return false;
    if (points.length < 2) return false;

    const provider = String(step.provider || step.walkingProvider || "").toLowerCase();
    const length = polylineLengthMeters(points);

    // ORS / real walking geometry usually has several points. Very short two-point
    // connectors are fine too. Long two-point fallback lines are not treated as
    // real geometry, so this layer can still draw a clear dashed walking-to-stop cue.
    return points.length >= 4 || provider.includes("ors") || length <= 220;
  });
}

function connectorLine(from?: Coordinate | null, to?: Coordinate | null): Coordinate[] {
  const points = cleanPolyline([from, to].filter(Boolean) as Coordinate[]);
  if (points.length !== 2) return [];

  // Show the first/last walking cue even if ORS did not return road geometry.
  // This is better than no guidance after selecting a bus route.
  if (polylineLengthMeters(points) > 2600) return [];

  return smoothPolyline(points);
}

export default function WalkingPolylineLayer({ route, userLocation }: Props) {
  const { theme } = useAppPreferences();
  const walkColor = theme.isLight ? "rgba(8,17,31,0.58)" : "rgba(255,255,255,0.78)";
  if (!route || !userLocation || hasWalkStepGeometry(route)) return null;

  const boardStop = pointFromStop(route.originStop);
  const destinationStop = pointFromStop(route.destinationStop);
  const destination =
    Array.isArray(route.previewPoints) && route.previewPoints.length >= 2
      ? route.previewPoints[route.previewPoints.length - 1]
      : null;

  const accessWalk = connectorLine(userLocation, boardStop);
  const egressWalk = connectorLine(destinationStop, destination);

  return (
    <>
      {accessWalk.length >= 2 ? (
        <Polyline
          coordinates={accessWalk}
          strokeWidth={3}
          strokeColor={walkColor}
          lineDashPattern={[5, 8]}
          lineCap="round"
          lineJoin="round"
          zIndex={95}
        />
      ) : null}

      {egressWalk.length >= 2 ? (
        <Polyline
          coordinates={egressWalk}
          strokeWidth={3}
          strokeColor={walkColor}
          lineDashPattern={[5, 8]}
          lineCap="round"
          lineJoin="round"
          zIndex={95}
        />
      ) : null}
    </>
  );
}
