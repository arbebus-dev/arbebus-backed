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

function isValidPoint(point: any) {
  return (
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

function cleanPoints(points?: Coordinate[] | null): Coordinate[] {
  if (!Array.isArray(points)) return [];
  return points.filter(isValidPoint) as Coordinate[];
}

function stepKind(step: TransitStep) {
  if (step.type === "walk" || step.type === "transfer") return "walk";
  if (step.type === "ride" || step.type === "bus") return "ride";
  return "other";
}

function getSegments(route: TransitRouteOption | null) {
  const steps = route?.journeySteps || route?.steps || [];

  const stepSegments = steps
    .map((step, index) => ({
      id: String(step.id ?? `${step.type}-${index}`),
      index,
      type: stepKind(step),
      points: cleanPoints(step.polyline),
    }))
    .filter((segment) => segment.points.length >= 2 && segment.type !== "other");

  if (stepSegments.length) return stepSegments;

  const fallback = cleanPoints(route?.polyline || route?.previewPoints);
  if (fallback.length < 2) return [];

  return [
    {
      id: "fallback",
      index: 0,
      type: route?.mode === "walk_only" || route?.mode === "walk" ? "walk" : "ride",
      points: fallback,
    },
  ];
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

  return segmentIndex === safeIndex;
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
          ? "rgba(80,170,255,0.16)"
          : "rgba(53,242,180,0.14)";

        const baseColor = isWalk
          ? "rgba(80,170,255,0.78)"
          : "rgba(53,242,180,0.72)";

        const activeColor = isWalk ? "#50AAFF" : "#35F2B4";

        return (
          <React.Fragment key={segment.id}>
            <Polyline
              coordinates={segment.points}
              strokeWidth={isActive ? 15 : 12}
              strokeColor={glowColor}
              lineCap="round"
              lineJoin="round"
            />

            <Polyline
              coordinates={segment.points}
              strokeWidth={isActive ? 7 : 5}
              strokeColor={isActive ? activeColor : baseColor}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={isWalk ? [10, 8] : undefined}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}