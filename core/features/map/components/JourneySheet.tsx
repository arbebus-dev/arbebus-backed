import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PlannerState, TransitRouteOption, TransitStop } from "../../transit/models/transitRoute";

function StateText({ state }: { state: PlannerState }) {
  const text = state === "searching" ? "Ieškoma stotelių..." : state === "routes_loading" ? "Skaičiuojamas autobuso maršrutas..." : "Arbebus v1";
  return <Text style={styles.kicker}>{text}</Text>;
}

export default function JourneySheet({
  state,
  suggestions,
  selectedRoute,
  onSelectSuggestion,
  onGo,
}: {
  state: PlannerState;
  suggestions: TransitStop[];
  selectedRoute: TransitRouteOption | null;
  onSelectSuggestion: (stop: TransitStop) => void;
  onGo: () => void;
}) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView intensity={65} tint="light" style={styles.sheet}>
        <View style={styles.handle} />
        <StateText state={state} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {suggestions.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pasirink stotelę / vietą</Text>
              {suggestions.map((stop) => (
                <Pressable key={stop.id} onPress={() => onSelectSuggestion(stop)} style={styles.resultRow}>
                  <Ionicons name="bus-outline" size={18} color="#007AFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle}>{stop.name}</Text>
                    {stop.distanceMeters ? <Text style={styles.resultMeta}>{Math.round(stop.distanceMeters)} m nuo tavęs</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {selectedRoute ? (
            <View style={styles.section}>
              <Text style={styles.title}>{selectedRoute.title}</Text>
              <Text style={styles.subtitle}>{selectedRoute.subtitle}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}><Text style={styles.statValue}>{selectedRoute.totalMinutes || "—"}</Text><Text style={styles.statLabel}>min</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{selectedRoute.transfers}</Text><Text style={styles.statLabel}>persėdimai</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{selectedRoute.walkingMinutes}</Text><Text style={styles.statLabel}>ėjimas</Text></View>
              </View>
              {selectedRoute.steps.map((step, index) => (
                <View key={step.id ?? index} style={styles.stepRow}>
                  <View style={styles.stepDot}><Text style={styles.stepDotText}>{index + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    {step.description ? <Text style={styles.stepText}>{step.description}</Text> : null}
                    {step.routeNumber ? <Text style={styles.busBadge}>Autobusas {step.routeNumber}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.title}>Apple Maps for buses</Text>
              <Text style={styles.subtitle}>Įvesk tikslą, pasirink stotelę ir spausk GO. V1 palieka tik autobusus, stoteles, persėdimus ir ETA.</Text>
            </View>
          )}
        </ScrollView>

        <Pressable onPress={onGo} style={styles.goButton}>
          <Text style={styles.goText}>GO</Text>
        </Pressable>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 30 },
  sheet: {
    maxHeight: 390,
    minHeight: 235,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  handle: { alignSelf: "center", width: 46, height: 5, borderRadius: 99, backgroundColor: "#CBD5E1", marginBottom: 12 },
  kicker: { color: "#64748B", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  content: { paddingTop: 10, paddingBottom: 76 },
  section: { gap: 10 },
  sectionTitle: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(148,163,184,0.25)" },
  resultTitle: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  resultMeta: { color: "#64748B", marginTop: 2, fontSize: 12 },
  emptyCard: { padding: 14, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.62)", borderWidth: 1, borderColor: "rgba(226,232,240,0.9)" },
  title: { color: "#0F172A", fontSize: 20, fontWeight: "900" },
  subtitle: { color: "#475569", fontSize: 14, lineHeight: 20, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  stat: { flex: 1, borderRadius: 16, padding: 10, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" },
  statValue: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  statLabel: { color: "#64748B", fontSize: 11, fontWeight: "700" },
  stepRow: { flexDirection: "row", gap: 10, paddingVertical: 9 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#007AFF", alignItems: "center", justifyContent: "center" },
  stepDotText: { color: "white", fontWeight: "900", fontSize: 11 },
  stepTitle: { color: "#0F172A", fontWeight: "900" },
  stepText: { color: "#64748B", marginTop: 2, fontSize: 12, lineHeight: 17 },
  busBadge: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "#E0F2FE", color: "#0369A1", fontWeight: "900", overflow: "hidden" },
  goButton: { position: "absolute", left: 16, right: 16, bottom: 18, height: 54, borderRadius: 20, backgroundColor: "#007AFF", alignItems: "center", justifyContent: "center" },
  goText: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
});
