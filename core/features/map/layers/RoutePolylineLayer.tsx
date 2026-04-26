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

function activeSegment(points: Coordinate[], flowState?: TransitFlowState) {
  if (points.length < 2) return [];

  if (
    flowState === "walking_to_stop" ||
    flowState === "waiting_bus" ||
    flowState === "route_selected" ||
    flowState === "route_options"
  ) {
    const end = Math.max(2, Math.floor(points.length * 0.22));
    return points.slice(0, end);
  }

  if (flowState === "onboard" || flowState === "transfer") {
    const start = Math.max(0, Math.floor(points.length * 0.18));
    const end = Math.max(start + 2, Math.floor(points.length * 0.86));
    return points.slice(start, end);
  }

  if (flowState === "arriving") {
    const start = Math.max(0, Math.floor(points.length * 0.72));
    return points.slice(start);
  }

  return points;
}

export default function RoutePolylineLayer({
  route,
  flowState,
}: Props) {
  const points = useMemo(() => getRoutePoints(route), [route]);

  const activePoints = useMemo(() => {
    return activeSegment(points, flowState);
  }, [points, flowState]);

  if (points.length < 2) return null;

  return (
    <>
      <Polyline
        coordinates={points}
        strokeWidth={13}
        strokeColor="rgba(53,242,180,0.14)"
        lineCap="round"
        lineJoin="round"
      />

      <Polyline
        coordinates={points}
        strokeWidth={7}
        strokeColor="rgba(53,242,180,0.38)"
        lineCap="round"
        lineJoin="round"
      />

      {activePoints.length >= 2 ? (
        <>
          <Polyline
            coordinates={activePoints}
            strokeWidth={12}
            strokeColor="rgba(255,255,255,0.22)"
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