import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { TransitStep } from "../transit/models/transitTypes";

type Props = { step: TransitStep };

function iconName(type: TransitStep["type"]) {
  if (type === "bus" || type === "board" || type === "ride") return "bus";
  if (type === "transfer") return "swap-horizontal";
  if (type === "arrive" || type === "alight") return "flag-checkered";
  return "walk";
}

export default function StepInstructionCard({ step }: Props) {
  const { theme } = useAppPreferences();
  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}> 
      <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}> 
        <MaterialCommunityIcons name={iconName(step.type) as any} color={theme.accent} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.text }]}>{step.title}</Text>
        {step.description ? <Text style={[styles.description, { color: theme.muted }]}>{step.description}</Text> : null}
        <Text style={[styles.meta, { color: theme.dim }]}> 
          {step.routeNumber ? `Autobusas ${step.routeNumber} · ` : ""}
          {step.stopCount ? `${step.stopCount} stotelės · ` : ""}
          {step.durationMinutes ? `${step.durationMinutes} min` : "Sek instrukcijas žemėlapyje"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 12, padding: 13, borderRadius: 20, borderWidth: 1, marginTop: 10 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "900" },
  description: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  meta: { fontSize: 12, fontWeight: "800", marginTop: 7 },
});
