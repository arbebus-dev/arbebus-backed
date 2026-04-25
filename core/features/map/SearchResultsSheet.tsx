import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PlaceSearchResult } from "../transit/models/transitTypes";

type Props = {
  visible: boolean;
  results: PlaceSearchResult[];
  isLoading?: boolean;
  error?: string | null;
  onSelect: (result: PlaceSearchResult) => void;
};

function formatDistance(meters?: number) {
  if (!meters || meters <= 0) return "";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export default function SearchResultsSheet({
  visible,
  results,
  isLoading,
  error,
  onSelect,
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <Text style={styles.title}>Rezultatai</Text>

      {isLoading ? <ActivityIndicator style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoading && !results.length ? (
        <Text style={styles.empty}>Įvesk stotelę, adresą arba vietą.</Text>
      ) : null}

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
        {results.map((item) => (
          <Pressable key={item.id} style={styles.row} onPress={() => onSelect(item)}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={item.type === "stop" ? "bus" : "location"}
                size={18}
                color="#CFFFEA"
              />
            </View>

            <View style={styles.textBox}>
              <Text style={styles.resultTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.resultSubtitle} numberOfLines={2}>
                {[formatDistance(item.distanceMeters), item.subtitle].filter(Boolean).join(" • ")}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#7F8AB0" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "62%",
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 30,
    backgroundColor: "rgba(8, 13, 27, 0.97)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    zIndex: 25,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.24)",
    marginBottom: 14,
  },
  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  loader: { marginTop: 18 },
  list: { paddingBottom: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(58,255,184,0.14)",
  },
  textBox: { flex: 1 },
  resultTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  resultSubtitle: {
    color: "#98A4C6",
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    color: "#98A4C6",
    paddingVertical: 16,
  },
  error: {
    color: "#FF8F8F",
    paddingVertical: 10,
    fontWeight: "700",
  },
});
