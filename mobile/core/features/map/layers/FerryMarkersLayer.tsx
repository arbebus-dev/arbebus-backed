import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { COLORS } from "@/core/theme/typography";
import type { FerryTerminal } from "../../ferries/types";

export const FERRY_TERMINAL_MARKERS: FerryTerminal[] = [
  {
    id: "klaipeda-old-ferry-terminal",
    name: "Klaipėda, Senoji perkėla",
    shortName: "Klaipėda",
    latitude: 55.70617,
    longitude: 21.11855,
    address: "Žvejų g. 8, Klaipėda",
  },
  {
    id: "smiltyne-old-ferry-terminal",
    name: "Smiltynė, Senoji perkėla",
    shortName: "Smiltynė",
    latitude: 55.70706,
    longitude: 21.11252,
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

type Props = {
  visible?: boolean;
  selectedTerminalId?: string | null;
  onSelectTerminal?: (terminal: FerryTerminal) => void;
};

export default function FerryMarkersLayer({
  visible = true,
  selectedTerminalId,
  onSelectTerminal,
}: Props) {
  const { theme } = useAppPreferences();

  if (!visible) return null;

  return (
    <>
      {FERRY_TERMINAL_MARKERS.map((terminal) => {
        const selected = terminal.id === selectedTerminalId;
        return (
          <Marker
            key={terminal.id}
            coordinate={{ latitude: terminal.latitude, longitude: terminal.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={selected ? 60 : 25}
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
            <View style={[styles.markerTail, { backgroundColor: selected ? theme.accent : theme.surfaceStrong }]} />
          </Marker>
        );
      })}
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
  markerTail: {
    alignSelf: "center",
    width: 10,
    height: 10,
    borderRadius: 2,
    marginTop: -5,
    transform: [{ rotate: "45deg" }],
  },
});
