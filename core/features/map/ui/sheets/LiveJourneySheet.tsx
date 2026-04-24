import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Recommendation } from "../../../../../hooks/useSmartRoute";
import type { TransitPlan } from "../../../../services/transit/plannerTypes";
import RoutePreviewSheet from "./RoutePreviewSheet";

function getStatusText(status: string) {
  if (status === "board_now") return "Autobusas jau čia. Lipk dabar ir sek kelionės eigą žemėlapyje.";
  if (status === "near_stop") return "Eik iki stotelės ir pasiruošk įlipti. CTA keisis automatiškai pagal tavo vietą.";
  return "Aktyvi kelionė su gyvu statusu, persėdimais ir stop-by-stop eiga.";
}

export default function LiveJourneySheet({
  rideUiStatus,
  ctaLabel,
  recommendations,
  selectedRecommendationId,
  selectedRecommendation,
  transitPlan,
  onSelectRecommendation,
  onSaveFavorite,
}: {
  rideUiStatus: string;
  ctaLabel: string;
  recommendations: Recommendation[];
  selectedRecommendationId?: string;
  selectedRecommendation?: Recommendation | null;
  transitPlan?: TransitPlan | null;
  onSelectRecommendation: (id: string) => void;
  onSaveFavorite: () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
      <View style={styles.liveBanner}>
        <View style={styles.liveHeader}>
          <Text style={styles.liveKicker}>Gyva kelionė</Text>
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.livePillText}>LIVE</Text></View>
        </View>
        <Text style={styles.liveTitle}>{ctaLabel}</Text>
        <Text style={styles.liveText}>{getStatusText(rideUiStatus)}</Text>

        <View style={styles.miniStats}>
          <View style={styles.miniCard}>
            <Text style={styles.miniValue}>{transitPlan?.summary.nextStopName || "—"}</Text>
            <Text style={styles.miniLabel}>Kita stotelė</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniValue}>{transitPlan?.summary.approximateStopsRemaining ?? "—"}</Text>
            <Text style={styles.miniLabel}>Liko stotelių</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniValue}>{transitPlan?.summary.totalDurationMinutes || "—"} min</Text>
            <Text style={styles.miniLabel}>Visa eiga</Text>
          </View>
        </View>
      </View>

      <RoutePreviewSheet
        mode="live"
        ctaLabel={ctaLabel}
        recommendations={recommendations}
        selectedRecommendationId={selectedRecommendationId}
        selectedRecommendation={selectedRecommendation}
        transitPlan={transitPlan}
        onSelectRecommendation={onSelectRecommendation}
        onSaveFavorite={onSaveFavorite}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  liveBanner: { backgroundColor: "#DCFCE7", borderRadius: 24, padding: 15, marginBottom: 14, borderWidth: 1, borderColor: "#BBF7D0" },
  liveHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.55)" },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: "#22C55E" },
  livePillText: { color: "#166534", fontWeight: "800", fontSize: 11 },
  liveKicker: { color: "#166534", fontWeight: "800", fontSize: 12, textTransform: "uppercase", marginBottom: 4 },
  liveTitle: { color: "#14532D", fontWeight: "800", fontSize: 24 },
  liveText: { color: "#166534", marginTop: 6, lineHeight: 19 },
  miniStats: { gap: 8, marginTop: 12 },
  miniCard: { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 16, padding: 12 },
  miniValue: { color: "#14532D", fontWeight: "800", fontSize: 14 },
  miniLabel: { color: "#166534", marginTop: 4, fontSize: 12 },
});
