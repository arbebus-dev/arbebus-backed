import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { LiveBus } from "../../transit/models/transitTypes";

type Props = {
  buses: LiveBus[];
  selectedRouteLabel?: string | null;
};

export default function LiveBusesLayer({ buses, selectedRouteLabel }: Props) {
  return (
    <>
      {buses.map((bus) => {
        const routeNumber = String(bus.number ?? bus.route ?? bus.routeId ?? "");
        const selectedNumber = String(selectedRouteLabel ?? "").split(" ")[0];
        const isSelectedRoute = Boolean(selectedNumber && routeNumber === selectedNumber);

        return (
          <Marker
            key={bus.id}
            coordinate={bus.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={Number(bus.heading ?? bus.bearing ?? 0)}
            tracksViewChanges={false}
          >
            <View style={[styles.marker, isSelectedRoute && styles.markerActive]}>
              <Text style={[styles.text, isSelectedRoute && styles.textActive]}>{routeNumber || "BUS"}</Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  marker: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 7,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10182E",
    borderWidth: 2,
    borderColor: "#35F2B4",
  },
  markerActive: {
    backgroundColor: "#35F2B4",
    borderColor: "#FFFFFF",
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  textActive: {
    color: "#06111F",
  },
});
