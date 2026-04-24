import * as Haptics from "expo-haptics";
import React, { Fragment, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Recommendation } from "../../../../../hooks/useSmartRoute";
import type { TransitJourneyStep, TransitPlan, TransitSegment } from "../../../../services/transit/plannerTypes";

type FilterMode = "now" | "fastest" | "fewTransfers";

function timeLabel(value?: string | null) {
  if (!value) return null;
  return value.slice(0, 5);
}

function getModeLabel(segment: TransitSegment) {
  if (segment.type === "walk" || segment.mode === "walk") return "Eiti";
  if (segment.mode === "train") return "Traukinys";
  return "Autobusas";
}

function getTimelineTitle(step: TransitJourneyStep) {
  return step.title || step.stopName || step.instruction || step.routeLabel || "Kelionės žingsnis";
}

function getTimelineSubtitle(step: TransitJourneyStep) {
  if (step.subtitle) return step.subtitle;
  if (step.mode === "walk") return step.instruction || "Eik iki kito taško";
  if (step.routeLabel && step.stopCount) return `${step.routeLabel} • ${step.stopCount} stotel.`;
  return step.instruction || "";
}

function buildStopByStopTimeline(plan?: TransitPlan | null) {
  const segments = plan?.segments || [];
  const rows: Array<{
    key: string;
    title: string;
    subtitle?: string;
    time?: string | null;
    kind: "walk" | "ride" | "stop";
    badge?: string;
    indexLabel?: string;
    active?: boolean;
  }> = [];

  segments.forEach((segment) => {
    if (segment.type === "walk") {
      rows.push({
        key: `walk-${segment.id}`,
        title: segment.label || "Eiti",
        subtitle: `${segment.fromName || "Pradžia"}${segment.toName ? ` → ${segment.toName}` : ""}${segment.durationMinutes ? ` • ${segment.durationMinutes} min` : ""}`,
        time: timeLabel(segment.departureTime || segment.arrivalTime),
        kind: "walk",
        badge: "Eiti",
      });
      return;
    }

    rows.push({
      key: `ride-${segment.id}`,
      title: segment.label || "Transportas",
      subtitle: `${segment.fromName || ""} → ${segment.toName || ""}${segment.stopCount ? ` • ${segment.stopCount} stotel.` : ""}`,
      time: timeLabel(segment.departureTime),
      kind: "ride",
      badge: segment.mode === "train" ? "Traukinys" : "Autobusas",
    });

    (segment.stops || []).forEach((stop, stopIndex) => {
      const active = Boolean(plan?.summary.nextStopName && stop.stopName === plan.summary.nextStopName);
      rows.push({
        key: `stop-${segment.id}-${stop.stopId}-${stopIndex}`,
        title: stop.stopName,
        subtitle: stop.isBoardStop ? "Įlipimo stotelė" : stop.isAlightStop ? "Išlipimo stotelė" : "Tarpinė stotelė",
        time: timeLabel(stop.arrivalTime || stop.departureTime),
        kind: "stop",
        badge: stop.isBoardStop ? "Board" : stop.isAlightStop ? "Exit" : undefined,
        indexLabel: String(stop.sequence ?? stopIndex + 1),
        active,
      });
    });
  });

  return rows;
}

function SummaryCard({ plan, ctaLabel }: { plan?: TransitPlan | null; ctaLabel: string }) {
  if (!plan) {
    return (
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>{ctaLabel}</Text>
        <Text style={styles.heroTitle}>Ieškome geriausio varianto</Text>
        <Text style={styles.heroText}>Parodysime visus maršrutus, autobusų numerius, persėdimus ir atvykimo laikus.</Text>
      </View>
    );
  }

  const alerts = plan.summary.alertSignals || [];
  const firstDeparture = plan.segments?.find((segment) => segment.departureTime)?.departureTime;
  const lastArrival = [...(plan.segments || [])].reverse().find((segment) => segment.arrivalTime)?.arrivalTime;

  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroLabel}>{ctaLabel}</Text>
      <Text style={styles.heroTitle}>{plan.summary.totalDurationMinutes || "—"} min</Text>
      <Text style={styles.heroText}>{plan.summary.boardStopName} → {plan.summary.alightStopName}</Text>
      <Text style={styles.heroMeta}>{timeLabel(firstDeparture) || "--:--"} – {timeLabel(lastArrival) || "--:--"} • {plan.summary.routeLabel || "Viešasis transportas"}</Text>

      <View style={styles.statRow}>
        <View style={styles.statChip}><Text style={styles.statValue}>{plan.summary.totalWalkMinutes || 0} min</Text><Text style={styles.statLabel}>Eiti</Text></View>
        <View style={styles.statChip}><Text style={styles.statValue}>{plan.summary.transfersCount || 0}</Text><Text style={styles.statLabel}>Persėdimai</Text></View>
        <View style={styles.statChip}><Text style={styles.statValue}>{plan.summary.stopCount || 0}</Text><Text style={styles.statLabel}>Stotelių</Text></View>
      </View>

      {alerts.length ? (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>{alerts[0].title}</Text>
          <Text style={styles.alertText}>{alerts[0].message}</Text>
        </View>
      ) : null}
    </View>
  );
}

function RecommendationCard({ item, active, onPress }: { item: Recommendation; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.optionCard, active && styles.optionCardActive]}>
      <View style={styles.optionTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>{item.title}</Text>
          {!!item.subtitle && <Text style={styles.optionSubtitle}>{item.subtitle}</Text>}
        </View>
        <View style={styles.optionRight}>
          {!!item.etaLabel && <Text style={styles.optionEta}>{item.etaLabel}</Text>}
          {!!item.price && <Text style={styles.optionPrice}>{item.price}</Text>}
        </View>
      </View>

      {!!item.description && <Text style={styles.description}>{item.description}</Text>}

      {!!item.journeyBadges?.length && (
        <View style={styles.badgeRow}>
          {item.journeyBadges.map((badge, index) => (
            <View key={`${badge.label}-${index}`} style={styles.badge}><Text style={styles.badgeText}>{badge.label}</Text></View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function SegmentBreakdown({ plan }: { plan?: TransitPlan | null }) {
  const segments = plan?.segments || [];
  if (!segments.length) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Kelionės eiga</Text>
      {segments.map((segment, index) => (
        <View key={segment.id} style={styles.segmentCard}>
          <View style={styles.segmentHeader}>
            <View style={styles.segmentPill}><Text style={styles.segmentPillText}>{index + 1}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.segmentType}>{getModeLabel(segment)}</Text>
              <Text style={styles.segmentTitle}>{segment.label || `${segment.fromName || ""} → ${segment.toName || ""}`}</Text>
            </View>
            <Text style={styles.segmentTimes}>{timeLabel(segment.departureTime) || "--:--"}{segment.arrivalTime ? ` → ${timeLabel(segment.arrivalTime)}` : ""}</Text>
          </View>
          <Text style={styles.segmentText}>{segment.fromName || "Pradžia"}{segment.toName ? ` → ${segment.toName}` : ""}{segment.stopCount ? ` • ${segment.stopCount} stotel.` : ""}{segment.durationMinutes ? ` • ${segment.durationMinutes} min` : ""}</Text>
        </View>
      ))}
    </View>
  );
}

function Timeline({ plan, recommendation }: { plan?: TransitPlan | null; recommendation?: Recommendation | null }) {
  const stopByStop = buildStopByStopTimeline(plan);
  const planSteps = plan?.journeySteps || [];
  const recommendationSteps = recommendation?.journeySteps || [];

  const fallbackSteps = planSteps.length
    ? planSteps.map((step, index) => ({
        key: `${getTimelineTitle(step)}-${step.departureTime || step.arrivalTime || index}`,
        title: getTimelineTitle(step),
        subtitle: getTimelineSubtitle(step),
        time: timeLabel(step.departureTime || step.arrivalTime),
        kind: step.mode === "walk" ? ("walk" as const) : ("ride" as const),
        badge: step.mode === "walk" ? "Eiti" : step.routeLabel || undefined,
        indexLabel: String(index + 1),
        active: false,
      }))
    : recommendationSteps.map((step, index) => ({
        key: `${step.title}-${index}`,
        title: step.title,
        subtitle: step.subtitle,
        time: null,
        kind: "ride" as const,
        badge: undefined,
        indexLabel: String(index + 1),
        active: false,
      }));

  const steps = stopByStop.length ? stopByStop : fallbackSteps;
  if (!steps.length) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Stotelės ir eiga</Text>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <View key={step.key} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, step.kind === "stop" && styles.timelineDotStop, step.kind === "walk" && styles.timelineDotWalk, step.active && styles.timelineDotActive]}>
                {!!step.indexLabel && <Text style={styles.timelineDotText}>{step.kind === "stop" ? "•" : step.indexLabel}</Text>}
              </View>
              {!isLast ? <View style={[styles.timelineLine, step.active && styles.timelineLineActive]} /> : null}
            </View>
            <View style={[styles.timelineContent, step.active && styles.timelineContentActive]}>
              <View style={styles.timelineTitleRow}>
                <Text style={styles.timelineTitle}>{step.title}</Text>
                {!!step.time && <Text style={styles.timelineTime}>{step.time}</Text>}
              </View>
              {!!step.subtitle && <Text style={styles.timelineSubtitle}>{step.subtitle}</Text>}
              {!!step.badge && (
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step.badge}</Text></View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function RoutePreviewSheet({
  mode = "preview",
  ctaLabel,
  recommendations,
  selectedRecommendationId,
  selectedRecommendation,
  transitPlan,
  onSelectRecommendation,
  onSaveFavorite,
}: {
  mode?: "preview" | "live";
  ctaLabel: string;
  recommendations: Recommendation[];
  selectedRecommendationId?: string;
  selectedRecommendation?: Recommendation | null;
  transitPlan?: TransitPlan | null;
  onSelectRecommendation: (id: string) => void;
  onSaveFavorite: () => void;
}) {
  const [showSteps, setShowSteps] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("now");
  const primaryRecommendation = useMemo(
    () => recommendations.find((item) => item.id === selectedRecommendationId) || selectedRecommendation || recommendations[0] || null,
    [recommendations, selectedRecommendation, selectedRecommendationId]
  );

  const handleToggleSteps = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setShowSteps((value) => !value);
  }, []);

  const handleFilter = React.useCallback((modeValue: FilterMode) => {
    Haptics.selectionAsync().catch(() => {});
    setFilterMode(modeValue);
  }, []);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <SummaryCard plan={transitPlan} ctaLabel={ctaLabel} />

      <View style={styles.filterRow}>
        {[
          { id: "now" as const, label: "Dabar" },
          { id: "fastest" as const, label: "Greičiausias" },
          { id: "fewTransfers" as const, label: "Mažiau persėdimų" },
        ].map((filter) => (
          <Pressable key={filter.id} onPress={() => handleFilter(filter.id)} style={[styles.filterChip, filterMode === filter.id && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, filterMode === filter.id && styles.filterChipTextActive]}>{filter.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Variantai</Text>
          <Text style={styles.sectionMeta}>{recommendations.length} rasti</Text>
        </View>

        {recommendations.length ? recommendations.map((item) => (
          <RecommendationCard key={item.id} item={item} active={item.id === selectedRecommendationId} onPress={() => onSelectRecommendation(item.id)} />
        )) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Kol kas neradome varianto</Text>
            <Text style={styles.emptyText}>Pabandyk tikslesnį adresą arba kitą išvykimo tašką.</Text>
          </View>
        )}
      </View>

      {!!primaryRecommendation && (
        <Fragment>
          <SegmentBreakdown plan={transitPlan} />
          <Pressable onPress={handleToggleSteps} style={styles.stepsToggle}>
            <View>
              <Text style={styles.stepsToggleTitle}>{showSteps ? "Slėpti eigą" : "Rodyti eigą"}</Text>
              <Text style={styles.stepsToggleSubtitle}>Pilna stotelių ir laikų eiga viename ekrane</Text>
            </View>
            <Text style={styles.stepsToggleAction}>{showSteps ? "Slėpti" : "Rodyti"}</Text>
          </Pressable>
          {showSteps ? <Timeline plan={transitPlan} recommendation={primaryRecommendation} /> : null}
        </Fragment>
      )}

      {mode === "preview" ? (
        <Pressable onPress={onSaveFavorite} style={styles.favoriteButton}>
          <Text style={styles.favoriteButtonText}>+ Išsaugoti kaip mėgstamą maršrutą</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 10, gap: 16 },
  heroCard: { backgroundColor: "#0F172A", borderRadius: 28, padding: 18, shadowColor: "#0F172A", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  heroLabel: { color: "#93C5FD", fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  heroTitle: { color: "#FFFFFF", fontWeight: "800", fontSize: 30, marginTop: 6, letterSpacing: -0.4 },
  heroText: { color: "#CBD5E1", marginTop: 6, lineHeight: 20 },
  heroMeta: { color: "#93C5FD", marginTop: 8, fontWeight: "700" },
  statRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statChip: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18, padding: 12 },
  statValue: { color: "#FFFFFF", fontWeight: "800", fontSize: 18 },
  statLabel: { color: "#93C5FD", marginTop: 4, fontSize: 12 },
  alertBox: { marginTop: 14, backgroundColor: "rgba(254,243,199,0.16)", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "rgba(254,240,138,0.22)" },
  alertTitle: { color: "#FDE68A", fontWeight: "800", marginBottom: 4 },
  alertText: { color: "#F8FAFC", lineHeight: 18 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { backgroundColor: "#F8FAFC", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1, borderColor: "#E2E8F0" },
  filterChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterChipText: { color: "#475569", fontWeight: "700", fontSize: 12 },
  filterChipTextActive: { color: "#FFFFFF" },
  section: { gap: 12 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#111827" },
  sectionMeta: { color: "#64748B", fontWeight: "700", fontSize: 12 },
  optionCard: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  optionCardActive: { borderColor: "#60A5FA", backgroundColor: "#EFF6FF", shadowColor: "#60A5FA", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  optionTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  optionTitle: { color: "#0F172A", fontWeight: "800", fontSize: 16 },
  optionSubtitle: { color: "#64748B", marginTop: 4, lineHeight: 18 },
  optionRight: { alignItems: "flex-end" },
  optionEta: { color: "#0F172A", fontWeight: "800", fontSize: 15 },
  optionPrice: { color: "#64748B", marginTop: 4, fontWeight: "700" },
  description: { color: "#475569", marginTop: 10, lineHeight: 18 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  badge: { backgroundColor: "#E2E8F0", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  emptyBox: { backgroundColor: "#F8FAFC", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  emptyTitle: { fontWeight: "800", color: "#111827", marginBottom: 4 },
  emptyText: { color: "#64748B", lineHeight: 18 },
  segmentCard: { backgroundColor: "#F8FAFC", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  segmentHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  segmentPill: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  segmentPillText: { color: "#FFFFFF", fontWeight: "800", fontSize: 12 },
  segmentType: { color: "#64748B", fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  segmentTitle: { color: "#0F172A", fontWeight: "800", marginTop: 2 },
  segmentTimes: { color: "#0F172A", fontWeight: "800", fontSize: 12 },
  segmentText: { color: "#64748B", marginTop: 8, lineHeight: 18 },
  stepsToggle: { backgroundColor: "#F8FAFC", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  stepsToggleTitle: { color: "#0F172A", fontWeight: "800" },
  stepsToggleSubtitle: { color: "#64748B", marginTop: 4, fontSize: 12 },
  stepsToggleAction: { color: "#1677FF", fontWeight: "800" },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineRail: { width: 22, alignItems: "center" },
  timelineDot: { width: 18, height: 18, borderRadius: 999, backgroundColor: "#111827", alignItems: "center", justifyContent: "center", marginTop: 4 },
  timelineDotStop: { backgroundColor: "#E2E8F0" },
  timelineDotWalk: { backgroundColor: "#CBD5E1" },
  timelineDotActive: { backgroundColor: "#1677FF" },
  timelineDotText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#E2E8F0", marginTop: 4 },
  timelineLineActive: { backgroundColor: "#BFDBFE" },
  timelineContent: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10 },
  timelineContentActive: { backgroundColor: "#EFF6FF", borderColor: "#60A5FA" },
  timelineTitleRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  timelineTitle: { flex: 1, color: "#0F172A", fontWeight: "800" },
  timelineTime: { color: "#0F172A", fontWeight: "800", fontSize: 12 },
  timelineSubtitle: { color: "#64748B", marginTop: 4, lineHeight: 18 },
  stepBadge: { alignSelf: "flex-start", marginTop: 8, backgroundColor: "#E2E8F0", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  stepBadgeText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  favoriteButton: { backgroundColor: "#111827", borderRadius: 20, paddingVertical: 15, alignItems: "center", justifyContent: "center", marginTop: 4 },
  favoriteButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
});
