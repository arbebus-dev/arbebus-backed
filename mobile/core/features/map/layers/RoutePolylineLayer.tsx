import React, { useMemo } from "react";
import { Polyline } from "react-native-maps";
import type {
  Coordinate,
  TransitFlowState,
  TransitRouteOption,
  TransitStep,
} from "../../transit/models/transitTypes";
import {
  cleanPolyline,
  polylineLengthMeters,
  smoothPolyline,
} from "../../../utils/polylineAppleMaps";

type Props = {
  route: TransitRouteOption | null;
  flowState?: TransitFlowState;
  currentStepIndex?: number;
};

type SegmentMode = "walk" | "bus" | "ferry" | "train" | "bolt" | "ride";

type Segment = {
  id: string;
  index: number;
  mode: SegmentMode;
  points: Coordinate[];
  rawLength: number;
  provider?: string | null;
};

function normalizeMode(value?: string | null): SegmentMode {
  const mode = String(value || "").toLowerCase();

  if (mode.includes("walk") || mode === "transfer") return "walk";
  if (mode.includes("ferry") || mode.includes("kelt")) return "ferry";
  if (mode.includes("train") || mode.includes("rail") || mode.includes("ltg") || mode.includes("traukin")) return "train";
  if (mode.includes("bolt") || mode.includes("taxi")) return "bolt";
  if (mode.includes("bus") || mode.includes("ride") || mode.includes("board") || mode.includes("alight")) return "bus";

  return "ride";
}

function stepMode(step: TransitStep): SegmentMode {
  return normalizeMode(step.mode || step.type || step.icon);
}

function stepPoints(step: TransitStep): Coordinate[] {
  const candidates = [
    step.polyline,
    (step as any)?.shapePolyline,
    (step as any)?.routePolyline,
    (step as any)?.points,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanPolyline(candidate);
    if (cleaned.length >= 3) return cleaned;
    if (cleaned.length === 2 && polylineLengthMeters(cleaned) <= 220) return cleaned;
  }

  const from = (step as any)?.fromStop?.coordinate ||
    ((step as any)?.fromStop?.latitude && (step as any)?.fromStop?.longitude
      ? { latitude: Number((step as any).fromStop.latitude), longitude: Number((step as any).fromStop.longitude) }
      : null);
  const to = (step as any)?.toStop?.coordinate ||
    ((step as any)?.toStop?.latitude && (step as any)?.toStop?.longitude
      ? { latitude: Number((step as any).toStop.latitude), longitude: Number((step as any).toStop.longitude) }
      : null);

  const fallback = cleanPolyline([from, to].filter(Boolean) as Coordinate[]);
  if (fallback.length === 2 && polylineLengthMeters(fallback) <= 220) return fallback;

  return [];
}

function routeMainLine(route: TransitRouteOption | null): Segment[] {
  if (!route) return [];

  const candidates = [
    (route as any)?.shapePolyline,
    (route as any)?.routePolyline,
    route.polyline,
    route.previewPoints,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanPolyline(candidate);
    if (cleaned.length >= 3) {
      return [
        {
          id: "route-main-geometry",
          index: 0,
          mode: normalizeMode(route.mode || route.routeLabel),
          points: cleaned,
          rawLength: polylineLengthMeters(cleaned),
          provider: null,
        },
      ];
    }
  }

  return [];
}

function routeStepSegments(route: TransitRouteOption | null): Segment[] {
  if (!route) return [];

  const steps = route.journeySteps || route.steps || [];
  const segments = steps
    .map((step, index) => {
      const points = stepPoints(step);
      if (points.length < 2) return null;

      return {
        id: String(step.id || `${step.type || step.mode || "step"}-${index}`),
        index,
        mode: stepMode(step),
        points,
        rawLength: polylineLengthMeters(points),
      } satisfies Segment;
    })
    .filter(Boolean) as Segment[];

  return segments;
}

function getSegments(route: TransitRouteOption | null): Segment[] {
  const stepSegments = routeStepSegments(route);

  // Prefer per-step geometry. Apple Maps works visually because each mode gets its own layer.
  if (stepSegments.length) return stepSegments;

  return routeMainLine(route);
}

function isNavigationFlow(flowState?: TransitFlowState): boolean {
  return ["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving"].includes(String(flowState));
}

function isActiveSegment(segment: Segment, flowState?: TransitFlowState, currentStepIndex?: number): boolean {
  if (!isNavigationFlow(flowState)) return true;

  const activeIndex = Math.max(0, Number(currentStepIndex || 0));
  return segment.index === activeIndex;
}

function styleForMode(mode: SegmentMode) {
  switch (mode) {
    case "walk":
      return {
        glow: "rgba(255,255,255,0.12)",
        casing: "rgba(20,28,42,0.38)",
        line: "rgba(255,255,255,0.88)",
        inactive: "rgba(255,255,255,0.45)",
        dash: [5, 8] as number[],
      };
    case "ferry":
      return {
        glow: "rgba(77,166,255,0.12)",
        casing: "rgba(5,26,45,0.60)",
        line: "#4DA6FF",
        inactive: "rgba(77,166,255,0.58)",
        dash: undefined,
      };
    case "train":
      return {
        glow: "rgba(175,82,222,0.12)",
        casing: "rgba(33,12,47,0.56)",
        line: "#AF52DE",
        inactive: "rgba(175,82,222,0.58)",
        dash: undefined,
      };
    case "bolt":
      return {
        glow: "rgba(52,199,89,0.12)",
        casing: "rgba(5,35,18,0.52)",
        line: "#34C759",
        inactive: "rgba(52,199,89,0.56)",
        dash: undefined,
      };
    case "bus":
    case "ride":
    default:
      return {
        glow: "rgba(0,224,164,0.12)",
        casing: "rgba(0,28,24,0.42)",
        line: "#28E6AD",
        inactive: "rgba(40,230,173,0.50)",
        dash: undefined,
      };
  }
}

export default function RoutePolylineLayer({
  route,
  flowState,
  currentStepIndex,
}: Props) {
  const segments = useMemo(() => {
    return getSegments(route).map((segment) => ({
      ...segment,
      points: smoothPolyline(segment.points),
    }))
    // If backend only has fallback straight walking geometry, do not draw an ugly fake road line.
    // Real walking should come from ORS and usually has > 3 points.
    .filter((segment) => {
      if (segment.points.length < 2) return false;
      const provider = String(segment.provider || "").toLowerCase();
      if (segment.mode === "walk" && provider === "fallback" && segment.rawLength > 2600) return false;
      if (segment.mode === "walk" && segment.points.length <= 3 && segment.rawLength > 2600) return false;
      return true;
    });
  }, [route]);

  if (!segments.length) return null;

  return (
    <>
      {segments.map((segment) => {
        const active = isActiveSegment(segment, flowState, currentStepIndex);
        const style = styleForMode(segment.mode);
        const isWalk = segment.mode === "walk";
        const isFerry = segment.mode === "ferry";
        const mainWidth = active ? (isWalk ? 3.2 : isFerry ? 4.4 : 4.6) : (isWalk ? 2.8 : isFerry ? 3.6 : 3.7);
        const casingWidth = mainWidth + (isWalk ? 2.2 : isFerry ? 2.4 : 2.7);
        const glowWidth = mainWidth + (isWalk ? 4.2 : isFerry ? 4.8 : 5.0);

        return (
          <React.Fragment key={segment.id}>
            <Polyline
              coordinates={segment.points}
              strokeWidth={glowWidth}
              strokeColor={style.glow}
              lineCap="round"
              lineJoin="round"
              zIndex={70}
            />

            <Polyline
              coordinates={segment.points}
              strokeWidth={casingWidth}
              strokeColor={style.casing}
              lineCap="round"
              lineJoin="round"
              zIndex={80}
            />

            <Polyline
              coordinates={segment.points}
              strokeWidth={mainWidth}
              strokeColor={active ? style.line : style.inactive}
              lineDashPattern={style.dash}
              lineCap="round"
              lineJoin="round"
              zIndex={90}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}
