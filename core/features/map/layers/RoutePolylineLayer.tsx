import React, { useMemo } from "react";
import { Polyline } from "react-native-maps";
import type {
  Coordinate,
  TransitFlowState,
  TransitRouteOption,
} from "../../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption | null;
  flowState?: TransitFlowState;
  currentStepIndex?: number;
};

function isValidPoint(point: any) {
  return (
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

function getRoutePoints(route: TransitRouteOption | null): Coordinate[] {
  if (!route) return [];

  const polyline = Array.isArray(route.polyline)
    ? (route.polyline.filter(isValidPoint) as Coordinate[])
    : [];

  if (polyline.length >= 2) return polyline;

  const previewPoints = Array.isArray(route.previewPoints)
    ? (route.previewPoints.filter(isValidPoint) as Coordinate[])
    : [];

  if (previewPoints.length >= 2) return previewPoints;

  return [];
}

function getStepBasedSegment(
  points: Coordinate[],
  route: TransitRouteOption | null,
  flowState?: TransitFlowState,
  currentStepIndex?: number
) {
  if (points.length < 2) return [];

  const steps = route?.journeySteps || route?.steps || [];
  const safeIndex = Math.max(0, Number(currentStepIndex || 0));
  const totalSteps = Math.max(1, steps.length);

  const step = steps[safeIndex];

  if (step?.polyline && step.polyline.length >= 2) {
    return step.polyline.filter(isValidPoint) as Coordinate[];
  }

  if (flowState === "route_options" || flowState === "route_selected") {
    const end = Math.max(2, Math.floor(points.length * 0.28));
    return points.slice(0, end);
  }

  if (flowState === "walking_to_stop" || flowState === "waiting_bus") {
    const end = Math.max(2, Math.floor(points.length * 0.22));
    return points.slice(0, end);
  }

  if (flowState === "arriving") {
    const start = Math.max(0, Math.floor(points.length * 0.72));
    return points.slice(start);
  }

  if (flowState === "onboard" || flowState === "transfer") {
    const progressStart = safeIndex / totalSteps;
    const progressEnd = Math.min(1, (safeIndex + 2) / totalSteps);

    const start = Math.max(0, Math.floor(points.length * progressStart));
    const end = Math.max(start + 2, Math.floor(points.length * progressEnd));

    return points.slice(start, Math.min(points.length, end));
  }

  return points;
}

export default function RoutePolylineLayer({
  route,
  flowState,
  currentStepIndex,
}: Props) {
  const points = useMemo(() => getRoutePoints(route), [route]);

  const activePoints = useMemo(() => {
    return getStepBasedSegment(points, route, flowState, currentStepIndex);
  }, [points, route, flowState, currentStepIndex]);

  if (points.length < 2) return null;

  return (
    <>
      <Polyline
        coordinates={points}
        strokeWidth={14}
        strokeColor="rgba(53,242,180,0.12)"
        lineCap="round"
        lineJoin="round"
      />

      <Polyline
        coordinates={points}
        strokeWidth={7}
        strokeColor="rgba(53,242,180,0.34)"
        lineCap="round"
        lineJoin="round"
      />

      {activePoints.length >= 2 ? (
        <>
          <Polyline
            coordinates={activePoints}
            strokeWidth={13}
            strokeColor="rgba(255,255,255,0.24)"
            lineCap="round"
            lineJoin="round"
          />

          <Polyline
            coordinates={activePoints}
            strokeWidth={6}
            strokeColor="#35F2B4"
            lineCap="round"
            lineJoin="round"
          />
        </>
      ) : null}
    </>
  );
}