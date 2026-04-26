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
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={iconName(step.type) as any} color="#69E1FF" size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{step.title}</Text>
        {step.description ? <Text style={styles.description}>{step.description}</Text> : null}
        <Text style={styles.meta}>
          {step.routeNumber ? `Autobusas ${step.routeNumber} · ` : ""}
          {step.stopCount ? `${step.stopCount} stotelės · ` : ""}
          {step.durationMinutes ? `${step.durationMinutes} min` : "Sek instrukcijas žemėlapyje"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 13,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginTop: 10,
  },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(105,225,255,0.14)", alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  description: { color: "#CDD4EA", fontSize: 13, lineHeight: 19, marginTop: 3 },
  meta: { color: "#8E96B2", fontSize: 12, fontWeight: "800", marginTop: 7 },
});
