import React from "react";
import { Marker } from "react-native-maps";
import { Text, View } from "react-native";
import type { LiveBus } from "../../../../types/home";

function getBusLabel(bus: LiveBus) {
  return String(
    bus.routeShortName || bus.route || bus.number || bus.vehicleLabel || bus.routeId || "?"
  )
    .replace(/^0+/, "")
    .trim();
}

export default function TransitMarkersLayer({
  liveBuses,
  bestBusId,
  activeTrip,
  onBusPress,
}: {
  liveBuses: LiveBus[];
  bestBusId?: string | null;
  activeTrip?: boolean;
  onBusPress?: (bus: LiveBus) => void;
}) {
  const busesToRender = activeTrip && bestBusId
    ? liveBuses.filter((bus) => bus.id === bestBusId || bus.vehicleId === bestBusId)
    : liveBuses;

  return (
    <>
      {busesToRender.map((bus) => {
        const label = getBusLabel(bus);
        const isBest = bus.id === bestBusId || bus.vehicleId === bestBusId;

        return (
          <Marker
            key={bus.id}
            coordinate={bus.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => onBusPress?.(bus)}
            rotation={Number(bus.heading ?? bus.bearing ?? 0)}
          >
            <View
              style={{
                minWidth: 34,
                height: 34,
                paddingHorizontal: 8,
                borderRadius: 17,
                backgroundColor: isBest ? "#111827" : "#FFFFFF",
                borderWidth: 2,
                borderColor: isBest ? "#60A5FA" : "#D1D5DB",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Text style={{ color: isBest ? "#FFFFFF" : "#111827", fontWeight: "800", fontSize: 13 }}>
                {label}
              </Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
}
