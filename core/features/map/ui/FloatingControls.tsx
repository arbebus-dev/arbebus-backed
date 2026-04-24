import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TravelMode } from "../../../../types/home";

const MODES: Array<{ id: TravelMode; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { id: "smart", label: "Smart", icon: "brain" },
  { id: "bus", label: "Bus", icon: "bus" },
  { id: "walk", label: "Walk", icon: "walk" },
  { id: "taxi", label: "Taxi", icon: "taxi" },
];

export default function FloatingControls({
  selectedMode,
  onSelectMode,
  onLocate,
}: {
  selectedMode: TravelMode;
  onSelectMode: (mode: TravelMode) => void;
  onLocate: () => void;
}) {
  const handleMode = React.useCallback(
    (mode: TravelMode) => {
      Haptics.selectionAsync().catch(() => {});
      onSelectMode(mode);
    },
    [onSelectMode]
  );

  const handleLocate = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLocate();
  }, [onLocate]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView intensity={45} tint="light" style={styles.modeCard}>
        {MODES.map((mode) => {
          const active = selectedMode === mode.id;
          return (
            <Pressable key={mode.id} style={[styles.modeBtn, active && styles.modeBtnActive]} onPress={() => handleMode(mode.id)}>
              <MaterialCommunityIcons name={mode.icon} size={15} color={active ? "#FFFFFF" : "#111827"} />
              <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode.label}</Text>
            </Pressable>
          );
        })}
      </BlurView>

      <Pressable style={styles.locateBtn} onPress={handleLocate}>
        <Ionicons name="locate" size={20} color="#111827" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 14,
    top: 168,
    zIndex: 20,
    alignItems: "flex-end",
    gap: 12,
  },
  modeCard: {
    overflow: "hidden",
    borderRadius: 26,
    padding: 8,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.72)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
  },
  modeBtnActive: {
    backgroundColor: "#111827",
  },
  modeText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  modeTextActive: {
    color: "#FFFFFF",
  },
  locateBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.92)",
  },
});
