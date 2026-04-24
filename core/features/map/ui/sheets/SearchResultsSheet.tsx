import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PlaceSuggestion } from "../../../rideBooking/models";

export default function SearchResultsSheet({
  loading,
  results,
  onSelect,
}: {
  loading: boolean;
  results: PlaceSuggestion[];
  onSelect: (item: PlaceSuggestion) => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Paieškos rezultatai</Text>
        <Text style={styles.subtitle}>Adresai, stotelės ir vietos</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Ieškome tikslaus taško…</Text>
        </View>
      ) : null}

      {results.map((item) => (
        <Pressable key={`${item.id}-${item.title}`} onPress={() => onSelect(item)} style={styles.resultCard}>
          <View style={styles.resultIcon}><Ionicons name="location-outline" size={18} color="#111827" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.resultTitle}>{item.title}</Text>
            {!!item.subtitle && <Text style={styles.resultSubtitle}>{item.subtitle}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </Pressable>
      ))}

      {!loading && !results.length ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nieko neradome</Text>
          <Text style={styles.emptyText}>Pabandyk tikslesnį adresą, stotelės pavadinimą arba kitą paieškos frazę.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 10,
    gap: 12,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    color: "#64748B",
    marginTop: 4,
  },
  loadingBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "#64748B",
    fontWeight: "600",
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: {
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  resultSubtitle: {
    color: "#64748B",
    lineHeight: 18,
  },
  emptyBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: {
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  emptyText: {
    color: "#64748B",
    lineHeight: 18,
  },
});
