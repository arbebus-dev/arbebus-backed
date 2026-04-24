import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type SearchField = "from" | "to";

function FieldIcon({ field }: { field: SearchField }) {
  if (field === "from") return <Ionicons name="radio-button-on" size={14} color="#1677FF" />;
  return <Ionicons name="location" size={14} color="#111827" />;
}

export default function TopSearchBar({
  fromQuery,
  toQuery,
  activeField,
  onFocusField,
  onChangeQuery,
  onSwap,
  onClearField,
}: {
  fromQuery: string;
  toQuery: string;
  activeField: SearchField | null;
  onFocusField: (field: SearchField) => void;
  onChangeQuery: (value: string) => void;
  onSwap: () => void;
  onClearField: (field: SearchField) => void;
}) {
  const handleSwap = React.useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSwap();
  }, [onSwap]);

  const handleFocus = React.useCallback(
    (field: SearchField) => {
      Haptics.selectionAsync().catch(() => {});
      onFocusField(field);
    },
    [onFocusField]
  );

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView intensity={50} tint="light" style={styles.card}>
        <View style={styles.topMetaRow}>
          <View>
            <Text style={styles.eyebrow}>Arbebus</Text>
            <Text style={styles.title}>Kur važiuojam?</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.roundGhost} onPress={() => Haptics.selectionAsync().catch(() => {})}>
              <Ionicons name="mic-outline" size={18} color="#111827" />
            </Pressable>
            <Pressable style={styles.roundGhost} onPress={() => Haptics.selectionAsync().catch(() => {})}>
              <Ionicons name="options-outline" size={18} color="#111827" />
            </Pressable>
          </View>
        </View>

        <View style={styles.routeRail}>
          <View style={styles.railDots}>
            <View style={styles.railDotBlue} />
            <View style={styles.railLine} />
            <View style={styles.railDotDark} />
          </View>

          <View style={styles.routeFields}>
            <View style={[styles.fieldRow, activeField === "from" && styles.fieldRowActive]}>
              <FieldIcon field="from" />
              <TextInput
                style={styles.input}
                placeholder="Dabartinė vieta arba stotelė"
                placeholderTextColor="#94A3B8"
                value={fromQuery}
                onFocus={() => handleFocus("from")}
                onChangeText={onChangeQuery}
                returnKeyType="next"
              />
              {!!fromQuery && (
                <Pressable onPress={() => onClearField("from")} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              )}
            </View>

            <View style={[styles.fieldRow, activeField === "to" && styles.fieldRowActive, styles.fieldRowLast]}>
              <FieldIcon field="to" />
              <TextInput
                style={styles.input}
                placeholder="Kur nori nuvažiuoti?"
                placeholderTextColor="#94A3B8"
                value={toQuery}
                onFocus={() => handleFocus("to")}
                onChangeText={onChangeQuery}
                returnKeyType="search"
              />
              {!!toQuery && (
                <Pressable onPress={() => onClearField("to")} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </BlurView>

      <Pressable style={styles.swapButton} onPress={handleSwap}>
        <Ionicons name="swap-vertical" size={18} color="#111827" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 12,
    left: 14,
    right: 14,
    zIndex: 20,
  },
  card: {
    overflow: "hidden",
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.75)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  topMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  roundGhost: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
  },
  routeRail: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  railDots: {
    width: 12,
    alignItems: "center",
    paddingTop: 16,
  },
  railDotBlue: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#1677FF",
  },
  railLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: "#CBD5E1",
    marginVertical: 4,
    borderRadius: 999,
  },
  railDotDark: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  routeFields: {
    flex: 1,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(248,250,252,0.92)",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 8,
  },
  fieldRowLast: {
    marginBottom: 0,
  },
  fieldRowActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "rgba(255,255,255,0.98)",
    shadowColor: "#1677FF",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 9,
    fontWeight: "600",
  },
  swapButton: {
    position: "absolute",
    right: 16,
    top: 82,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
});
