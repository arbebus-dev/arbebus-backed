import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef } from "react";
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

import { useJourneyStateMachine } from "../transit/hooks/useJourneyStateMachine";
import {
  cleanRouteNumber,
  getSteps,
  routeNumbersFromRoute,
  type JourneyStage,
} from "../transit/models/journeyStateMachine";
import type { TransitFlowState, TransitRouteOption, TransitStep } from "../transit/models/transitTypes";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SAFE_MAX_HEIGHT = Math.min(790, SCREEN_HEIGHT * 0.9);
const COLLAPSED_HEIGHT = 214;
const PREVIEW_HEIGHT = Math.min(430, SCREEN_HEIGHT * 0.52);
const DETAIL_HEIGHT = Math.min(640, SCREEN_HEIGHT * 0.74);
const NAV_HEIGHT = Math.min(560, SCREEN_HEIGHT * 0.66);

const GREEN = "#35F2B4";
const DARK = "rgba(5, 9, 20, 0.94)";
const CARD = "rgba(28, 35, 52, 0.92)";
const CARD_SOFT = "rgba(255,255,255,0.07)";
const LINE = "rgba(255,255,255,0.11)";
const TEXT = "#F8FBFF";
const MUTED = "#AAB4CF";

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

function number(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function summary(route: TransitRouteOption | null) {
  if (!route) {
    return { duration: 0, walk: 0, bus: 0, transfers: 0, stops: 0, eta: null as number | null, numbers: [] as string[] };
  }

  const numbers = routeNumbersFromRoute(route);
  const duration = number(route.totalDurationMinutes ?? route.totalMinutes, 0);
  const walk = number(route.totalWalkMinutes ?? route.walkingMinutes, 0);
  const bus = number(route.totalBusMinutes, Math.max(0, duration - walk));
  const transfers = Math.max(number(route.transfersCount ?? route.transfers, 0), Math.max(0, numbers.length - 1));
  const stops = number(route.stopCount, 0);
  const eta = route.liveEta?.etaMinutes ?? route.etaMinutes ?? null;
  return { duration, walk, bus, transfers, stops, eta, numbers };
}

function routeTitle(route: TransitRouteOption) {
  const numbers = routeNumbersFromRoute(route);
  if (numbers.length > 1) return numbers.join(" → ");
  return numbers[0] || route.routeLabel || route.title || "BUS";
}

function routeSubline(route: TransitRouteOption) {
  const s = summary(route);
  const parts = [
    `${s.duration || route.totalMinutes || "?"} min`,
    s.walk ? `Ėjimas ${s.walk} min` : null,
    s.transfers ? `${s.transfers} persėd.` : "be persėdimų",
  ].filter(Boolean);
  return parts.join(" • ");
}

function stepIconName(step?: TransitStep | null) {
  if (!step) return "dots-horizontal";
  if (step.type === "walk") return "walk";
  if (step.type === "board") return "bus-clock";
  if (step.type === "ride" || step.type === "bus") return "bus";
  if (step.type === "transfer") return "swap-horizontal";
  if (step.type === "alight" || step.type === "arrive") return "flag-checkered";
  return "dots-horizontal";
}

function stepBadge(step: TransitStep) {
  if (step.type === "walk") return "EIK";
  if (step.type === "board") return "ĮLIPK";
  if (step.type === "ride" || step.type === "bus") return cleanRouteNumber(step.routeNumber || step.routeId || step.routeLabel) || "BUS";
  if (step.type === "transfer") return "PERSĖSK";
  if (step.type === "alight" || step.type === "arrive") return "IŠLIPK";
  return "STEP";
}

function ctaForStage(stage: JourneyStage, flowState: TransitFlowState, route: TransitRouteOption | null) {
  if (stage === "routes_list") return "RODYTI";
  if (stage === "route_details") return "GO";
  if (flowState === "walking_to_stop") return "EINU";
  if (flowState === "waiting_bus") return "ĮLIPAU";
  if (flowState === "onboard") return "TOLIAU";
  if (flowState === "transfer") return "PERSĖDAU";
  if (flowState === "arriving") return "IŠLIPAU";
  if (flowState === "completed") return "NAUJAS MARŠRUTAS";
  return route ? "GO" : "IEŠKOTI";
}

function heightForStage(stage: JourneyStage, routeCount: number) {
  if (stage === "routes_list") return routeCount > 2 ? DETAIL_HEIGHT : PREVIEW_HEIGHT;
  if (stage === "route_details") return DETAIL_HEIGHT;
  if (stage === "active_step") return NAV_HEIGHT;
  if (stage === "navigation") return NAV_HEIGHT;
  return COLLAPSED_HEIGHT;
}

function MiniPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.miniPill, active && styles.miniPillActive]}>
      <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>{label}</Text>
    </View>
  );
}

function RouteBadges({ numbers }: { numbers: string[] }) {
  if (!numbers.length) return null;
  return (
    <View style={styles.badgeRow}>
      {numbers.map((item, index) => (
        <React.Fragment key={`${item}-${index}`}>
          <View style={styles.lineBadge}>
            <Text style={styles.lineBadgeText}>{item}</Text>
          </View>
          {index < numbers.length - 1 ? <Ionicons name="chevron-forward" size={16} color={GREEN} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

function RouteAlternativeCard({
  route,
  selected,
  onPress,
}: {
  route: TransitRouteOption;
  selected: boolean;
  onPress: () => void;
}) {
  const s = summary(route);
  const title = routeTitle(route);

  return (
    <Pressable onPress={onPress} style={[styles.routeCard, selected && styles.routeCardSelected]}>
      <View style={styles.routeCardTop}>
        <View style={styles.routeCardLeft}>
          <Text style={styles.routeCardTitle}>{title}</Text>
          <Text style={styles.routeCardSubtitle}>{routeSubline(route)}</Text>
        </View>
        <View style={styles.routeDurationBlock}>
          <Text style={styles.routeDuration}>{s.duration || "—"}</Text>
          <Text style={styles.routeDurationUnit}>min</Text>
        </View>
      </View>

      <RouteBadges numbers={s.numbers} />

      <View style={styles.routeMetaRow}>
        <MiniPill label={`${s.stops || "—"} st.`} />
        <MiniPill label={s.transfers ? `${s.transfers} persėd.` : "tiesiogiai"} active={!s.transfers} />
        {s.eta != null ? <MiniPill label={`ETA ${s.eta} min`} active /> : null}
      </View>
    </Pressable>
  );
}

function HeaderBlock({ title, subtitle, progressLabel, icon }: { title: string; subtitle: string; progressLabel?: string; icon: string }) {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.iconOrb}>
        <MaterialCommunityIcons name={icon as any} size={30} color="#08291F" />
      </View>
      <View style={styles.headerTextBlock}>
        <Text style={styles.kicker}>ARBE NAVIGATION</Text>
        <Text style={styles.headerTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.headerSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      {progressLabel ? (
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>{progressLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function RouteDetails({ route }: { route: TransitRouteOption }) {
  const s = summary(route);
  const steps = getSteps(route);
  return (
    <View style={styles.detailsBlock}>
      <View style={styles.primaryRouteBox}>
        <View>
          <Text style={styles.primaryRouteTitle}>{routeTitle(route)}</Text>
          <Text style={styles.primaryRouteSubtitle}>{route.boardStopName} → {route.alightStopName}</Text>
        </View>
        <Text style={styles.primaryRouteTime}>{s.duration || route.totalMinutes} min</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}><Text style={styles.statValue}>{s.walk}</Text><Text style={styles.statLabel}>ėjimas</Text></View>
        <View style={styles.statItem}><Text style={styles.statValue}>{s.bus}</Text><Text style={styles.statLabel}>autobusu</Text></View>
        <View style={styles.statItem}><Text style={styles.statValue}>{s.transfers}</Text><Text style={styles.statLabel}>persėd.</Text></View>
      </View>

      <View style={styles.stepsListCompact}>
        {steps.slice(0, 6).map((step, index) => (
          <View key={step.id || `${step.type}-${index}`} style={styles.compactStepRow}>
            <View style={styles.compactStepIcon}>
              <MaterialCommunityIcons name={stepIconName(step) as any} size={17} color={GREEN} />
            </View>
            <View style={styles.compactStepMain}>
              <Text style={styles.compactStepTitle} numberOfLines={1}>{step.title}</Text>
              <Text style={styles.compactStepSubtitle} numberOfLines={1}>
                {[step.stopName, step.fromStopName, step.toStopName, step.durationMinutes ? `${step.durationMinutes} min` : null]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            </View>
            <Text style={styles.compactStepBadge}>{stepBadge(step)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ActiveNavigation({
  route,
  flowState,
  currentStepIndex,
}: {
  route: TransitRouteOption;
  flowState: TransitFlowState;
  currentStepIndex: number;
}) {
  const vm = useJourneyStateMachine(flowState, route, currentStepIndex);
  const steps = getSteps(route);
  const s = summary(route);
  const active = vm.activeStep;

  return (
    <View style={styles.navigationBlock}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(vm.progressPercent * 100)}%` }]} />
      </View>

      <View style={styles.activeCard}>
        <View style={styles.activeTopRow}>
          <Text style={styles.activeRouteLabel}>{routeTitle(route)}</Text>
          <Text style={styles.activeTime}>{s.duration || route.totalMinutes} min</Text>
        </View>

        <View style={styles.liveEtaBox}>
          <MaterialCommunityIcons name="access-point" size={24} color={GREEN} />
          <View style={{ flex: 1 }}>
            <Text style={styles.liveEtaTitle}>
              {vm.etaMinutes != null ? `Autobusas po ${vm.etaMinutes} min` : "Sek kelionės eigą"}
            </Text>
            <Text style={styles.liveEtaSubtitle}>GPS + tvarkaraštis</Text>
          </View>
        </View>

        {active ? (
          <View style={styles.currentStepBox}>
            <View style={styles.currentStepIcon}>
              <MaterialCommunityIcons name={stepIconName(active) as any} size={22} color="#06241D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.currentStepTitle}>{active.title}</Text>
              <Text style={styles.currentStepSubtitle} numberOfLines={2}>
                {[active.stopName, active.fromStopName && active.toStopName ? `${active.fromStopName} → ${active.toStopName}` : null, active.stopCount ? `${active.stopCount} stotelės` : null]
                  .filter(Boolean)
                  .join(" • ") || vm.subtitle}
              </Text>
            </View>
            <Text style={styles.currentStepTime}>{active.durationMinutes || active.minutes || ""}{active.durationMinutes || active.minutes ? " min" : ""}</Text>
          </View>
        ) : null}

        <View style={styles.stopTimeline}>
          {steps.slice(Math.max(0, vm.activeStepIndex - 1), vm.activeStepIndex + 4).map((step, index) => {
            const absoluteIndex = Math.max(0, vm.activeStepIndex - 1) + index;
            const isActive = absoluteIndex === vm.activeStepIndex;
            return (
              <View key={step.id || `${step.type}-${absoluteIndex}`} style={styles.timelineRow}>
                <View style={[styles.timelineDot, isActive && styles.timelineDotActive]} />
                <Text style={[styles.timelineText, isActive && styles.timelineTextActive]} numberOfLines={1}>
                  {step.title}
                </Text>
                <Text style={styles.timelineBadge}>{stepBadge(step)}</Text>
              </View>
            );
          })}
        </View>
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
  isOffline,
  offlineMessage,
  isRerouting,
  reroutingMessage,
  onChooseRoute,
  onStartJourney,
  onNextStep,
  onReset,
}: Props) {
  const currentStepIndex = 0;
  const vm = useJourneyStateMachine(flowState, selectedRoute, currentStepIndex);
  const height = heightForStage(vm.stage, routeOptions.length);
  const translateY = useRef(new Animated.Value(SAFE_MAX_HEIGHT - height)).current;
  const lastHeight = useRef(height);

  const stage = vm.stage;
  const hasRoutes = routeOptions.length > 0;
  const displayRoute = selectedRoute || routeOptions[0] || null;

  useEffect(() => {
    lastHeight.current = height;
    Animated.spring(translateY, {
      toValue: SAFE_MAX_HEIGHT - height,
      useNativeDriver: true,
      tension: 48,
      friction: 9,
    }).start();
  }, [height, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 8,
        onPanResponderMove: (_evt, gesture) => {
          const nextHeight = Math.max(COLLAPSED_HEIGHT, Math.min(SAFE_MAX_HEIGHT, lastHeight.current - gesture.dy));
          translateY.setValue(SAFE_MAX_HEIGHT - nextHeight);
        },
        onPanResponderRelease: (_evt, gesture) => {
          const rawHeight = lastHeight.current - gesture.dy;
          const targetHeight = rawHeight > (DETAIL_HEIGHT + NAV_HEIGHT) / 2 ? SAFE_MAX_HEIGHT : rawHeight > (PREVIEW_HEIGHT + DETAIL_HEIGHT) / 2 ? DETAIL_HEIGHT : rawHeight > (COLLAPSED_HEIGHT + PREVIEW_HEIGHT) / 2 ? PREVIEW_HEIGHT : COLLAPSED_HEIGHT;
          lastHeight.current = targetHeight;
          Animated.spring(translateY, {
            toValue: SAFE_MAX_HEIGHT - targetHeight,
            useNativeDriver: true,
            tension: 48,
            friction: 9,
          }).start();
        },
      }),
    [translateY]
  );

  const handlePrimary = async () => {
    await Haptics.selectionAsync().catch(() => undefined);
    if (stage === "routes_list" && routeOptions[0]) return onChooseRoute(routeOptions[0]);
    if (stage === "route_details") return onStartJourney();
    if (flowState === "completed") return onReset();
    return onNextStep();
  };

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      <View {...panResponder.panHandlers} style={styles.grabberWrap}>
        <View style={styles.grabber} />
      </View>

      <View style={styles.sheetHeaderActions}>
        <View style={styles.statusCapsule}>
          <View style={styles.statusDot} />
          <Text style={styles.statusCapsuleText}>{liveBusCount} live autobusai</Text>
        </View>
        <Pressable onPress={onReset} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#C9D2EA" />
        </Pressable>
      </View>

      <HeaderBlock
        icon={stage === "routes_list" ? "routes" : stage === "route_details" ? "map-check" : stepIconName(vm.activeStep)}
        title={vm.title}
        subtitle={isRerouting ? reroutingMessage || "Perskaičiuojame maršrutą..." : vm.subtitle}
        progressLabel={stage === "navigation" ? vm.progressLabel : undefined}
      />

      {isOffline ? (
        <View style={styles.warnBox}>
          <Ionicons name="cloud-offline" size={18} color="#FFD166" />
          <Text style={styles.warnText}>{offlineMessage || "Offline režimas – rodome paskutinį planą."}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="warning" size={18} color="#FF8A8A" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {flowState === "routes_loading" ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="small" color={GREEN} />
            <Text style={styles.loadingText}>Tikriname realius grafikus ir stoteles...</Text>
          </View>
        ) : null}

        {stage === "routes_list" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Maršruto variantai</Text>
              <Text style={styles.sectionHint}>rinkis vieną</Text>
            </View>
            {hasRoutes ? (
              routeOptions.slice(0, 5).map((route) => (
                <RouteAlternativeCard
                  key={route.id}
                  route={route}
                  selected={selectedRoute?.id === route.id}
                  onPress={() => onChooseRoute(route)}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>Įvesk tikslą ir pasirink vietą – parodysime maršrutus.</Text>
            )}
          </View>
        ) : null}

        {stage === "route_details" && displayRoute ? <RouteDetails route={displayRoute} /> : null}

        {stage === "navigation" && displayRoute ? (
          <ActiveNavigation route={displayRoute} flowState={flowState} currentStepIndex={currentStepIndex} />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={handlePrimary} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{ctaForStage(stage, flowState, displayRoute)}</Text>
          <Ionicons name="arrow-forward" size={24} color="#06241D" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SAFE_MAX_HEIGHT,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: DARK,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.42,
    shadowRadius: 22,
    elevation: 28,
  },
  grabberWrap: { alignItems: "center", paddingVertical: 8 },
  grabber: { width: 74, height: 6, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.25)" },
  sheetHeaderActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  statusCapsule: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(53,242,180,0.10)", borderWidth: 1, borderColor: "rgba(53,242,180,0.22)" },
  statusDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: GREEN },
  statusCapsuleText: { color: "#CFFFEF", fontWeight: "800", fontSize: 12 },
  closeButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  headerBlock: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  iconOrb: { width: 70, height: 70, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: GREEN, shadowColor: GREEN, shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  headerTextBlock: { flex: 1 },
  kicker: { color: GREEN, fontSize: 12, letterSpacing: 4, fontWeight: "900", marginBottom: 4 },
  headerTitle: { color: TEXT, fontSize: 31, lineHeight: 35, fontWeight: "900" },
  headerSubtitle: { color: MUTED, fontSize: 17, lineHeight: 23, fontWeight: "700", marginTop: 4 },
  progressBadge: { width: 58, height: 58, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.09)" },
  progressBadgeText: { color: TEXT, fontSize: 17, fontWeight: "900" },
  warnBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,209,102,0.11)", padding: 10, borderRadius: 16, marginBottom: 10 },
  warnText: { color: "#FFE6A3", fontWeight: "700", flex: 1 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,72,72,0.11)", padding: 10, borderRadius: 16, marginBottom: 10 },
  errorText: { color: "#FFC6C6", fontWeight: "700", flex: 1 },
  scrollContent: { paddingBottom: 110 },
  section: { gap: 12 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionTitle: { color: TEXT, fontSize: 22, fontWeight: "900" },
  sectionHint: { color: MUTED, fontSize: 13, fontWeight: "800" },
  routeCard: { padding: 16, borderRadius: 26, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, marginBottom: 12 },
  routeCardSelected: { borderColor: GREEN, backgroundColor: "rgba(53,242,180,0.13)" },
  routeCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  routeCardLeft: { flex: 1 },
  routeCardTitle: { color: TEXT, fontSize: 25, fontWeight: "900" },
  routeCardSubtitle: { color: MUTED, fontSize: 15, fontWeight: "700", marginTop: 4 },
  routeDurationBlock: { alignItems: "flex-end" },
  routeDuration: { color: GREEN, fontSize: 28, fontWeight: "900" },
  routeDurationUnit: { color: GREEN, fontSize: 13, fontWeight: "900", marginTop: -4 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 },
  lineBadge: { minWidth: 50, height: 38, paddingHorizontal: 12, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: GREEN },
  lineBadgeText: { color: "#06241D", fontSize: 17, fontWeight: "900" },
  routeMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  miniPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: LINE },
  miniPillActive: { backgroundColor: "rgba(53,242,180,0.12)", borderColor: "rgba(53,242,180,0.42)" },
  miniPillText: { color: MUTED, fontWeight: "800", fontSize: 13 },
  miniPillTextActive: { color: "#CFFFF0" },
  detailsBlock: { gap: 14 },
  primaryRouteBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderRadius: 28, backgroundColor: CARD, borderWidth: 1, borderColor: "rgba(53,242,180,0.28)" },
  primaryRouteTitle: { color: TEXT, fontSize: 30, fontWeight: "900" },
  primaryRouteSubtitle: { color: MUTED, fontSize: 15, fontWeight: "700", marginTop: 5, maxWidth: 250 },
  primaryRouteTime: { color: GREEN, fontSize: 30, fontWeight: "900" },
  statsRow: { flexDirection: "row", gap: 10 },
  statItem: { flex: 1, padding: 14, borderRadius: 22, backgroundColor: CARD_SOFT, borderWidth: 1, borderColor: LINE },
  statValue: { color: TEXT, fontSize: 22, fontWeight: "900" },
  statLabel: { color: MUTED, fontSize: 12, fontWeight: "800", marginTop: 3 },
  stepsListCompact: { borderRadius: 25, overflow: "hidden", backgroundColor: CARD, borderWidth: 1, borderColor: LINE },
  compactStepRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: LINE },
  compactStepIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(53,242,180,0.12)", marginRight: 11 },
  compactStepMain: { flex: 1 },
  compactStepTitle: { color: TEXT, fontSize: 16, fontWeight: "900" },
  compactStepSubtitle: { color: MUTED, fontSize: 13, fontWeight: "700", marginTop: 2 },
  compactStepBadge: { color: GREEN, fontSize: 12, fontWeight: "900" },
  navigationBlock: { gap: 14 },
  progressTrack: { height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: GREEN },
  activeCard: { padding: 16, borderRadius: 28, backgroundColor: CARD, borderWidth: 1, borderColor: LINE },
  activeTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activeRouteLabel: { color: TEXT, fontSize: 28, fontWeight: "900" },
  activeTime: { color: GREEN, fontSize: 27, fontWeight: "900" },
  liveEtaBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 22, borderWidth: 1, borderColor: "rgba(53,242,180,0.35)", backgroundColor: "rgba(53,242,180,0.12)", marginTop: 14 },
  liveEtaTitle: { color: "#DFFFF4", fontSize: 17, fontWeight: "900" },
  liveEtaSubtitle: { color: MUTED, fontSize: 13, fontWeight: "800", marginTop: 2 },
  currentStepBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 22, backgroundColor: CARD_SOFT, marginTop: 12 },
  currentStepIcon: { width: 44, height: 44, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: GREEN },
  currentStepTitle: { color: TEXT, fontSize: 17, fontWeight: "900" },
  currentStepSubtitle: { color: MUTED, fontSize: 13, fontWeight: "700", marginTop: 3 },
  currentStepTime: { color: TEXT, fontSize: 14, fontWeight: "900" },
  stopTimeline: { marginTop: 12, gap: 9 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineDot: { width: 11, height: 11, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.26)" },
  timelineDotActive: { backgroundColor: GREEN, shadowColor: GREEN, shadowOpacity: 0.4, shadowRadius: 10 },
  timelineText: { flex: 1, color: MUTED, fontSize: 14, fontWeight: "800" },
  timelineTextActive: { color: TEXT },
  timelineBadge: { color: GREEN, fontSize: 11, fontWeight: "900" },
  loadingBlock: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 28 },
  loadingText: { color: MUTED, fontWeight: "800" },
  emptyText: { color: MUTED, fontSize: 16, fontWeight: "700", lineHeight: 23, padding: 18, backgroundColor: CARD, borderRadius: 22 },
  footer: { position: "absolute", left: 24, right: 24, bottom: 26 },
  primaryButton: { height: 72, borderRadius: 28, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 12, backgroundColor: GREEN, shadowColor: GREEN, shadowOpacity: 0.32, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  primaryButtonText: { color: "#06241D", fontSize: 24, fontWeight: "900", letterSpacing: 0.8 },
});
