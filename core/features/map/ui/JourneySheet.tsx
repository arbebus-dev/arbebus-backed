import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { PlaceSuggestion } from "../../rideBooking/models";
import type { Recommendation } from "../../../../hooks/useSmartRoute";
import type { TransitPlan } from "../../../services/transit/plannerTypes";
import IdleSheet from "./sheets/IdleSheet";
import SearchResultsSheet from "./sheets/SearchResultsSheet";
import RoutePreviewSheet from "./sheets/RoutePreviewSheet";
import LiveJourneySheet from "./sheets/LiveJourneySheet";
import RideProgressSheet from "./sheets/RideProgressSheet";

type FavoriteRoute = {
  id: string;
  fromLabel: string;
  toLabel: string;
};

type SnapMode = "compact" | "medium" | "full";

function getStatusTone(status: string) {
  if (status === "board_now") return { bg: "#DCFCE7", text: "#166534", label: "Autobusas vietoje" };
  if (status === "exit_now") return { bg: "#FEF3C7", text: "#92400E", label: "Artėja išlipimas" };
  if (status === "ride_in_progress") return { bg: "#DBEAFE", text: "#1D4ED8", label: "Kelionė vyksta" };
  if (status === "near_stop") return { bg: "#E0F2FE", text: "#0369A1", label: "Artėji prie stotelės" };
  if (status === "journey_active") return { bg: "#F1F5F9", text: "#334155", label: "Aktyvi eiga" };
  if (status === "searching") return { bg: "#EEF2FF", text: "#4338CA", label: "Ieškoma" };
  return { bg: "#F8FAFC", text: "#475569", label: "Arbebus" };
}

export default function JourneySheet(props: {
  rideUiStatus: string;
  ctaLabel: string;
  favorites: FavoriteRoute[];
  onPressFavorite: (item: FavoriteRoute) => void;
  searchLoading: boolean;
  searchResults: PlaceSuggestion[];
  onSelectSuggestion: (item: PlaceSuggestion) => void;
  recommendations: Recommendation[];
  selectedRecommendationId?: string;
  selectedRecommendation?: Recommendation | null;
  transitPlan?: TransitPlan | null;
  onSelectRecommendation: (id: string) => void;
  onSaveFavorite: () => void;
}) {
  const {
    rideUiStatus,
    ctaLabel,
    favorites,
    onPressFavorite,
    searchLoading,
    searchResults,
    onSelectSuggestion,
    recommendations,
    selectedRecommendationId,
    selectedRecommendation,
    transitPlan,
    onSelectRecommendation,
    onSaveFavorite,
  } = props;

  const { height } = useWindowDimensions();
  const compactY = Math.max(0, height * 0.54);
  const mediumY = Math.max(0, height * 0.30);
  const fullY = Math.max(0, height * 0.10);

  const preferredSnap: SnapMode =
    rideUiStatus === "idle"
      ? "compact"
      : rideUiStatus === "searching"
      ? "medium"
      : "full";

  const [snapMode, setSnapMode] = useState<SnapMode>(preferredSnap);
  const translateY = useRef(
    new Animated.Value(preferredSnap === "compact" ? compactY : preferredSnap === "medium" ? mediumY : fullY)
  ).current;
  const dragStart = useRef(0);

  React.useEffect(() => {
    const target = preferredSnap === "compact" ? compactY : preferredSnap === "medium" ? mediumY : fullY;
    setSnapMode(preferredSnap);
    Animated.spring(translateY, {
      toValue: target,
      useNativeDriver: true,
      damping: 28,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [compactY, fullY, mediumY, preferredSnap, translateY]);

  const snapTo = React.useCallback(
    (mode: SnapMode) => {
      setSnapMode(mode);
      Haptics.selectionAsync().catch(() => {});
      const target = mode === "compact" ? compactY : mode === "medium" ? mediumY : fullY;
      Animated.spring(translateY, {
        toValue: target,
        useNativeDriver: true,
        damping: 28,
        stiffness: 220,
        mass: 0.9,
      }).start();
    },
    [compactY, fullY, mediumY, translateY]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderGrant: () => {
          dragStart.current = (translateY as any).__getValue?.() ?? 0;
        },
        onPanResponderMove: (_, gesture) => {
          const next = Math.max(fullY, Math.min(compactY, dragStart.current + gesture.dy));
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const current = Math.max(fullY, Math.min(compactY, dragStart.current + gesture.dy));
          const candidates = [
            { mode: "compact" as const, y: compactY },
            { mode: "medium" as const, y: mediumY },
            { mode: "full" as const, y: fullY },
          ];
          const picked = candidates.sort((a, b) => Math.abs(a.y - current) - Math.abs(b.y - current))[0];
          if (gesture.vy < -0.9) return snapTo("full");
          if (gesture.vy > 0.9) return snapTo("compact");
          snapTo(picked.mode);
        },
      }),
    [compactY, fullY, mediumY, snapTo, translateY]
  );

  let content = <IdleSheet favorites={favorites} onPressFavorite={onPressFavorite} />;

  if (rideUiStatus === "searching") {
    content = <SearchResultsSheet loading={searchLoading} results={searchResults} onSelect={onSelectSuggestion} />;
  } else if (["route_preview", "place_selected"].includes(rideUiStatus)) {
    content = (
      <RoutePreviewSheet
        mode="preview"
        ctaLabel={ctaLabel}
        recommendations={recommendations}
        selectedRecommendationId={selectedRecommendationId}
        selectedRecommendation={selectedRecommendation}
        transitPlan={transitPlan}
        onSelectRecommendation={onSelectRecommendation}
        onSaveFavorite={onSaveFavorite}
      />
    );
  } else if (["journey_active", "near_stop", "board_now"].includes(rideUiStatus)) {
    content = (
      <LiveJourneySheet
        rideUiStatus={rideUiStatus}
        ctaLabel={ctaLabel}
        recommendations={recommendations}
        selectedRecommendationId={selectedRecommendationId}
        selectedRecommendation={selectedRecommendation}
        transitPlan={transitPlan}
        onSelectRecommendation={onSelectRecommendation}
        onSaveFavorite={onSaveFavorite}
      />
    );
  } else if (["ride_in_progress", "exit_now", "arrived"].includes(rideUiStatus)) {
    content = (
      <RideProgressSheet
        title={
          rideUiStatus === "ride_in_progress"
            ? "Kelionė vyksta"
            : rideUiStatus === "exit_now"
            ? "Išlipk dabar"
            : "Atvykai"
        }
        transitPlan={transitPlan}
      />
    );
  }

  const tone = getStatusTone(rideUiStatus);

  return (
    <Animated.View style={[styles.sheetWrap, { transform: [{ translateY }] }]}> 
      <BlurView intensity={55} tint="light" style={styles.sheet}>
        <View style={styles.blurGlow} />
        <View style={styles.headerZone} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <View style={styles.topRow}>
            <View style={[styles.statusChip, { backgroundColor: tone.bg }]}> 
              <View style={[styles.statusDot, { backgroundColor: tone.text }]} />
              <Text style={[styles.statusChipText, { color: tone.text }]}>{tone.label}</Text>
            </View>
            <View style={styles.snapRow}>
              <Pressable onPress={() => snapTo("compact")} style={[styles.snapButton, snapMode === "compact" && styles.snapButtonActive]}>
                <Text style={[styles.snapButtonText, snapMode === "compact" && styles.snapButtonTextActive]}>Mini</Text>
              </Pressable>
              <Pressable onPress={() => snapTo("medium")} style={[styles.snapButton, snapMode === "medium" && styles.snapButtonActive]}>
                <Text style={[styles.snapButtonText, snapMode === "medium" && styles.snapButtonTextActive]}>Vidut.</Text>
              </Pressable>
              <Pressable onPress={() => snapTo("full")} style={[styles.snapButton, snapMode === "full" && styles.snapButtonActive]}>
                <Text style={[styles.snapButtonText, snapMode === "full" && styles.snapButtonTextActive]}>Pilnas</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.ctaTitle}>{ctaLabel}</Text>
        </View>
        <View style={styles.content}>{content}</View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: -40,
  },
  sheet: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 40,
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -10 },
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
  },
  blurGlow: {
    position: "absolute",
    top: 0,
    left: 40,
    right: 40,
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(191,219,254,0.35)",
  },
  headerZone: {
    paddingBottom: 12,
  },
  content: {
    flex: 1,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D4DCE8",
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  snapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  snapButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(248,250,252,0.85)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  snapButtonActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  snapButtonText: {
    color: "#64748B",
    fontWeight: "800",
    fontSize: 12,
  },
  snapButtonTextActive: {
    color: "#FFFFFF",
  },
  ctaTitle: {
    marginTop: 12,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
});
