import React, { useMemo } from "react";
import { Polyline } from "react-native-maps";
import type {
  Coordinate,
  TransitFlowState,
  TransitRouteOption,
  TransitStep,
} from "../../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption | null;
  flowState?: TransitFlowState;
  currentStepIndex?: number;
};

type Segment = {
  id: string;
  index: number;
  type: "walk" | "ride";
  points: Coordinate[];
};

function isValidPoint(point: any) {
  return (
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

function cleanPoints(points?: Coordinate[] | null): Coordinate[] {
  if (!Array.isArray(points)) return [];
  return points.filter(isValidPoint).map((point) => ({
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
  }));
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const dx = (a.latitude - b.latitude) * 111320;
  const dy =
    (a.longitude - b.longitude) *
    40075000 *
    Math.cos((a.latitude * Math.PI) / 180) /
    360;
  return Math.sqrt(dx * dx + dy * dy);
}

function lineLength(points: Coordinate[]) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distanceMeters(points[i - 1], points[i]);
  }
  return total;
}

function stepKind(step: TransitStep): "walk" | "ride" | "other" {
  if (step.type === "walk" || step.type === "transfer") return "walk";
  if (step.type === "ride" || step.type === "bus") return "ride";
  return "other";
}

function routeMainLine(route: TransitRouteOption | null) {
  const candidates = [
    (route as any)?.shapePolyline,
    (route as any)?.routePolyline,
    route?.polyline,
    route?.previewPoints,
  ];

  for (const candidate of candidates) {
    const points = cleanPoints(candidate);
    // Do not show long 2-point fallback lines. Real Apple Maps style needs real geometry.
    if (points.length >= 3) return points;
    if (points.length === 2 && lineLength(points) <= 180) return points;
  }

  return [];
}

function getSegments(route: TransitRouteOption | null): Segment[] {
  if (!route) return [];

  const mainLine = routeMainLine(route);
  if (mainLine.length >= 2) {
    return [
      {
        id: "main-route-geometry",
        index: 0,
        type: route.mode === "walk_only" || route.mode === "walk" ? "walk" : "ride",
        points: mainLine,
      },
    ];
  }

  const steps = route?.journeySteps || route?.steps || [];
  return steps
    .map((step, index) => {
      const points = cleanPoints(step.polyline);
      const type = stepKind(step);
      if (type === "other") return null;
      if (points.length >= 3) {
        return { id: String(step.id ?? `${step.type}-${index}`), index, type, points };
      }
      if (points.length === 2 && lineLength(points) <= 180) {
        return { id: String(step.id ?? `${step.type}-${index}`), index, type, points };
      }
      return null;
    })
    .filter(Boolean) as Segment[];
}

function isActiveSegment(
  segmentIndex: number,
  flowState?: TransitFlowState,
  currentStepIndex?: number
) {
  const safeIndex = Math.max(0, Number(currentStepIndex || 0));

  if (flowState === "route_options" || flowState === "route_selected") {
    return segmentIndex === 0;
  }

  return segmentIndex === safeIndex || segmentIndex === 0;
}

export default function RoutePolylineLayer({
  route,
  flowState,
  currentStepIndex,
}: Props) {
  const segments = useMemo(() => getSegments(route), [route]);

  if (!segments.length) return null;

  return (
    <>
      {segments.map((segment) => {
        const isWalk = segment.type === "walk";
        const isActive = isActiveSegment(segment.index, flowState, currentStepIndex);

        const glowColor = isWalk
          ? "rgba(79,159,255,0.18)"
          : "rgba(45,212,167,0.16)";

        const baseColor = isWalk
          ? "rgba(79,159,255,0.82)"
          : "rgba(45,212,167,0.82)";

        const activeColor = isWalk ? "#4F9FFF" : "#2DD4A7";

        return (
          <React.Fragment key={segment.id}>
            <Polyline
              coordinates={segment.points}
              strokeWidth={isActive ? 13 : 10}
              strokeColor={glowColor}
              lineCap="round"
              lineJoin="round"
              zIndex={60}
            />

            <Polyline
              coordinates={segment.points}
              strokeWidth={isActive ? 6 : 4}
              strokeColor={isActive ? activeColor : baseColor}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={isWalk ? [8, 7] : undefined}
              zIndex={80}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}
