import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { LiveBus } from "../../transit/models/transitTypes";

type Props = {
  buses: LiveBus[];
  selectedRouteLabel?: string | null;
  selectedVehicleId?: string | null;
};

function routeNumberFromLabel(label?: string | null) {
  return String(label ?? "")
    .split("•")[0]
    .split(" ")[0]
    .trim();
}

function normalizeId(value?: string | null) {
  return String(value ?? "").trim();
}

export default function LiveBusesLayer({
  buses,
  selectedRouteLabel,
  selectedVehicleId,
}: Props) {
  const selectedNumber = routeNumberFromLabel(selectedRouteLabel);
  const selectedVehicle = normalizeId(selectedVehicleId);

  return (
    <>
      {buses.map((bus) => {
        const routeNumber = String(bus.number ?? bus.route ?? bus.routeId ?? "");
        const vehicleId = normalizeId(bus.vehicleId || bus.id);
        const isSelectedVehicle = Boolean(selectedVehicle && vehicleId === selectedVehicle);
        const isSelectedRoute = Boolean(selectedNumber && routeNumber === selectedNumber);
        const isImportant = isSelectedVehicle || isSelectedRoute;
        const heading = Number(bus.heading ?? bus.bearing ?? 0);

        return (
          <Marker
            key={bus.id}
            coordinate={bus.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={isSelectedVehicle ? 2000 : isSelectedRoute ? 999 : 10}
          >
            <View style={styles.markerWrap}>
              {isImportant ? (
                <View style={[styles.glow, isSelectedVehicle && styles.glowVehicle]} />
              ) : null}

              {isSelectedVehicle ? <View style={styles.ring} /> : null}

              <View
                style={[
                  styles.marker,
                  isSelectedRoute && styles.markerActive,
                  isSelectedVehicle && styles.markerVehicle,
                ]}
              >
                <View
                  style={[
                    styles.headingArrow,
                    { transform: [{ rotate: `${heading}deg` }] },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="navigation-variant"
                    size={isSelectedVehicle ? 15 : 12}
                    color={isImportant ? "#03110B" : "#35F2B4"}
                  />
                </View>

                <Text
                  style={[
                    styles.text,
                    isSelectedRoute && styles.textActive,
                    isSelectedVehicle && styles.textVehicle,
                  ]}
                  numberOfLines={1}
                >
                  {routeNumber || "BUS"}
                </Text>
              </View>

              {isSelectedVehicle ? (
                <View style={styles.vehicleLabel}>
                  <Text style={styles.vehicleLabelText}>TAVO</Text>
                </View>
              ) : null}
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    width: 68,
    height: 68,
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
  glowVehicle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(53,242,180,0.28)",
    borderColor: "rgba(255,255,255,0.55)",
  },
  ring: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.70)",
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
  markerVehicle: {
    minWidth: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#35F2B4",
    borderColor: "#FFFFFF",
    borderWidth: 3,
  },
  headingArrow: {
    position: "absolute",
    top: -8,
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
  textVehicle: {
    color: "#06111F",
    fontSize: 14,
  },
  vehicleLabel: {
    position: "absolute",
    bottom: -2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  vehicleLabelText: {
    color: "#06111F",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});