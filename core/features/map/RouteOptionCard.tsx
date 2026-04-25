import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TransitRouteOption } from "../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption;
  selected: boolean;
  onPress: () => void;
};

export default function RouteOptionCard({ route, selected, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.routeNumbersRow}>
        {route.routeNumbers.map((number, index) => (
          <View key={`${number}-${index}`} style={styles.routeChip}>
            <Text style={styles.routeChipText}>{number}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{route.title}</Text>
        <Text style={styles.subtitle}>
          {Math.round(route.totalMinutes)} min · {route.walkingMinutes} min pėsčiomis · {route.transfers} persėdimai
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },
  cardSelected: {
    borderColor: "rgba(105,225,255,0.70)",
    backgroundColor: "rgba(105,225,255,0.10)",
  },
  routeNumbersRow: { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  routeChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "#69E1FF" },
  routeChipText: { color: "#06101C", fontSize: 12, fontWeight: "900" },
  title: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  subtitle: { color: "#9AA3C1", fontSize: 12, fontWeight: "700", marginTop: 3 },
});
