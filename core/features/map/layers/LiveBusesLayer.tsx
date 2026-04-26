import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { LiveBus } from "../../transit/models/transitTypes";

type Props = {
  buses: LiveBus[];
  selectedRouteLabel?: string | null;
};

function routeNumberFromLabel(label?: string | null) {
  return String(label ?? "")
    .split("•")[0]
    .split(" ")[0]
    .trim();
}

export default function LiveBusesLayer({ buses, selectedRouteLabel }: Props) {
  const selectedNumber = routeNumberFromLabel(selectedRouteLabel);

  return (
    <>
      {buses.map((bus) => {
        const routeNumber = String(bus.number ?? bus.route ?? bus.routeId ?? "");
        const isSelectedRoute = Boolean(selectedNumber && routeNumber === selectedNumber);
        const heading = Number(bus.heading ?? bus.bearing ?? 0);

        return (
          <Marker
            key={bus.id}
            coordinate={bus.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={isSelectedRoute ? 999 : 10}
          >
            <View style={styles.markerWrap}>
              {isSelectedRoute ? <View style={styles.glow} /> : null}

              <View style={[styles.marker, isSelectedRoute && styles.markerActive]}>
                <View style={[styles.headingArrow, { transform: [{ rotate: `${heading}deg` }] }]}>
                  <MaterialCommunityIcons
                    name="navigation-variant"
                    size={12}
                    color={isSelectedRoute ? "#03110B" : "#35F2B4"}
                  />
                </View>

                <Text style={[styles.text, isSelectedRoute && styles.textActive]} numberOfLines={1}>
                  {routeNumber || "BUS"}
                </Text>
              </View>
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(53,242,180,0.20)",
    borderWidth: 1,
    borderColor: "rgba(53,242,180,0.35)",
  },
  marker: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 7,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,13,27,0.95)",
    borderWidth: 2,
    borderColor: "#35F2B4",
  },
  markerActive: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#35F2B4",
    borderColor: "#FFFFFF",
  },
  headingArrow: {
    position: "absolute",
    top: -7,
    alignSelf: "center",
  },
  text: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  textActive: {
    color: "#06111F",
    fontSize: 13,
  },
});