import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { COLORS, LINE_HEIGHT, T, UI } from "@/core/theme/typography";
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

export default function SearchResultsSheet({ visible, results, isLoading, error, onSelect }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Rezultatai</Text>
          <Text style={styles.subtitle}>Pasirink vietą – parinksime artimiausią stotelę.</Text>
        </View>
        {isLoading ? <ActivityIndicator color={COLORS.green} /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isLoading && !results.length ? <Text style={styles.empty}>Įvesk vietą arba stotelės pavadinimą.</Text> : null}
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {results.map((item) => {
          const distance = formatDistance(item.distanceMeters);
          const meta = [labelForType(item.type), distance, item.subtitle].filter(Boolean).join(" • ");
          return (
            <Pressable key={item.id} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => onSelect(item)}>
              <View style={styles.iconCircle}><Ionicons name={iconForType(item.type) as any} size={16} color="#CFFFEA" /></View>
              <View style={styles.textBox}>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.resultSubtitle} numberOfLines={1}>{meta}</Text>
              </View>
              <View style={styles.goCircle}><Ionicons name="navigate" size={15} color={COLORS.greenDark} /></View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "58%", paddingTop: 9, paddingHorizontal: UI.padXL, paddingBottom: 26, backgroundColor: "rgba(8, 13, 27, 0.985)", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.10)", zIndex: 40, elevation: 40 },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.26)", marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 7 },
  title: { color: "white", fontSize: T.section, lineHeight: LINE_HEIGHT.section, fontWeight: "900" },
  subtitle: { color: COLORS.muted, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginTop: 3 },
  list: { paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  rowPressed: { opacity: 0.7, transform: [{ scale: 0.995 }] },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(58,255,184,0.14)" },
  textBox: { flex: 1 },
  resultTitle: { color: "white", fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900" },
  resultSubtitle: { color: COLORS.muted, marginTop: 2, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700" },
  goCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.green },
  empty: { color: COLORS.muted, paddingVertical: 14, lineHeight: LINE_HEIGHT.body, fontSize: T.body, fontWeight: "700" },
  error: { color: "#FF8F8F", paddingVertical: 8, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700" },
});
