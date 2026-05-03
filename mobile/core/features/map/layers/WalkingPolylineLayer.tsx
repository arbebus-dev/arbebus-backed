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
    return (mode.includes("walk") || mode === "transfer") && points.length >= 2;
  });
}

function connectorLine(from?: Coordinate | null, to?: Coordinate | null): Coordinate[] {
  const points = cleanPolyline([from, to].filter(Boolean) as Coordinate[]);
  if (points.length !== 2) return [];

  // Do not draw long fake straight lines. Real walking geometry must come from ORS/backend.
  if (polylineLengthMeters(points) > 170) return [];

  return smoothPolyline(points);
}

function AppleWalkLine({ points, opacity = 1 }: { points: Coordinate[]; opacity?: number }) {
  if (points.length < 2) return null;

  return (
    <>
      <Polyline
        coordinates={points}
        strokeWidth={5.3}
        strokeColor={`rgba(38,45,58,${0.72 * opacity})`}
        lineDashPattern={[4, 7]}
        lineCap="round"
        lineJoin="round"
        zIndex={50}
      />
      <Polyline
        coordinates={points}
        strokeWidth={3.1}
        strokeColor={`rgba(255,255,255,${0.92 * opacity})`}
        lineDashPattern={[3, 8]}
        lineCap="round"
        lineJoin="round"
        zIndex={60}
      />
    </>
  );
}

export default function WalkingPolylineLayer({ route, userLocation }: Props) {
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
      <AppleWalkLine points={accessWalk} opacity={1} />
      <AppleWalkLine points={egressWalk} opacity={0.9} />
    </>
  );
}
