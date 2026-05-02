import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  TransitFlowState,
  TransitRouteOption,
  TransitStep,
} from "../transit/models/transitTypes";
import {
  fetchDepartures,
  type DepartureBoardItem,
} from "../transit/services/transitApi";

type Props = {
  flowState: TransitFlowState;
  liveBusCount: number;
  routeOptions: TransitRouteOption[];
  selectedRoute: TransitRouteOption | null;
  error?: string | null;
  isOffline?: boolean;
  offlineMessage?: string | null;
  isRerouting?: boolean;
  reroutingMessage?: string | null;
  onChooseRoute: (route: TransitRouteOption) => void;
  onStartJourney: () => void;
  onNextStep: () => void;
  onReset: () => void;
};

type SnapPoint = "peek" | "medium" | "full";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SNAP_HEIGHTS: Record<SnapPoint, number> = {
  peek: 188,
  medium: Math.min(520, SCREEN_HEIGHT * 0.56),
  full: Math.min(820, SCREEN_HEIGHT * 0.9),
};

function nearestSnap(height: number): SnapPoint {
  const entries = Object.entries(SNAP_HEIGHTS) as Array<[SnapPoint, number]>;
  return entries.reduce((best, current) =>
    Math.abs(current[1] - height) < Math.abs(best[1] - height) ? current : best
  )[0];
}

function safeNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function routeNumbersFrom(route: TransitRouteOption | null) {
  if (!route) return [];
  const fromRoute = Array.isArray(route.routeNumbers)
    ? route.routeNumbers
    : String(route.routeLabel || route.routeId || "")
        .split("→")
        .map((part) => part.trim());

  const fromSteps = (route.journeySteps || route.steps || [])
    .filter((step) => ["board", "ride", "bus"].includes(step.type))
    .map((step) => String(step.routeNumber || step.routeLabel || step.routeId || "").trim());

  return Array.from(
    new Set([...fromRoute, ...fromSteps].map((value) => value.split("•")[0].trim()).filter(Boolean))
  );
}

function summaryFor(route: TransitRouteOption | null) {
  if (!route) {
    return {
      duration: 0,
      walk: 0,
      bus: 0,
      transfers: 0,
      stops: 0,
      eta: null as number | null,
      numbers: [] as string[],
    };
  }

  const duration = safeNumber(route.totalDurationMinutes || route.totalMinutes, 0);
  const walk = safeNumber(route.totalWalkMinutes || route.walkingMinutes, 0);
  const bus = safeNumber(route.totalBusMinutes, Math.max(0, duration - walk));
  const numbers = routeNumbersFrom(route);
  const transfers = Math.max(safeNumber(route.transfersCount || route.transfers, 0), Math.max(0, numbers.length - 1));
  const eta = route.liveEta?.etaMinutes ?? route.etaMinutes ?? null;

  return {
    duration,
    walk,
    bus,
    transfers,
    stops: safeNumber(route.stopCount, 0),
    eta: eta == null ? null : safeNumber(eta, 0),
    numbers,
  };
}

function activeStepIndex(flowState: TransitFlowState, steps: TransitStep[]) {
  if (!steps.length) return -1;
  if (flowState === "walking_to_stop") return steps.findIndex((s) => s.type === "walk");
  if (flowState === "waiting_bus") return steps.findIndex((s) => s.type === "board");
  if (flowState === "onboard") return steps.findIndex((s) => s.type === "ride" || s.type === "bus");
  if (flowState === "transfer") return steps.findIndex((s) => s.type === "transfer");
  if (flowState === "arriving") return steps.findIndex((s) => s.type === "alight" || s.type === "arrive");
  return 0;
}

function stepIcon(step: TransitStep) {
  if (step.type === "walk") return "walk";
  if (step.type === "transfer") return "swap-horizontal";
  if (step.type === "alight" || step.type === "arrive") return "flag-checkered";
  return "bus";
}

function stepBadge(step: TransitStep) {
  if (step.type === "walk") return "EIK";
  if (step.type === "board") return "LIPK";
  if (step.type === "ride" || step.type === "bus") return "VAŽIUOK";
  if (step.type === "transfer") return "PERSĖSK";
  if (step.type === "alight" || step.type === "arrive") return "IŠLIPK";
  return "STEP";
}

function activeCta(flowState: TransitFlowState, route: TransitRouteOption | null) {
  const summary = summaryFor(route);
  const board = route?.boardStopName || route?.originStop?.name || "įlipimo stotelės";
  const alight = route?.alightStopName || route?.destinationStop?.name || "išlipimo stotelės";
  const line = summary.numbers.join(" → ") || route?.routeLabel || "autobusą";

  if (flowState === "walking_to_stop") {
    return { title: "Eik iki stotelės", subtitle: `Iki „${board}“ • ${summary.walk || 2} min`, button: "TOLIAU", icon: "walk" };
  }
  if (flowState === "waiting_bus" || flowState === "route_selected" || flowState === "route_options") {
    return {
      title: summary.eta != null ? `Autobusas po ${summary.eta} min` : "Pasiruošk įlipti",
      subtitle: `Linija ${line} • stotelė „${board}“`,
      button: flowState === "route_options" ? "PASIRINKTI" : "GO",
      icon: "bus",
    };
  }
  if (flowState === "onboard") {
    return { title: `Važiuok iki „${alight}“`, subtitle: `${summary.stops || "?"} stotelės • sek išlipimo įspėjimą`, button: "KITAS", icon: "navigation-variant" };
  }
  if (flowState === "transfer") {
    return { title: "Persėdimas", subtitle: `Toliau: ${line}`, button: "KITAS", icon: "swap-horizontal" };
  }
  if (flowState === "arriving") {
    return { title: "Išlipk dabar", subtitle: `Stotelė „${alight}“`, button: "BAIGTI", icon: "flag-checkered" };
  }
  return { title: "Arbebus Transit", subtitle: "Rinkis tikslą ir gauk realų maršrutą.", button: "GO", icon: "map-search" };
}

function RoutePills({ numbers }: { numbers: string[] }) {
  if (!numbers.length) return null;
  return (
    <View style={styles.pillsRow}>
      {numbers.map((number, index) => (
        <React.Fragment key={`${number}-${index}`}>
          <View style={styles.routePill}>
            <Text style={styles.routePillText}>{number}</Text>
          </View>
          {index < numbers.length - 1 ? <Ionicons name="chevron-forward" size={15} color="#35F2B4" /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

function DepartureBoard({ stopId }: { stopId?: string | number | null }) {
  const [items, setItems] = useState<DepartureBoardItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!stopId) {
      setItems([]);
      return;
    }
    setLoading(true);
    fetchDepartures(stopId)
      .then((result) => {
        if (!cancelled) setItems(result.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stopId]);

  return (
    <View style={styles.boardCard}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Išvykimai iš stotelės</Text>
        {loading ? <ActivityIndicator size="small" color="#35F2B4" /> : null}
      </View>
      {items.length ? (
        items.map((item) => (
          <View key={`${item.tripId}-${item.departureTime}`} style={styles.departureRow}>
            <View style={styles.departureLine}><Text style={styles.departureLineText}>{item.routeLabel || item.routeId || "—"}</Text></View>
            <View style={styles.departureMain}>
              <Text style={styles.departureHead} numberOfLines={1}>{item.headsign || "Klaipėda"}</Text>
              <Text style={styles.departureMeta}>{item.departureTime || item.arrivalTime || "—"}</Text>
            </View>
            <Text style={styles.departureEta}>{item.countdownMinutes != null ? `${item.countdownMinutes} min` : ""}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Tvarkaraštis nerastas arba stotelė dar nepasirinkta.</Text>
      )}
    </View>
  );
}

function RouteOption({ route, selected, onPress }: { route: TransitRouteOption; selected: boolean; onPress: () => void }) {
  const summary = summaryFor(route);
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.routeCard, selected && styles.routeCardActive]}
    >
      <View style={styles.routeCardTop}>
        <RoutePills numbers={summary.numbers} />
        <Text style={styles.durationText}>{summary.duration || "?"} min</Text>
      </View>
      <Text style={styles.routeSubtitle} numberOfLines={2}>
        {route.journeyMessage || route.subtitle || `${summary.walk} min pėsčiomis • ${summary.bus} min autobusu`}
      </Text>
      <View style={styles.metricsRow}>
        <Text style={styles.metric}>{summary.transfers ? `${summary.transfers} pers.` : "tiesiogiai"}</Text>
        <Text style={styles.metric}>{summary.stops ? `${summary.stops} st.` : "stotelės"}</Text>
        <Text style={styles.metric}>{summary.eta != null ? `ETA ${summary.eta} min` : "GTFS"}</Text>
      </View>
    </Pressable>
  );
}

function StepsList({ route, flowState }: { route: TransitRouteOption | null; flowState: TransitFlowState }) {
  const steps = route?.journeySteps || route?.steps || [];
  const activeIndex = activeStepIndex(flowState, steps);

  if (!steps.length) return null;

  return (
    <View style={styles.stepsCard}>
      <Text style={styles.sectionTitle}>Kelionės žingsniai</Text>
      {steps.map((step, index) => {
        const active = index === activeIndex || (activeIndex < 0 && index === 0);
        return (
          <View key={step.id || index} style={styles.stepRow}>
            <View style={[styles.stepIcon, active && styles.stepIconActive]}>
              <MaterialCommunityIcons name={stepIcon(step) as any} size={16} color={active ? "#06111F" : "#35F2B4"} />
            </View>
            <View style={styles.stepLineWrap}>{index < steps.length - 1 ? <View style={styles.stepLine} /> : null}</View>
            <View style={styles.stepBody}>
              <View style={styles.stepTitleRow}>
                <Text style={[styles.stepTitle, active && styles.stepTitleActive]} numberOfLines={1}>{step.title}</Text>
                <Text style={styles.stepBadge}>{stepBadge(step)}</Text>
              </View>
              <Text style={styles.stepSubtitle} numberOfLines={2}>
                {step.subtitle || step.description || step.stopName || step.toStopName || "Sek nurodymą žemėlapyje."}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function JourneySheet({
  flowState,
  liveBusCount,
  routeOptions,
  selectedRoute,
  error,
  isOffline,
  offlineMessage,
  isRerouting,
  reroutingMessage,
  onChooseRoute,
  onStartJourney,
  onNextStep,
  onReset,
}: Props) {
  const [snap, setSnap] = useState<SnapPoint>("medium");
  const height = useRef(new Animated.Value(SNAP_HEIGHTS.medium)).current;
  const startHeight = useRef(SNAP_HEIGHTS.medium);

  const options = routeOptions.length ? routeOptions : selectedRoute ? [selectedRoute] : [];
  const summary = summaryFor(selectedRoute || options[0] || null);
  const cta = activeCta(flowState, selectedRoute || options[0] || null);
  const originStop: any = selectedRoute?.originStop || null;
  const stopId = originStop?.id || originStop?.stopId || originStop?.stop_id || null;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderGrant: () => {
          startHeight.current = SNAP_HEIGHTS[snap];
        },
        onPanResponderMove: (_event, gesture) => {
          const next = Math.max(SNAP_HEIGHTS.peek, Math.min(SNAP_HEIGHTS.full, startHeight.current - gesture.dy));
          height.setValue(next);
        },
        onPanResponderRelease: (_event, gesture) => {
          const targetSnap = nearestSnap(startHeight.current - gesture.dy);
          setSnap(targetSnap);
          Animated.spring(height, {
            toValue: SNAP_HEIGHTS[targetSnap],
            useNativeDriver: false,
            damping: 24,
            stiffness: 190,
            mass: 0.9,
          }).start();
        },
      }),
    [height, snap]
  );

  useEffect(() => {
    const nextSnap: SnapPoint = flowState === "route_options" ? "full" : selectedRoute ? "medium" : "peek";
    setSnap(nextSnap);
    Animated.spring(height, { toValue: SNAP_HEIGHTS[nextSnap], useNativeDriver: false, damping: 24, stiffness: 180 }).start();
  }, [flowState, height, selectedRoute]);

  const primaryPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (flowState === "route_options" && options[0]) {
      onChooseRoute(options[0]);
      return;
    }
    if (flowState === "route_selected") {
      onStartJourney();
      return;
    }
    if (["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving"].includes(flowState)) {
      onNextStep();
      return;
    }
  };

  return (
    <Animated.View style={[styles.sheet, { height }]}>
      <View {...panResponder.panHandlers} style={styles.dragZone}>
        <View style={styles.handle} />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>{liveBusCount} LIVE</Text>
          </View>
          <Pressable onPress={onReset} style={styles.closeButton}>
            <Ionicons name="close" size={18} color="#EAFBF4" />
          </Pressable>
        </View>

        <View style={styles.heroMain}>
          <View style={styles.heroIcon}><MaterialCommunityIcons name={cta.icon as any} size={22} color="#06111F" /></View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle} numberOfLines={1}>{cta.title}</Text>
            <Text style={styles.heroSubtitle} numberOfLines={2}>{isRerouting ? reroutingMessage || "Perskaičiuojamas maršrutas…" : cta.subtitle}</Text>
          </View>
          <Pressable onPress={primaryPress} style={styles.goButton}>
            <Text style={styles.goButtonText}>{cta.button}</Text>
          </Pressable>
        </View>

        <View style={styles.metricsRowHero}>
          <Text style={styles.heroMetric}>{summary.duration || "—"} min</Text>
          <Text style={styles.heroMetric}>{summary.walk || 0} min eiti</Text>
          <Text style={styles.heroMetric}>{summary.transfers ? `${summary.transfers} pers.` : "tiesiogiai"}</Text>
        </View>
      </View>

      {isOffline ? <Text style={styles.warningText}>{offlineMessage || "Offline režimas: rodoma paskutinė saugota kelionė."}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {flowState === "routes_loading" ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color="#35F2B4" />
            <Text style={styles.loadingText}>Skaičiuoju GTFS + live GPS maršrutus…</Text>
          </View>
        ) : null}

        {options.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Maršruto alternatyvos</Text>
            {options.slice(0, 4).map((route) => (
              <RouteOption key={route.id} route={route} selected={selectedRoute?.id === route.id} onPress={() => onChooseRoute(route)} />
            ))}
          </View>
        ) : null}

        {selectedRoute ? <DepartureBoard stopId={stopId} /> : null}
        {selectedRoute ? <StepsList route={selectedRoute} flowState={flowState} /> : null}

        <View style={styles.footerSpace} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    borderRadius: 30,
    backgroundColor: "rgba(5,7,13,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.36,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  dragZone: { height: 26, alignItems: "center", justifyContent: "center" },
  handle: { width: 44, height: 5, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.28)" },
  heroCard: { marginHorizontal: 12, padding: 14, borderRadius: 24, backgroundColor: "rgba(17,24,39,0.92)", borderWidth: 1, borderColor: "rgba(53,242,180,0.18)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(53,242,180,0.12)", borderWidth: 1, borderColor: "rgba(53,242,180,0.28)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#35F2B4" },
  liveBadgeText: { color: "#BFFFF0", fontSize: 11, fontWeight: "900" },
  closeButton: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  heroMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#35F2B4" },
  heroTextWrap: { flex: 1 },
  heroTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  heroSubtitle: { color: "rgba(234,251,244,0.72)", marginTop: 3, fontSize: 12, lineHeight: 17 },
  goButton: { minWidth: 72, height: 42, paddingHorizontal: 14, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  goButtonText: { color: "#06111F", fontSize: 12, fontWeight: "900" },
  metricsRowHero: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  heroMetric: { color: "#35F2B4", fontSize: 11, fontWeight: "900", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(53,242,180,0.10)" },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingTop: 10 },
  warningText: { color: "#FFD27A", marginHorizontal: 18, marginTop: 8, fontSize: 12, fontWeight: "700" },
  errorText: { color: "#FF8A8A", marginHorizontal: 18, marginTop: 8, fontSize: 12, fontWeight: "700" },
  loadingCard: { padding: 18, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  loadingText: { color: "#EAFBF4", fontWeight: "800" },
  section: { gap: 10 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", marginBottom: 8 },
  routeCard: { padding: 14, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", marginBottom: 10 },
  routeCardActive: { borderColor: "rgba(53,242,180,0.82)", backgroundColor: "rgba(53,242,180,0.12)" },
  routeCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pillsRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 },
  routePill: { minWidth: 34, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, backgroundColor: "#35F2B4" },
  routePillText: { color: "#06111F", fontSize: 13, fontWeight: "900" },
  durationText: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  routeSubtitle: { color: "rgba(234,251,244,0.72)", marginTop: 9, fontSize: 12, lineHeight: 17 },
  metricsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 10 },
  metric: { color: "rgba(234,251,244,0.78)", fontSize: 11, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)" },
  boardCard: { marginTop: 4, padding: 14, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  departureRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" },
  departureLine: { minWidth: 38, height: 30, borderRadius: 15, backgroundColor: "#35F2B4", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  departureLineText: { color: "#06111F", fontSize: 12, fontWeight: "900" },
  departureMain: { flex: 1, marginLeft: 10 },
  departureHead: { color: "#FFFFFF", fontSize: 13, fontWeight: "850" },
  departureMeta: { color: "rgba(234,251,244,0.58)", fontSize: 11, marginTop: 2 },
  departureEta: { color: "#35F2B4", fontSize: 12, fontWeight: "900" },
  emptyText: { color: "rgba(234,251,244,0.58)", fontSize: 12, lineHeight: 18 },
  stepsCard: { marginTop: 12, padding: 14, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", minHeight: 62 },
  stepIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(53,242,180,0.10)", borderWidth: 1, borderColor: "rgba(53,242,180,0.34)" },
  stepIconActive: { backgroundColor: "#35F2B4", borderColor: "#FFFFFF" },
  stepLineWrap: { width: 1, alignItems: "center" },
  stepLine: { position: "absolute", left: -17, top: 38, width: 2, height: 34, backgroundColor: "rgba(255,255,255,0.16)" },
  stepBody: { flex: 1, marginLeft: 12, paddingBottom: 14 },
  stepTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepTitle: { flex: 1, color: "rgba(255,255,255,0.86)", fontSize: 14, fontWeight: "850" },
  stepTitleActive: { color: "#FFFFFF" },
  stepBadge: { color: "#06111F", fontSize: 9, fontWeight: "900", backgroundColor: "#EAFBF4", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  stepSubtitle: { color: "rgba(234,251,244,0.60)", fontSize: 12, lineHeight: 17, marginTop: 4 },
  footerSpace: { height: 42 },
});
