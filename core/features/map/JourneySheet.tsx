import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
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

type Props = {
  flowState: TransitFlowState;
  liveBusCount: number;
  routeOptions: TransitRouteOption[];
  selectedRoute: TransitRouteOption | null;
  error?: string | null;
  onChooseRoute: (route: TransitRouteOption) => void;
  onStartJourney: () => void;
  onNextStep: () => void;
  onReset: () => void;
};

type SnapPoint = "compact" | "medium" | "expanded";

const SCREEN_HEIGHT = Dimensions.get("window").height;

const SNAP_HEIGHTS: Record<SnapPoint, number> = {
  compact: 210,
  medium: Math.min(480, SCREEN_HEIGHT * 0.56),
  expanded: Math.min(780, SCREEN_HEIGHT * 0.9),
};

function nearestSnap(height: number): SnapPoint {
  const entries = Object.entries(SNAP_HEIGHTS) as Array<[SnapPoint, number]>;
  return entries.reduce((best, current) =>
    Math.abs(current[1] - height) < Math.abs(best[1] - height) ? current : best
  )[0];
}

function routeSummary(route: TransitRouteOption | null) {
  if (!route) return null;

  const duration = Number(route.totalDurationMinutes || route.totalMinutes || 0);
  const walk = Number(route.totalWalkMinutes || route.walkingMinutes || 0);
  const bus = Number(
    route.totalBusMinutes != null ? route.totalBusMinutes : Math.max(0, duration - walk)
  );
  const transfers = Number(route.transfersCount || route.transfers || 0);
  const stops = Number(route.stopCount || 0);
  const eta = route.liveEta?.etaMinutes ?? route.etaMinutes ?? null;

  return { duration, walk, bus, transfers, stops, eta };
}

function liveCta(route: TransitRouteOption | null, flowState: TransitFlowState) {
  const eta = route?.liveEta?.etaMinutes ?? route?.etaMinutes ?? null;
  const state = route?.boardingState;

  if (flowState === "walking_to_stop") {
    return {
      title: "Eik iki stotelės",
      subtitle: route ? `Įlipimas: ${route.boardStopName}` : "Sek mėlyną liniją iki stotelės.",
      icon: "walk" as const,
    };
  }

  if (flowState === "onboard") {
    return {
      title: "Važiuok autobusu",
      subtitle: route ? `Išlipk: ${route.alightStopName}` : "Sek kelionės žingsnius.",
      icon: "bus" as const,
    };
  }

  if (flowState === "arriving") {
    return {
      title: "Išlipk dabar",
      subtitle: route ? route.alightStopName : "Artėji prie tikslo.",
      icon: "flag" as const,
    };
  }

  if (eta != null) {
    if (eta <= 2 || state === "boarding_soon") {
      return {
        title: "Lipk dabar",
        subtitle: route ? `Autobusas ${route.routeLabel} jau prie stotelės` : "Autobusas atvyksta.",
        icon: "alert-circle" as const,
      };
    }

    if (eta <= 5) {
      return {
        title: `Lauk autobuso • ${eta} min`,
        subtitle: route ? `Stotelė: ${route.boardStopName}` : "Autobusas jau netoli.",
        icon: "time" as const,
      };
    }

    return {
      title: `Autobusas po ${eta} min`,
      subtitle: route ? `Eik / lauk: ${route.boardStopName}` : "Sek ETA realiu laiku.",
      icon: "bus" as const,
    };
  }

  return null;
}

function stateCopy(state: TransitFlowState, route: TransitRouteOption | null) {
  const live = liveCta(route, state);
  if (live && ["route_options", "route_selected", "walking_to_stop", "waiting_bus", "onboard", "arriving"].includes(state)) {
    return live;
  }

  switch (state) {
    case "idle":
      return {
        title: "Kur važiuojam?",
        subtitle: "Įvesk tikslą – parodysime stotelę, autobusą ir persėdimus.",
        icon: "search" as const,
      };
    case "destination_selected":
      return {
        title: "Tikslas pasirinktas",
        subtitle: "Pasirink vietą arba palauk, kol bus suplanuotas maršrutas.",
        icon: "location" as const,
      };
    case "routes_loading":
      return {
        title: "Ieškome geriausio maršruto",
        subtitle: "Tikriname stoteles, grafikus, persėdimus ir live ETA.",
        icon: "sync" as const,
      };
    case "route_options":
      return {
        title: "Pasirink maršrutą",
        subtitle: "Žemėlapyje matai kryptį, apačioje – kelionės variantus.",
        icon: "bus" as const,
      };
    case "route_selected":
      return {
        title: route ? `${route.routeLabel} • ${route.totalDurationMinutes || route.totalMinutes} min` : "Maršrutas pasirinktas",
        subtitle: route?.journeyMessage || "Spausk GO ir pradėk kelionę.",
        icon: "navigate" as const,
      };
    case "waiting_bus":
      return {
        title: `Lauk autobuso ${route?.routeLabel || ""}`.trim(),
        subtitle: "Stebėk autobusą žemėlapyje.",
        icon: "time" as const,
      };
    case "transfer":
      return {
        title: "Persėsk",
        subtitle: "Sek kitą žingsnį ir lipk į kitą autobusą.",
        icon: "swap-horizontal" as const,
      };
    case "completed":
      return {
        title: "Atvykai",
        subtitle: "Kelionė baigta. Gali planuoti kitą maršrutą.",
        icon: "checkmark-circle" as const,
      };
    default:
      return {
        title: "Arbebus",
        subtitle: "Viešasis transportas realiu laiku.",
        icon: "bus" as const,
      };
  }
}

function stepIcon(step: TransitStep) {
  if (step.type === "walk") return "walk";
  if (step.type === "transfer") return "swap-horizontal";
  if (step.type === "board") return "bus";
  if (step.type === "ride" || step.type === "bus") return "bus";
  if (step.type === "alight" || step.type === "arrive") return "flag-checkered";
  return "dots-horizontal";
}

function stepBadge(step: TransitStep) {
  if (step.type === "walk") return "EITI";
  if (step.type === "board") return "LIPK";
  if (step.type === "ride" || step.type === "bus") return "VAŽIUOK";
  if (step.type === "alight" || step.type === "arrive") return "IŠLIPK";
  if (step.type === "transfer") return "PERSĖSK";
  return "ŽINGSNIS";
}

function RouteCard({
  route,
  selected,
  onPress,
}: {
  route: TransitRouteOption;
  selected: boolean;
  onPress: () => void;
}) {
  const summary = routeSummary(route);

  return (
    <Pressable onPress={onPress} style={[styles.routeCard, selected && styles.routeCardSelected]}>
      <View style={styles.routeBadge}>
        <Text style={styles.routeBadgeText} numberOfLines={2}>
          {route.routeLabel}
        </Text>
      </View>

      <View style={styles.routeInfo}>
        <Text style={styles.routeTitle} numberOfLines={1}>
          {summary?.duration || "?"} min
        </Text>

        <Text style={styles.routeSubtitle} numberOfLines={1}>
          {summary?.walk || 0} min ėjimo • {summary?.transfers || 0} persėd. • {summary?.stops || 0} st.
        </Text>

        <Text style={styles.routeHint} numberOfLines={1}>
          {summary?.eta != null
            ? `Live ETA: autobusas po ${summary.eta} min`
            : `${route.boardStopName} → ${route.alightStopName}`}
        </Text>
      </View>

      <Ionicons
        name={selected ? "checkmark-circle" : "chevron-forward"}
        size={23}
        color={selected ? "#35F2B4" : "#AEB7D8"}
      />
    </Pressable>
  );
}

function StepRow({
  step,
  index,
  last,
  active,
}: {
  step: TransitStep;
  index: number;
  last: boolean;
  active: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <View style={[styles.stepIconCircle, active && styles.stepIconCircleActive]}>
          <MaterialCommunityIcons name={stepIcon(step) as any} size={18} color="#06130E" />
        </View>
        {!last ? <View style={styles.stepLine} /> : null}
      </View>

      <View style={[styles.stepContent, active && styles.stepContentActive]}>
        <View style={styles.stepHeaderLine}>
          <Text style={styles.stepBadge}>{stepBadge(step)}</Text>
          {active ? <Text style={styles.activeBadge}>DABAR</Text> : null}
        </View>

        <Text style={styles.stepTitle}>{step.title}</Text>

        {step.subtitle || step.description ? (
          <Text style={styles.stepSubtitle}>{step.subtitle || step.description}</Text>
        ) : null}

        <Text style={styles.stepMeta}>
          {step.routeNumber ? `Autobusas ${step.routeNumber} • ` : ""}
          {step.stopCount ? `${step.stopCount} st. • ` : ""}
          {step.durationMinutes || step.minutes
            ? `${step.durationMinutes || step.minutes} min`
            : index === 0
              ? "Pradžia"
              : "Sek žingsnį"}
        </Text>
      </View>
    </View>
  );
}

export default function JourneySheet({
  flowState,
  liveBusCount,
  routeOptions,
  selectedRoute,
  error,
  onChooseRoute,
  onStartJourney,
  onNextStep,
  onReset,
}: Props) {
  const [snap, setSnap] = useState<SnapPoint>("medium");

  const animatedHeight = useRef(new Animated.Value(SNAP_HEIGHTS.medium)).current;
  const currentHeight = useRef(SNAP_HEIGHTS.medium);
  const dragStartHeight = useRef(SNAP_HEIGHTS.medium);

  const copy = stateCopy(flowState, selectedRoute);
  const summary = routeSummary(selectedRoute);
  const steps = selectedRoute?.journeySteps || selectedRoute?.steps || [];

  const showRoutes =
    routeOptions.length > 0 &&
    ["route_options", "route_selected", "walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving"].includes(flowState);

  const showGo = flowState === "route_options" || flowState === "route_selected";

  const showNext = ["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving"].includes(flowState);

  const liveEtaText =
    selectedRoute?.liveEta?.etaMinutes != null
      ? `Autobusas po ${selectedRoute.liveEta.etaMinutes} min`
      : null;

  const vehicleText =
    selectedRoute?.liveVehicle?.vehicleId || selectedRoute?.liveVehicle?.vehicleLabel
      ? `GPS: ${selectedRoute.liveVehicle.vehicleLabel || selectedRoute.liveVehicle.vehicleId}`
      : null;

  const setSheetSnap = (nextSnap: SnapPoint) => {
    setSnap(nextSnap);
    currentHeight.current = SNAP_HEIGHTS[nextSnap];

    Animated.spring(animatedHeight, {
      toValue: SNAP_HEIGHTS[nextSnap],
      useNativeDriver: false,
      speed: 18,
      bounciness: 6,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 3,
        onPanResponderGrant: () => {
          dragStartHeight.current = currentHeight.current;
        },
        onPanResponderMove: (_, gesture) => {
          const nextHeight = Math.max(
            SNAP_HEIGHTS.compact,
            Math.min(SNAP_HEIGHTS.expanded, dragStartHeight.current - gesture.dy)
          );

          currentHeight.current = nextHeight;
          animatedHeight.setValue(nextHeight);
        },
        onPanResponderRelease: () => {
          setSheetSnap(nearestSnap(currentHeight.current));
        },
      }),
    [animatedHeight]
  );

  const compactToggle = () => {
    if (snap === "compact") setSheetSnap("medium");
    else if (snap === "medium") setSheetSnap("expanded");
    else setSheetSnap("compact");
  };

  return (
    <Animated.View style={[styles.sheet, { height: animatedHeight }]}>
      <View style={styles.handleArea} {...panResponder.panHandlers}>
        <Pressable onPress={compactToggle} style={styles.handlePress}>
          <View style={styles.handle} />
        </Pressable>
      </View>

      <View style={styles.headerRow}>
        <View style={styles.mainIcon}>
          {flowState === "routes_loading" ? (
            <ActivityIndicator color="#CFFFEA" />
          ) : (
            <Ionicons name={copy.icon} size={22} color="#CFFFEA" />
          )}
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle} numberOfLines={snap === "compact" ? 1 : 2}>
            {copy.subtitle}
          </Text>
        </View>

        {flowState !== "idle" ? (
          <Pressable onPress={onReset} hitSlop={12} style={styles.closeButton}>
            <Ionicons name="close" size={22} color="#AEB7D8" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusPill}>Live: {liveBusCount}</Text>

        {selectedRoute ? <Text style={styles.statusPill}>Nr. {selectedRoute.routeLabel}</Text> : null}

        {summary?.duration ? <Text style={styles.statusPill}>{summary.duration} min</Text> : null}

        {selectedRoute?.liveEta?.etaMinutes != null ? (
          <Text style={styles.livePill}>ETA {selectedRoute.liveEta.etaMinutes} min</Text>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {showRoutes ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routeList}>
          {routeOptions.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              selected={selectedRoute?.id === route.id}
              onPress={() => onChooseRoute(route)}
            />
          ))}
        </ScrollView>
      ) : null}

      {selectedRoute ? (
        <View style={styles.detailBox}>
          <View style={styles.detailTopRow}>
            <Text style={styles.detailTitle} numberOfLines={1}>
              {selectedRoute.routeLabel}
            </Text>

            <Text style={styles.detailDuration}>{summary?.duration || "?"} min</Text>
          </View>

          <View style={styles.liveBox}>
            <Ionicons name="radio" size={18} color="#35F2B4" />
            <View style={{ flex: 1 }}>
              <Text style={styles.liveTitle}>{liveEtaText || "Live GPS jungiamas..."}</Text>
              <Text style={styles.liveSubtitle} numberOfLines={1}>
                {vehicleText || `Įlipk: ${selectedRoute.boardStopName}`}
              </Text>
            </View>
          </View>

          <Text style={styles.detailText}>Įlipk: {selectedRoute.boardStopName}</Text>
          <Text style={styles.detailText}>Išlipk: {selectedRoute.alightStopName}</Text>

          <Text style={styles.detailText}>
            Ėjimas: {summary?.walk || 0} min • Autobusu: {summary?.bus || 0} min • Persėdimai: {summary?.transfers || 0}
          </Text>

          {selectedRoute.journeyMessage ? (
            <Text style={styles.journeyMessage}>{selectedRoute.journeyMessage}</Text>
          ) : null}
        </View>
      ) : null}

      {showGo ? (
        <Pressable style={styles.primaryButton} onPress={onStartJourney}>
          <Ionicons name="navigate" color="#03110B" size={20} />
          <Text style={styles.primaryText}>GO</Text>
        </Pressable>
      ) : null}

      {showNext ? (
        <Pressable style={styles.primaryButton} onPress={onNextStep}>
          <Text style={styles.primaryText}>
            {selectedRoute?.boardingState === "boarding_soon" ? "LIPK DABAR" : "TOLIAU"}
          </Text>
          <Ionicons name="arrow-forward" color="#03110B" size={20} />
        </Pressable>
      ) : null}

      {flowState === "completed" ? (
        <Pressable style={styles.primaryButton} onPress={onReset}>
          <Text style={styles.primaryText}>NAUJAS MARŠRUTAS</Text>
        </Pressable>
      ) : null}

      {steps.length > 0 && snap !== "compact" ? (
        <ScrollView style={styles.stepsScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepsContent}>
          <Text style={styles.sectionTitle}>Kelionės žingsniai</Text>

          {steps.map((step, index) => (
            <StepRow
              key={`${step.id}-${index}`}
              step={step}
              index={index}
              last={index === steps.length - 1}
              active={
                (flowState === "route_selected" && index === 0) ||
                (flowState === "walking_to_stop" && step.type === "walk") ||
                (flowState === "waiting_bus" && step.type === "board") ||
                (flowState === "onboard" && step.type === "ride") ||
                (flowState === "arriving" && (step.type === "alight" || step.type === "arrive"))
              }
            />
          ))}
        </ScrollView>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "rgba(8,13,27,0.985)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    zIndex: 50,
    elevation: 50,
    overflow: "hidden",
  },
  handleArea: { paddingTop: 8, paddingBottom: 10, alignItems: "center" },
  handlePress: { width: "100%", alignItems: "center", paddingVertical: 4 },
  handle: { width: 50, height: 5, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.30)" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mainIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(58,255,184,0.14)",
  },
  headerText: { flex: 1 },
  title: { color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  subtitle: { color: "#AEB7D8", marginTop: 4, fontSize: 13, lineHeight: 18 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statusRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  statusPill: {
    color: "#CFFFEA",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "rgba(58,255,184,0.12)",
    overflow: "hidden",
  },
  livePill: {
    color: "#03110B",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: "#35F2B4",
    overflow: "hidden",
  },
  error: { color: "#FF8F8F", marginTop: 10, fontWeight: "800" },
  routeList: { gap: 10, paddingVertical: 14 },
  routeCard: {
    width: 320,
    minHeight: 96,
    borderRadius: 22,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  routeCardSelected: {
    borderColor: "rgba(58,255,184,0.85)",
    backgroundColor: "rgba(58,255,184,0.11)",
  },
  routeBadge: {
    width: 70,
    minHeight: 54,
    paddingHorizontal: 7,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35F2B4",
  },
  routeBadgeText: { color: "#03110B", fontSize: 12, fontWeight: "900", textAlign: "center" },
  routeInfo: { flex: 1 },
  routeTitle: { color: "white", fontSize: 18, fontWeight: "900" },
  routeSubtitle: { color: "#98A4C6", marginTop: 4, fontSize: 12, fontWeight: "700" },
  routeHint: { color: "#CFFFEA", marginTop: 4, fontSize: 11, fontWeight: "800" },
  detailBox: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.065)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  detailTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  detailTitle: { flex: 1, color: "white", fontWeight: "900", fontSize: 16 },
  detailDuration: { color: "#35F2B4", fontWeight: "900", fontSize: 16 },
  liveBox: {
    marginBottom: 10,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(53,242,180,0.10)",
    borderWidth: 1,
    borderColor: "rgba(53,242,180,0.22)",
  },
  liveTitle: { color: "#CFFFEA", fontSize: 14, fontWeight: "900" },
  liveSubtitle: { color: "#98A4C6", marginTop: 2, fontSize: 12, fontWeight: "700" },
  detailText: { color: "#B8C2E4", marginTop: 4, fontSize: 13, fontWeight: "700" },
  journeyMessage: { color: "#FFFFFF", marginTop: 9, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  primaryButton: {
    marginTop: 14,
    minHeight: 54,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#35F2B4",
  },
  primaryText: { color: "#03110B", fontSize: 17, fontWeight: "900", letterSpacing: 0.7 },
  stepsScroll: { marginTop: 12, flex: 1 },
  stepsContent: { paddingBottom: 110 },
  sectionTitle: { color: "white", fontSize: 16, fontWeight: "900", marginBottom: 10 },
  stepRow: { flexDirection: "row", minHeight: 74 },
  stepRail: { width: 36, alignItems: "center" },
  stepIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35F2B4",
  },
  stepIconCircleActive: { transform: [{ scale: 1.08 }] },
  stepLine: { flex: 1, width: 2, backgroundColor: "rgba(53,242,180,0.35)", marginVertical: 4 },
  stepContent: { flex: 1, paddingBottom: 16, paddingLeft: 8 },
  stepContentActive: { opacity: 1 },
  stepHeaderLine: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  stepBadge: { color: "#35F2B4", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  activeBadge: {
    color: "#03110B",
    backgroundColor: "#35F2B4",
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 9,
    fontWeight: "900",
  },
  stepTitle: { color: "white", fontSize: 15, fontWeight: "900" },
  stepSubtitle: { color: "#B8C2E4", marginTop: 3, fontSize: 13, lineHeight: 18 },
  stepMeta: { color: "#7F8BAE", marginTop: 6, fontSize: 12, fontWeight: "800" },
});