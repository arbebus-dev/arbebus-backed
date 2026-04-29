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

function normalizeId(value?: string | null) {
  return String(value ?? "").trim();
}

function routeNumberFromLabel(label?: string | null) {
  return String(label ?? "")
    .trim()
    .split("•")[0]
    .split(" ")[0]
    .replace(/^0+/, "")
    .toUpperCase();
}

function isValidCoordinate(bus: LiveBus) {
  return (
    bus.coordinate &&
    Number.isFinite(Number(bus.coordinate.latitude)) &&
    Number.isFinite(Number(bus.coordinate.longitude))
  );
}

function busLabel(bus: LiveBus) {
  const label = bus.number || bus.route || bus.routeId || bus.vehicleLabel || "";
  const clean = String(label).replace("undefined", "").trim();
  return clean || "—";
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
      {buses.filter(isValidCoordinate).map((bus) => {
        const routeNumber = busLabel(bus);
        const normalizedRoute = routeNumberFromLabel(bus.routeId || bus.route || bus.number);
        const ids = [bus.vehicleId, bus.id, bus.vehicleLabel].map(normalizeId);

        const isSelectedVehicle = Boolean(selectedVehicle && ids.includes(selectedVehicle));
        const isSelectedRoute = Boolean(selectedNumber && normalizedRoute === selectedNumber);
        const isImportant = isSelectedVehicle || isSelectedRoute;

        const heading = Number(bus.heading ?? bus.bearing ?? 0);

        return (
          <Marker
            key={bus.id}
            coordinate={bus.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={isSelectedVehicle ? 3000 : isSelectedRoute ? 1200 : 10}
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
                  {routeNumber}
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
    width: 70,
    height: 70,
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
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(53,242,180,0.30)",
    borderColor: "rgba(255,255,255,0.65)",
  },
  ring: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.80)",
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
    minWidth: 50,
    height: 50,
    borderRadius: 25,
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