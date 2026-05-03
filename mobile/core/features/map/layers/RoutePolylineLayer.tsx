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
};

const LONG_FALLBACK_LIMIT_METERS = 260;

function normalizeMode(value?: string | null): SegmentMode {
  const mode = String(value || "").toLowerCase();

  if (mode.includes("walk") || mode === "transfer" || mode.includes("pės")) return "walk";
  if (mode.includes("ferry") || mode.includes("kelt") || mode.includes("perk")) return "ferry";
  if (mode.includes("train") || mode.includes("rail") || mode.includes("ltg") || mode.includes("traukin")) return "train";
  if (mode.includes("bolt") || mode.includes("taxi")) return "bolt";
  if (mode.includes("bus") || mode.includes("ride") || mode.includes("board") || mode.includes("alight")) return "bus";

  return "ride";
}

function stepMode(step: TransitStep): SegmentMode {
  return normalizeMode(step.mode || step.type || step.icon || step.routeLabel);
}

function coordinateFromStop(raw: any): Coordinate | null {
  const latitude = Number(raw?.coordinate?.latitude ?? raw?.latitude ?? raw?.stop_lat ?? raw?.lat);
  const longitude = Number(raw?.coordinate?.longitude ?? raw?.longitude ?? raw?.stop_lon ?? raw?.lon ?? raw?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function stepPoints(step: TransitStep): Coordinate[] {
  const candidates = [
    step.polyline,
    (step as any)?.shapePolyline,
    (step as any)?.routePolyline,
    (step as any)?.geometry,
    (step as any)?.points,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanPolyline(candidate);
    if (cleaned.length >= 3) return cleaned;

    // Apple Maps style: never draw long artificial straight fallback lines.
    if (cleaned.length === 2 && polylineLengthMeters(cleaned) <= LONG_FALLBACK_LIMIT_METERS) {
      return cleaned;
    }
  }

  const from = coordinateFromStop((step as any)?.fromStop) || coordinateFromStop((step as any)?.originStop);
  const to = coordinateFromStop((step as any)?.toStop) || coordinateFromStop((step as any)?.destinationStop);
  const fallback = cleanPolyline([from, to].filter(Boolean) as Coordinate[]);

  if (fallback.length === 2 && polylineLengthMeters(fallback) <= LONG_FALLBACK_LIMIT_METERS) {
    return fallback;
  }

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
        },
      ];
    }
  }

  return [];
}

function routeStepSegments(route: TransitRouteOption | null): Segment[] {
  if (!route) return [];

  const steps = route.journeySteps || route.steps || [];
  return steps
    .map((step, index) => {
      const points = stepPoints(step);
      if (points.length < 2) return null;

      return {
        id: String(step.id || `${step.type || step.mode || "step"}-${index}`),
        index,
        mode: stepMode(step),
        points,
      } satisfies Segment;
    })
    .filter(Boolean) as Segment[];
}

function getSegments(route: TransitRouteOption | null): Segment[] {
  const stepSegments = routeStepSegments(route);
  if (stepSegments.length) return stepSegments;
  return routeMainLine(route);
}

function isNavigationFlow(flowState?: TransitFlowState): boolean {
  return ["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving"].includes(String(flowState));
}

function isActiveSegment(segment: Segment, flowState?: TransitFlowState, currentStepIndex?: number): boolean {
  if (!isNavigationFlow(flowState)) return true;
  return segment.index === Math.max(0, Number(currentStepIndex || 0));
}

function styleForMode(mode: SegmentMode) {
  switch (mode) {
    case "walk":
      return {
        casing: "rgba(12,18,28,0.42)",
        shadow: "rgba(255,255,255,0.16)",
        line: "#FFFFFF",
        inactive: "rgba(255,255,255,0.60)",
        dash: [5, 9] as number[],
        baseWidth: 3.6,
      };
    case "ferry":
      return {
        casing: "rgba(7,25,43,0.50)",
        shadow: "rgba(77,166,255,0.12)",
        line: "#58AFFF",
        inactive: "rgba(88,175,255,0.56)",
        dash: undefined,
        baseWidth: 4.8,
      };
    case "train":
      return {
        casing: "rgba(28,18,40,0.50)",
        shadow: "rgba(175,82,222,0.11)",
        line: "#B66DFF",
        inactive: "rgba(182,109,255,0.55)",
        dash: undefined,
        baseWidth: 4.8,
      };
    case "bolt":
      return {
        casing: "rgba(8,28,17,0.46)",
        shadow: "rgba(52,199,89,0.10)",
        line: "#38D86E",
        inactive: "rgba(56,216,110,0.54)",
        dash: undefined,
        baseWidth: 4.6,
      };
    case "bus":
    case "ride":
    default:
      return {
        casing: "rgba(3,38,33,0.54)",
        shadow: "rgba(53,242,180,0.10)",
        line: "#35F2B4",
        inactive: "rgba(53,242,180,0.55)",
        dash: undefined,
        baseWidth: 4.9,
      };
  }
}

export default function RoutePolylineLayer({
  route,
  flowState,
  currentStepIndex,
}: Props) {
  const segments = useMemo(() => {
    return getSegments(route)
      .map((segment) => ({
        ...segment,
        points: smoothPolyline(segment.points),
      }))
      .filter((segment) => segment.points.length >= 2);
  }, [route]);

  if (!segments.length) return null;

  return (
    <>
      {segments.map((segment) => {
        const active = isActiveSegment(segment, flowState, currentStepIndex);
        const style = styleForMode(segment.mode);
        const isWalk = segment.mode === "walk";
        const mainWidth = active ? style.baseWidth : Math.max(3.2, style.baseWidth - 1.1);
        const casingWidth = mainWidth + (isWalk ? 1.8 : 2.2);
        const shadowWidth = mainWidth + (isWalk ? 3.3 : 3.6);

        return (
          <React.Fragment key={segment.id}>
            <Polyline
              coordinates={segment.points}
              strokeWidth={shadowWidth}
              strokeColor={style.shadow}
              lineCap="round"
              lineJoin="round"
              zIndex={18}
            />

            <Polyline
              coordinates={segment.points}
              strokeWidth={casingWidth}
              strokeColor={style.casing}
              lineCap="round"
              lineJoin="round"
              zIndex={19}
            />

            <Polyline
              coordinates={segment.points}
              strokeWidth={mainWidth}
              strokeColor={active ? style.line : style.inactive}
              lineDashPattern={style.dash}
              lineCap="round"
              lineJoin="round"
              zIndex={20}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}
