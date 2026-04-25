import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TransitStop } from "../transit/models/transitRoute";

type Props = {
  visible: boolean;
  results: TransitStop[];
  isSearching: boolean;
  query: string;
  onSelect: (stop: TransitStop) => void;
};

function distanceText(distance?: number) {
  if (!distance || !Number.isFinite(distance)) return "Stotelė / vieta";
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

export default function SearchResultsSheet({ visible, results, isSearching, query, onSelect }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <Text style={styles.title}>Rezultatai</Text>
        <Text style={styles.meta}>{query.trim().length >= 2 ? `${results.length} rasta` : "Įvesk bent 2 raides"}</Text>
      </View>

      {isSearching ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#69E1FF" />
          <Text style={styles.loadingText}>Ieškome stotelių...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {results.length === 0 ? (
            <Text style={styles.emptyText}>Įvesk stotelės arba vietos pavadinimą.</Text>
          ) : (
            results.map((stop) => (
              <Pressable key={stop.id} onPress={() => onSelect(stop)} style={styles.card}>
                <View style={styles.iconCircle}>
                  <Ionicons name="bus" size={18} color="#69E1FF" />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{stop.title}</Text>
                  <Text style={styles.cardSubtitle}>{stop.subtitle ?? distanceText(stop.distanceMeters)}</Text>
                </View>
                <View style={styles.directionsPill}>
                  <Text style={styles.directionsText}>Directions</Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 92,
    maxHeight: "54%",
    borderRadius: 28,
    backgroundColor: "rgba(6, 10, 20, 0.97)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 24,
  },
  handle: { width: 42, height: 5, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.22)", alignSelf: "center", marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  meta: { color: "#8E96B2", fontSize: 12, fontWeight: "800" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18 },
  loadingText: { color: "#CDD4EA", fontWeight: "800" },
  emptyText: { color: "#9AA3C1", fontSize: 15, lineHeight: 22, paddingVertical: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  iconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(105,225,255,0.14)", alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  cardSubtitle: { color: "#8E96B2", fontSize: 12, marginTop: 2, fontWeight: "700" },
  directionsPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(105,225,255,0.16)" },
  directionsText: { color: "#69E1FF", fontSize: 12, fontWeight: "900" },
});
