import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { TransitRouteOption, TransitStep } from "../../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption | null;
  flowState?: string;
};

type StopPoint = {
  id: string;
  name: string;
  coordinate: { latitude: number; longitude: number };
  type: "board" | "ride" | "alight";
  order: number;
};

function isValidCoordinate(point: any) {
  return (
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

function coordinateFromStop(stop: any) {
  if (isValidCoordinate(stop?.coordinate)) return stop.coordinate;

  if (isValidCoordinate(stop)) {
    return {
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
    };
  }

  return null;
}

function stopName(stop: any, fallback = "Stotelė") {
  return String(
    stop?.name ?? stop?.title ?? stop?.stopName ?? stop?.stop_name ?? fallback
  ).trim();
}

function makeStop(
  raw: any,
  type: StopPoint["type"],
  order: number,
  fallbackName?: string
): StopPoint | null {
  const coordinate = coordinateFromStop(raw);
  if (!coordinate) return null;

  return {
    id: String(
      raw?.id ??
        raw?.stop_id ??
        `${type}-${order}-${coordinate.latitude}-${coordinate.longitude}`
    ),
    name: stopName(raw, fallbackName),
    coordinate,
    type,
    order,
  };
}

function getStopsFromRideStep(step: TransitStep, orderStart: number) {
  const raw: any = step;
  const stops = raw.stops ?? raw.rideStops ?? raw.routeStops ?? raw.stopList ?? [];

  if (!Array.isArray(stops) || !stops.length) return [];

  return stops
    .map((stop: any, index: number) =>
      makeStop(stop, "ride", orderStart + index, stopName(stop))
    )
    .filter(Boolean) as StopPoint[];
}

function stopsFromRoute(route: TransitRouteOption): StopPoint[] {
  const result: StopPoint[] = [];
  let order = 0;

  const board = makeStop(route.originStop, "board", order++, route.boardStopName);
  if (board) result.push(board);

  const steps = route.journeySteps || route.steps || [];

  for (const step of steps) {
    if (step.type === "ride" || step.type === "bus") {
      const rideStops = getStopsFromRideStep(step, order);
      result.push(...rideStops);
      order += rideStops.length;
      continue;
    }

    if (step.type === "board" && step.stopName) {
      const firstPoint = Array.isArray(step.polyline) ? step.polyline[0] : null;

      const maybeStop = makeStop(
        { id: step.stopId, name: step.stopName, coordinate: firstPoint },
        "board",
        order++,
        step.stopName
      );

      if (maybeStop) result.push(maybeStop);
    }

    if ((step.type === "alight" || step.type === "arrive") && step.stopName) {
      const lastPoint = Array.isArray(step.polyline)
        ? step.polyline[step.polyline.length - 1]
        : null;

      const maybeStop = makeStop(
        { id: step.stopId, name: step.stopName, coordinate: lastPoint },
        "alight",
        order++,
        step.stopName
      );

      if (maybeStop) result.push(maybeStop);
    }
  }

  const alight = makeStop(route.destinationStop, "alight", order++, route.alightStopName);
  if (alight) result.push(alight);

  const deduped = new Map<string, StopPoint>();

  for (const stop of result) {
    const key = `${stop.coordinate.latitude.toFixed(6)}:${stop.coordinate.longitude.toFixed(6)}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, stop);
      continue;
    }

    if (existing.type === "ride" && stop.type !== "ride") {
      deduped.set(key, stop);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => a.order - b.order);
}

export default function StopsLayer({ route, flowState }: Props) {
  const stops = useMemo(() => {
    if (!route || route.mode === "walk_only" || route.mode === "walk") return [];
    return stopsFromRoute(route);
  }, [route]);

  if (!route || stops.length === 0) return null;

  const isBoardingActive =
    flowState === "walking_to_stop" || flowState === "waiting_bus";

  const isAlightActive =
    flowState === "onboard" || flowState === "arriving";

  return (
    <>
      {stops.map((stop, index) => {
        const isBoard = stop.type === "board";
        const isAlight = stop.type === "alight";

        const isActive =
          (isBoard && isBoardingActive) ||
          (isAlight && isAlightActive);

        return (
          <Marker
            key={`${stop.id}-${index}`}
            coordinate={stop.coordinate}
            anchor={{ x: 0.5, y: 0.95 }}
            tracksViewChanges={false}
            zIndex={isActive ? 900 : isBoard || isAlight ? 600 : 300}
          >
            <View style={styles.pinWrap}>
              {isActive ? <View style={styles.activeGlow} /> : null}

              <View
                style={[
                  styles.pin,
                  isBoard && styles.stopIn,
                  isAlight && styles.stopOut,
                  isActive && styles.activePin,
                ]}
              >
                {isBoard ? <Ionicons name="bus" size={14} color="#06111F" /> : null}
                {isAlight ? <Ionicons name="flag" size={13} color="#06111F" /> : null}

                {!isBoard && !isAlight ? (
                  <Text style={styles.number}>{index + 1}</Text>
                ) : null}

                {isBoard || isAlight ? (
                  <Text style={styles.text}>{isBoard ? "ĮLIPK" : "IŠLIPK"}</Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.pinDot,
                  isBoard && { backgroundColor: "#35F2B4" },
                  isAlight && { backgroundColor: "#FFB84D" },
                ]}
              />
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  activeGlow: {
    position: "absolute",
    top: -7,
    width: 92,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  pin: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,16,30,0.95)",
    borderWidth: 2,
    borderColor: "#35F2B4",
  },
  activePin: {
    transform: [{ scale: 1.08 }],
  },
  stopIn: {
    minWidth: 72,
    height: 34,
    backgroundColor: "#35F2B4",
    borderColor: "white",
  },
  stopOut: {
    minWidth: 76,
    height: 34,
    backgroundColor: "#FFB84D",
    borderColor: "white",
  },
  pinDot: {
    marginTop: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#35F2B4",
    borderWidth: 2,
    borderColor: "white",
  },
  text: {
    color: "#06111F",
    fontSize: 10,
    fontWeight: "900",
  },
  number: {
    color: "#CFFFEA",
    fontSize: 10,
    fontWeight: "900",
  },
});