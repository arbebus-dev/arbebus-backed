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

function iconForType(type?: string) {
  if (type === "stop") return "bus";
  if (type === "address") return "home";
  return "location";
}

function labelForType(type?: string) {
  if (type === "stop") return "Stotelė";
  if (type === "address") return "Adresas";
  return "Vieta";
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

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Rezultatai</Text>
          <Text style={styles.subtitle}>
            Pasirink vietą – Arbebus automatiškai parinks artimiausią stotelę.
          </Text>
        </View>

        {isLoading ? <ActivityIndicator color="#35F2B4" /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!isLoading && !results.length ? (
        <Text style={styles.empty}>
          Įvesk vietą, pvz. Akropolis, Palanga, Kretinga arba stotelės pavadinimą.
        </Text>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {results.map((item) => {
          const distance = formatDistance(item.distanceMeters);
          const meta = [labelForType(item.type), distance, item.subtitle]
            .filter(Boolean)
            .join(" • ");

          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
              onPress={() => onSelect(item)}
            >
              <View style={styles.iconCircle}>
                <Ionicons
                  name={iconForType(item.type) as any}
                  size={18}
                  color="#CFFFEA"
                />
              </View>

              <View style={styles.textBox}>
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {item.title}
                </Text>

                <Text style={styles.resultSubtitle} numberOfLines={2}>
                  {meta}
                </Text>
              </View>

              <View style={styles.goCircle}>
                <Ionicons name="navigate" size={17} color="#03110B" />
              </View>
            </Pressable>
          );
        })}
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
    maxHeight: "64%",
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 30,
    backgroundColor: "rgba(8, 13, 27, 0.985)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    zIndex: 40,
    elevation: 40,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.26)",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 8,
  },
  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    color: "#98A4C6",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    maxWidth: 300,
    lineHeight: 17,
  },
  list: {
    paddingBottom: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  rowPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.995 }],
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(58,255,184,0.14)",
  },
  textBox: {
    flex: 1,
  },
  resultTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },
  resultSubtitle: {
    color: "#98A4C6",
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  goCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35F2B4",
  },
  empty: {
    color: "#98A4C6",
    paddingVertical: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  error: {
    color: "#FF8F8F",
    paddingVertical: 10,
    fontWeight: "800",
  },
});