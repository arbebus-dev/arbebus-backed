import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { TransitRouteOption } from "../../transit/models/transitTypes";

export default function ChildGuideList({ route }: { route: TransitRouteOption | null }) {
  const guide = (route as any)?.childGuide || route?.journeySteps || [];
  if (!guide.length) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kelionė vaikui</Text>
      {guide.map((step: any, index: number) => (
        <View key={step.id || index} style={styles.row}>
          <Text style={styles.icon}>{step.icon || "•"}</Text>
          <View style={styles.body}>
            <Text style={styles.stepTitle}>{step.action || step.title}</Text>
            {!!step.subtitle && <Text style={styles.subtitle}>{step.subtitle}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", gap: 10 },
  title: { color: "white", fontSize: 15, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  icon: { width: 24, fontSize: 17 },
  body: { flex: 1 },
  stepTitle: { color: "white", fontSize: 14, fontWeight: "600" },
  subtitle: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 2 },
});
