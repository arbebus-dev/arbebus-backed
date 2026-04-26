import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { TransitRouteOption } from "../../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption | null;
};

type StopPoint = {
  id: string;
  name: string;
  coordinate: { latitude: number; longitude: number };
  type: "origin" | "destination" | "intermediate";
};

function isValid(point: any) {
  return (
    point &&
    Number.isFinite(Number(point.latitude)) &&
    Number.isFinite(Number(point.longitude))
  );
}

export default function StopsLayer({ route }: Props) {
  const stops = useMemo(() => {
    if (!route) return [];

    const result: StopPoint[] = [];

    // 🔥 ORIGIN
    if (route.originStop?.coordinate && isValid(route.originStop.coordinate)) {
      result.push({
        id: "origin",
        name: route.originStop.name,
        coordinate: route.originStop.coordinate,
        type: "origin",
      });
    }

    // 🔥 INTERMEDIATE (iš step'ų)
    const stepStops =
      route.journeySteps
        ?.map((step, i) => {
          if (!step.stopName || !step.toStopName) return null;

          const coord = step.polyline?.[0];
          if (!isValid(coord)) return null;

          return {
            id: `step-${i}`,
            name: step.toStopName || step.stopName,
            coordinate: coord,
            type: "intermediate" as const,
          };
        })
        .filter(Boolean) || [];

    result.push(...stepStops);

    // 🔥 DESTINATION
    if (
      route.destinationStop?.coordinate &&
      isValid(route.destinationStop.coordinate)
    ) {
      result.push({
        id: "destination",
        name: route.destinationStop.name,
        coordinate: route.destinationStop.coordinate,
        type: "destination",
      });
    }

    return result;
  }, [route]);

  if (!route || stops.length === 0) return null;

  return (
    <>
      {stops.map((stop) => {
        const isOrigin = stop.type === "origin";
        const isDestination = stop.type === "destination";

        return (
          <Marker
            key={stop.id}
            coordinate={stop.coordinate}
            anchor={{ x: 0.5, y: 0.95 }}
          >
            <View style={styles.pinWrap}>
              {/* 🔥 MAIN PIN */}
              <View
                style={[
                  styles.pin,
                  isOrigin && styles.stopIn,
                  isDestination && styles.stopOut,
                ]}
              >
                {isOrigin && (
                  <Ionicons name="bus" size={14} color="#06111F" />
                )}

                {isDestination && (
                  <Ionicons name="flag" size={13} color="#06111F" />
                )}

                {!isOrigin && !isDestination && (
                  <Ionicons name="ellipse" size={10} color="#35F2B4" />
                )}

                {(isOrigin || isDestination) && (
                  <Text style={styles.text}>
                    {isOrigin ? "ĮLIPK" : "IŠLIPK"}
                  </Text>
                )}
              </View>

              {/* 🔥 DOT */}
              <View
                style={[
                  styles.pinDot,
                  isOrigin && { backgroundColor: "#35F2B4" },
                  isDestination && { backgroundColor: "#FFB84D" },
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
});