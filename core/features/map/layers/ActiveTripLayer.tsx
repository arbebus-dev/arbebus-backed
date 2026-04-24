import React from "react";
import { Marker, Polyline } from "react-native-maps";
import { Text, View } from "react-native";
import type { Coordinate, TransitPlan } from "../../../services/transit/plannerTypes";

function MarkerChip({ title, type }: { title: string; type: "from" | "to" | "stop" | "next" }) {
  const bg = type === "to" ? "#111827" : type === "stop" ? "#1D4ED8" : type === "next" ? "#1677FF" : "#FFFFFF";
  const color = type === "from" ? "#111827" : "#FFFFFF";
  const borderColor = type === "from" ? "#D1D5DB" : bg;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        shadowColor: "#0F172A",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Text style={{ color, fontWeight: "700", fontSize: 12 }}>{title}</Text>
    </View>
  );
}

export default function ActiveTripLayer({
  transitPlan,
  fallbackRoute,
  pickupCoordinate,
  destinationCoordinate,
}: {
  transitPlan?: TransitPlan | null;
  fallbackRoute?: Coordinate[];
  pickupCoordinate?: Coordinate | null;
  destinationCoordinate?: Coordinate | null;
}) {
  const segments = transitPlan?.segments || [];
  const hasSegments = segments.length > 0;

  return (
    <>
      {hasSegments
        ? segments.map((segment) => (
            <Polyline
              key={segment.id}
              coordinates={segment.points}
              strokeWidth={segment.type === "walk" ? 4 : 5}
              strokeColor={segment.type === "walk" ? "#7C8AA5" : "#1677FF"}
              lineDashPattern={segment.type === "walk" ? [8, 8] : undefined}
              lineCap="round"
              lineJoin="round"
            />
          ))
        : fallbackRoute && fallbackRoute.length > 1
        ? <Polyline coordinates={fallbackRoute} strokeWidth={5} strokeColor="#1677FF" lineCap="round" lineJoin="round" />
        : null}

      {pickupCoordinate ? (
        <Marker coordinate={pickupCoordinate} anchor={{ x: 0.5, y: 1 }}>
          <MarkerChip title="Start" type="from" />
        </Marker>
      ) : null}

      {transitPlan?.originStop ? (
        <Marker coordinate={{ latitude: transitPlan.originStop.latitude, longitude: transitPlan.originStop.longitude }} anchor={{ x: 0.5, y: 1 }}>
          <MarkerChip title={transitPlan.originStop.name} type="stop" />
        </Marker>
      ) : null}

      {transitPlan?.destinationStop ? (
        <Marker coordinate={{ latitude: transitPlan.destinationStop.latitude, longitude: transitPlan.destinationStop.longitude }} anchor={{ x: 0.5, y: 1 }}>
          <MarkerChip title={transitPlan.destinationStop.name} type="stop" />
        </Marker>
      ) : null}

      {transitPlan?.summary.nextStopName ? (() => {
        for (const segment of transitPlan.segments || []) {
          for (const stop of segment.stops || []) {
            if (
              stop.stopName === transitPlan.summary.nextStopName &&
              typeof stop.latitude === "number" &&
              typeof stop.longitude === "number"
            ) {
              return (
                <Marker coordinate={{ latitude: stop.latitude, longitude: stop.longitude }} anchor={{ x: 0.5, y: 1 }}>
                  <MarkerChip title={`Kita: ${stop.stopName}`} type="next" />
                </Marker>
              );
            }
          }
        }
        return null;
      })() : null}

      {destinationCoordinate ? (
        <Marker coordinate={destinationCoordinate} anchor={{ x: 0.5, y: 1 }}>
          <MarkerChip title="Tikslas" type="to" />
        </Marker>
      ) : null}
    </>
  );
}
