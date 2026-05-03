import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import { COLORS, T } from "@/core/theme/typography";
import { cleanRouteNumber } from "../../transit/models/journeyStateMachine";
import type { LiveBus } from "../../transit/models/transitTypes";

type Props = {
  buses: LiveBus[];
  selectedRouteLabel?: string | null;
  selectedVehicleId?: string | null;
};

function normalizeId(value?: string | null) {
  return String(value ?? "").trim();
}

function coordinateFromBus(bus: any) {
  const latitude = Number(bus?.latitude ?? bus?.lat ?? bus?.coordinate?.latitude);
  const longitude = Number(bus?.longitude ?? bus?.lon ?? bus?.lng ?? bus?.coordinate?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function busLabel(bus: LiveBus) {
  return cleanRouteNumber(bus.number || bus.route || bus.routeId || bus.vehicleLabel || "BUS") || "BUS";
}

function BusGlyph({ active, vehicle, heading, label }: { active: boolean; vehicle: boolean; heading: number; label: string }) {
  return (
    <View style={[styles.glyph, active && styles.glyphActive, vehicle && styles.glyphVehicle]}>
      <View style={[styles.arrow, { transform: [{ rotate: `${heading}deg` }] }]}>
        <MaterialCommunityIcons name="navigation-variant" size={8} color={active ? COLORS.greenDark : COLORS.green} />
      </View>
      <MaterialCommunityIcons name="bus" size={active ? 12 : 11} color={active ? COLORS.greenDark : "#FFFFFF"} />
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function LiveBusesLayer({ buses, selectedRouteLabel, selectedVehicleId }: Props) {
  const selectedNumber = cleanRouteNumber(selectedRouteLabel);
  const selectedVehicle = normalizeId(selectedVehicleId);
  const fade = useRef(new Animated.Value(0)).current;
  const [tracksChanges, setTracksChanges] = useState(true);

  useEffect(() => {
    setTracksChanges(true);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start(() => {
      setTimeout(() => setTracksChanges(false), 700);
    });
  }, [buses.length, fade]);

  const visibleBuses = useMemo(() => (buses || []).map((bus) => ({ bus, coordinate: coordinateFromBus(bus) })).filter((item) => item.coordinate), [buses]);

  return (
    <>
      {visibleBuses.map(({ bus, coordinate }) => {
        const routeNumber = busLabel(bus);
        const normalizedRoute = cleanRouteNumber(bus.routeId || bus.route || bus.number);
        const ids = [bus.vehicleId, bus.id, bus.vehicleLabel].map(normalizeId);
        const isSelectedVehicle = Boolean(selectedVehicle && ids.includes(selectedVehicle));
        const isSelectedRoute = Boolean(selectedNumber && normalizedRoute === selectedNumber);
        const isImportant = isSelectedVehicle || isSelectedRoute;
        const heading = Number(bus.heading ?? bus.bearing ?? 0);
        return (
          <Marker
            key={`${bus.id}-${bus.vehicleId}-${routeNumber}`}
            coordinate={coordinate!}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksChanges || isImportant}
            zIndex={isSelectedVehicle ? 5000 : isSelectedRoute ? 2500 : 200}
          >
            <Animated.View style={[styles.markerWrap, { opacity: fade }]}> 
              {isImportant ? <View style={styles.glow} /> : null}
              <BusGlyph active={isImportant} vehicle={isSelectedVehicle} heading={heading} label={routeNumber} />
            </Animated.View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  markerWrap: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(45,212,167,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" },
  glyph: { minWidth: 26, height: 26, paddingHorizontal: 4, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,13,27,0.94)", borderWidth: 1.2, borderColor: "rgba(45,212,167,0.82)" },
  glyphActive: { minWidth: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.green, borderColor: "#FFFFFF" },
  glyphVehicle: { minWidth: 32, height: 32, borderRadius: 16 },
  arrow: { position: "absolute", top: -6, alignSelf: "center" },
  label: { color: "#FFFFFF", fontSize: T.tiny, fontWeight: "900", marginTop: -2, maxWidth: 28 },
  labelActive: { color: COLORS.greenDark, fontSize: T.tiny },
});
