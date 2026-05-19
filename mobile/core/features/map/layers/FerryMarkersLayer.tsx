import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Marker, AnimatedRegion } from "react-native-maps";

import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { COLORS } from "@/core/theme/typography";
import type { FerryTerminal, LiveFerry } from "../../ferries/types";

export const FERRY_TERMINAL_MARKERS: FerryTerminal[] = [
  {
    id: "klaipeda-old-ferry-terminal",
    name: "Klaipėda, Senoji perkėla",
    shortName: "Senoji",
    latitude: 55.706551,
    longitude: 21.123784,
    address: "E. Galvanausko bulvaras 1, Klaipėda",
  },
  {
    id: "smiltyne-old-ferry-terminal",
    name: "Smiltynė, Senoji perkėla",
    shortName: "Senoji",
    latitude: 55.70706,
    longitude: 21.11252,
    address: "Smiltynė, Klaipėda",
  },
  {
    id: "klaipeda-new-ferry-terminal",
    name: "Klaipėda, Naujoji perkėla",
    shortName: "Naujoji",
    latitude: 55.688661,
    longitude: 21.138913,
    address: "Nemuno g. 8, Klaipėda",
  },
  {
    id: "smiltyne-new-ferry-terminal",
    name: "Smiltynė, Naujoji perkėla",
    shortName: "Naujoji",
    latitude: 55.68465,
    longitude: 21.12308,
    address: "Smiltynė, Klaipėda",
  },
  {
    id: "nida-passenger-pier",
    name: "Nida, keleivinė prieplauka",
    shortName: "Nida",
    latitude: 55.30272,
    longitude: 21.00817,
    address: "Nida, Neringa",
  },
];

type Coordinate = { latitude: number; longitude: number };

type Props = {
  visible?: boolean;
  selectedTerminalId?: string | null;
  selectedRoute?: any | null;
  liveFerries?: LiveFerry[];
  onSelectTerminal?: (terminal: FerryTerminal) => void;
  onSelectLiveFerry?: (ferry: LiveFerry) => void;
};

function coordinateFromFerry(ferry: LiveFerry): Coordinate | null {
  const latitude = Number(ferry.latitude ?? ferry.coordinate?.latitude);
  const longitude = Number(ferry.longitude ?? ferry.coordinate?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function selectedFerryRouteIds(selectedRoute: any | null | undefined) {
  const ids = new Set<string>();
  const direct = selectedRoute?.ferryRouteId || selectedRoute?.routeId;
  if (direct) ids.add(String(direct));

  const steps = selectedRoute?.journeySteps || selectedRoute?.steps || [];
  for (const step of steps) {
    const type = String(step?.type || step?.mode || "").toLowerCase();
    if (type.includes("ferry") || type.includes("kelt")) {
      if (step.routeId) ids.add(String(step.routeId));
      if (step.ferryRouteId) ids.add(String(step.ferryRouteId));
    }
  }

  return ids;
}

function terminalAllowedByRoute(terminal: FerryTerminal, route: any | null | undefined) {
  if (!route) return true;
  const allowed = new Set<string>();
  const steps = route?.journeySteps || route?.steps || [];

  for (const step of steps) {
    const type = String(step?.type || step?.mode || "").toLowerCase();
    if (!type.includes("ferry") && !type.includes("kelt")) continue;
    for (const stop of [step.fromStop, step.toStop, ...(Array.isArray(step.stops) ? step.stops : [])]) {
      if (stop?.id) allowed.add(String(stop.id));
      if (stop?.stopId) allowed.add(String(stop.stopId));
    }
  }

  if (route.originStop?.id) allowed.add(String(route.originStop.id));
  if (route.destinationStop?.id) allowed.add(String(route.destinationStop.id));

  return !allowed.size || allowed.has(terminal.id);
}

function liveFerryAllowed(ferry: LiveFerry, route: any | null | undefined) {
  if (!route) return true;
  const ids = selectedFerryRouteIds(route);
  return !ids.size || ids.has(ferry.routeId) || (ferry.routeCode ? ids.has(ferry.routeCode) : false);
}

const LiveFerryMarker = memo(function LiveFerryMarker({ ferry, active, onPress }: { ferry: LiveFerry; active: boolean; onPress?: () => void }) {
  const { theme } = useAppPreferences();
  const coordinate = coordinateFromFerry(ferry);
  const initial = coordinate || { latitude: 55.7, longitude: 21.12 };
  const animatedCoordinate = useRef(
    new AnimatedRegion({ latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 0, longitudeDelta: 0 }),
  ).current;
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    if (!coordinate) return;
    setTracks(true);
    animatedCoordinate
      .timing({ latitude: coordinate.latitude, longitude: coordinate.longitude, duration: 14500, useNativeDriver: false } as any)
      .start(() => setTimeout(() => setTracks(false), 480));
  }, [animatedCoordinate, coordinate?.latitude, coordinate?.longitude]);

  if (!coordinate) return null;

  const sailing = String(ferry.status).toLowerCase() === "sailing";
  const label = ferry.pierName || ferry.ferryLine || ferry.title;
  const heading = Number(ferry.heading ?? ferry.bearing ?? 0);

  return (
    <Marker.Animated
      coordinate={animatedCoordinate as any}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks || active}
      zIndex={active ? 7000 : sailing ? 4500 : 2200}
      onPress={onPress}
    >
      <View style={styles.liveMarkerWrap}>
        {active || sailing ? <View style={[styles.liveGlow, { backgroundColor: sailing ? "rgba(77,166,255,0.22)" : "rgba(255,255,255,0.12)" }]} /> : null}
        <Animated.View
          style={[
            styles.liveMarker,
            active && styles.liveMarkerActive,
            { backgroundColor: sailing ? "#4DA6FF" : theme.surfaceStrong, borderColor: active ? theme.accent : "rgba(255,255,255,0.92)" },
          ]}
        >
          <View style={{ transform: [{ rotate: `${heading}deg` }] }}>
            <MaterialCommunityIcons name="ferry" size={active ? 22 : 18} color={sailing ? "#FFFFFF" : COLORS.green} />
          </View>
          {active ? (
            <Text style={[styles.liveLabel, { color: sailing ? "#FFFFFF" : theme.text }]} numberOfLines={1}>
              {label}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Marker.Animated>
  );
});

export default function FerryMarkersLayer({
  visible = true,
  selectedTerminalId,
  selectedRoute,
  liveFerries = [],
  onSelectTerminal,
  onSelectLiveFerry,
}: Props) {
  const { theme } = useAppPreferences();

  const filteredTerminals = useMemo(
    () => FERRY_TERMINAL_MARKERS.filter((terminal) => terminalAllowedByRoute(terminal, selectedRoute)),
    [selectedRoute],
  );

  const filteredLiveFerries = useMemo(
    () => (liveFerries || []).filter((ferry) => liveFerryAllowed(ferry, selectedRoute)),
    [liveFerries, selectedRoute],
  );

  if (!visible) return null;

  return (
    <>
      {filteredTerminals.map((terminal) => {
        const selected = terminal.id === selectedTerminalId;
        return (
          <Marker
            key={terminal.id}
            coordinate={{ latitude: terminal.latitude, longitude: terminal.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={selected ? 1600 : 250}
            tracksViewChanges={false}
            onPress={() => onSelectTerminal?.(terminal)}
          >
            <View
              style={[
                styles.markerWrap,
                selected && styles.markerWrapSelected,
                {
                  backgroundColor: theme.surfaceStrong,
                  borderColor: selected ? theme.accent : theme.borderStrong,
                  shadowColor: selected ? theme.accent : "#000",
                },
              ]}
            >
              <MaterialCommunityIcons name="ferry" size={selected ? 20 : 17} color={COLORS.green} />
              {selected ? (
                <Text style={[styles.markerLabel, { color: theme.text }]} numberOfLines={1}>
                  {terminal.shortName || terminal.name}
                </Text>
              ) : null}
            </View>
          </Marker>
        );
      })}

      {filteredLiveFerries.map((ferry) => (
        <LiveFerryMarker
          key={ferry.id || ferry.routeId}
          ferry={ferry}
          active={Boolean(selectedRoute && liveFerryAllowed(ferry, selectedRoute))}
          onPress={() => onSelectLiveFerry?.(ferry)}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    flexDirection: "row",
    gap: 5,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  markerWrapSelected: {
    minWidth: 92,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    transform: [{ scale: 1.08 }],
  },
  markerLabel: {
    maxWidth: 78,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
  },
  liveMarkerWrap: {
    width: 70,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  liveGlow: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  liveMarker: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    flexDirection: "row",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  liveMarkerActive: {
    minWidth: 118,
    height: 44,
    borderRadius: 22,
    transform: [{ scale: 1.05 }],
  },
  liveLabel: {
    maxWidth: 82,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
  },
});
