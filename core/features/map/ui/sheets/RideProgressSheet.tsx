import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { TransitPlan } from "../../../../services/transit/plannerTypes";

function timeLabel(value?: string | null) {
  return value ? value.slice(0, 5) : null;
}

function buildProgressStops(transitPlan?: TransitPlan | null) {
  const rows: Array<{ key: string; title: string; subtitle?: string; time?: string | null; active?: boolean; badge?: string }> = [];
  const segments = transitPlan?.segments || [];

  segments.forEach((segment) => {
    if (segment.type === "walk") {
      rows.push({
        key: `walk-${segment.id}`,
        title: segment.label || "Eiti",
        subtitle: `${segment.fromName || "Pradžia"}${segment.toName ? ` → ${segment.toName}` : ""}${segment.durationMinutes ? ` • ${segment.durationMinutes} min` : ""}`,
        time: timeLabel(segment.departureTime || segment.arrivalTime),
        badge: "Walk",
      });
      return;
    }

    rows.push({
      key: `ride-${segment.id}`,
      title: segment.label || "Transportas",
      subtitle: `${segment.fromName || ""} → ${segment.toName || ""}`,
      time: timeLabel(segment.departureTime),
      badge: segment.mode === "train" ? "Train" : "Bus",
    });

    (segment.stops || []).forEach((stop, stopIndex) => {
      const active = Boolean(transitPlan?.summary.nextStopName && stop.stopName === transitPlan.summary.nextStopName);
      rows.push({
        key: `stop-${segment.id}-${stop.stopId}-${stopIndex}`,
        title: stop.stopName,
        subtitle: stop.isBoardStop ? "Įlipimo stotelė" : stop.isAlightStop ? "Išlipimo stotelė" : "Tarpinė stotelė",
        time: timeLabel(stop.arrivalTime || stop.departureTime),
        active,
        badge: stop.isBoardStop ? "Board" : stop.isAlightStop ? "Exit" : undefined,
      });
    });
  });

  return rows;
}

export default function RideProgressSheet({ title, transitPlan }: { title: string; transitPlan?: TransitPlan | null }) {
  const progressStops = buildProgressStops(transitPlan);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Active trip</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{transitPlan?.summary.routeLabel || "Kelionė"} • {transitPlan?.summary.boardStopName || "—"} → {transitPlan?.summary.alightStopName || "—"}</Text>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}><Text style={styles.infoValue}>{transitPlan?.summary.nextStopName || "—"}</Text><Text style={styles.infoLabel}>Kita stotelė</Text></View>
        <View style={styles.infoCard}><Text style={styles.infoValue}>{transitPlan?.summary.approximateStopsRemaining ?? "—"}</Text><Text style={styles.infoLabel}>Liko stotelių</Text></View>
        <View style={styles.infoCard}><Text style={styles.infoValue}>{transitPlan?.summary.totalDurationMinutes || "—"} min</Text><Text style={styles.infoLabel}>Visa kelionė</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kelionė stop by stop</Text>
        {progressStops.length ? (
          progressStops.map((step, index) => (
            <View key={step.key} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, step.active && styles.timelineDotActive]} />
                {index !== progressStops.length - 1 ? <View style={[styles.timelineLine, step.active && styles.timelineLineActive]} /> : null}
              </View>
              <View style={[styles.stepCard, step.active && styles.stepCardActive]}>
                <View style={styles.stepTitleRow}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  {!!step.time && <Text style={styles.stepTime}>{step.time}</Text>}
                </View>
                {!!step.subtitle && <Text style={styles.stepSubtitle}>{step.subtitle}</Text>}
                {!!step.badge && <View style={styles.badge}><Text style={styles.badgeText}>{step.badge}</Text></View>}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>Kol kas dar neturime stotelių sekos</Text>
            <Text style={styles.stepSubtitle}>Kai planneris grąžins pilną stop-by-stop seką, ji bus rodoma čia.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 8, gap: 14 },
  hero: { backgroundColor: "#0F172A", borderRadius: 26, padding: 16 },
  heroKicker: { color: "#93C5FD", fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  heroTitle: { color: "#FFFFFF", fontWeight: "800", fontSize: 26, marginTop: 6 },
  heroSubtitle: { color: "#CBD5E1", marginTop: 6, lineHeight: 19 },
  infoGrid: { gap: 8 },
  infoCard: { backgroundColor: "#F8FAFC", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  infoValue: { fontWeight: "800", color: "#111827", fontSize: 16 },
  infoLabel: { color: "#64748B", marginTop: 4, fontSize: 12 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#0F172A" },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineRail: { width: 18, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#CBD5E1", marginTop: 16 },
  timelineDotActive: { backgroundColor: "#1677FF", width: 12, height: 12 },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#E2E8F0", marginTop: 4 },
  timelineLineActive: { backgroundColor: "#BFDBFE" },
  stepCard: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  stepCardActive: { backgroundColor: "#EFF6FF", borderColor: "#60A5FA" },
  stepTitleRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  stepTitle: { flex: 1, fontWeight: "800", color: "#111827" },
  stepTime: { color: "#111827", fontWeight: "800" },
  stepSubtitle: { color: "#64748B", marginTop: 4, lineHeight: 18 },
  badge: { alignSelf: "flex-start", marginTop: 8, backgroundColor: "#E2E8F0", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: "#334155", fontWeight: "700", fontSize: 12 },
});
