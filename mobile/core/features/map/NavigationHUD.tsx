import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, LINE_HEIGHT, T, UI } from "@/core/theme/typography";
import { cleanRouteNumber, cleanStopName } from "../transit/models/journeyStateMachine";
import type { Coordinate, TransitFlowState, TransitRouteOption, TransitStep } from "../transit/models/transitTypes";

type Props = {
  flowState: TransitFlowState;
  route: TransitRouteOption | null;
  activeStep: TransitStep | null;
  currentStepIndex: number;
  userLocation: Coordinate | null;
  onNextStep: () => void;
  onReset: () => void;
};

function isNavigationActive(flowState: TransitFlowState) {
  return ["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving", "completed"].includes(flowState);
}

function toCoordinate(input: any): Coordinate | null {
  const latitude = Number(input?.latitude ?? input?.lat ?? input?.coordinate?.latitude);
  const longitude = Number(input?.longitude ?? input?.lon ?? input?.lng ?? input?.coordinate?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function stepTarget(route: TransitRouteOption | null, step: TransitStep | null): Coordinate | null {
  if (!route || !step) return null;
  const polyline = Array.isArray(step.polyline) ? step.polyline : [];
  const lastPoint = polyline.length ? toCoordinate(polyline[polyline.length - 1]) : null;
  if (step.type === "walk" || step.type === "board") return lastPoint ?? route.originStop?.coordinate ?? toCoordinate(route.originStop);
  return lastPoint ?? route.destinationStop?.coordinate ?? toCoordinate(route.destinationStop);
}

function metersText(meters: number | null) {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function iconForFlow(flowState: TransitFlowState, step?: TransitStep | null) {
  if (flowState === "walking_to_stop" || step?.type === "walk") return "walk";
  if (flowState === "waiting_bus" || step?.type === "board") return "bus-clock";
  if (flowState === "onboard" || step?.type === "ride" || step?.type === "bus") return "bus";
  if (flowState === "transfer" || step?.type === "transfer") return "swap-horizontal";
  if (flowState === "arriving" || step?.type === "alight" || step?.type === "arrive") return "flag-checkered";
  if (flowState === "completed") return "check-circle";
  return "navigation";
}

function routeLabel(route: TransitRouteOption | null) {
  return cleanRouteNumber(route?.routeNumbers?.[0] || route?.routeLabel || route?.routeId || route?.title) || "BUS";
}

function primaryTitle(flowState: TransitFlowState, route: TransitRouteOption | null, step: TransitStep | null) {
  const label = routeLabel(route);
  if (flowState === "walking_to_stop") return step?.title || "Eik iki stotelės";
  if (flowState === "waiting_bus") return `Lauk ${label}`;
  if (flowState === "onboard") return step?.title || `Važiuok ${label}`;
  if (flowState === "transfer") return step?.title || "Persėsk";
  if (flowState === "arriving") return step?.title || `Išlipk: ${cleanStopName(route?.alightStopName)}`;
  if (flowState === "completed") return "Atvykai";
  return step?.title || "Navigacija";
}

function secondaryText(flowState: TransitFlowState, route: TransitRouteOption | null, step: TransitStep | null, distance: string | null) {
  if (flowState === "completed") return "Kelionė baigta.";
  if (distance) return `${distance} iki kito veiksmo`;
  if (step?.description) return step.description;
  if (flowState === "waiting_bus") {
    const eta = route?.liveEta?.etaMinutes ?? route?.etaMinutes;
    return eta != null ? `Atvyksta po ${eta} min` : "Stebėk autobusą žemėlapyje";
  }
  return route?.journeyMessage || "Sek žingsnį ir žemėlapio liniją.";
}

function actionText(flowState: TransitFlowState) {
  if (flowState === "walking_to_stop") return "Atėjau";
  if (flowState === "waiting_bus") return "Įlipau";
  if (flowState === "onboard") return "Toliau";
  if (flowState === "transfer") return "Persėdau";
  if (flowState === "arriving") return "Išlipau";
  if (flowState === "completed") return "Baigta";
  return "Toliau";
}

export default function NavigationHUD({ flowState, route, activeStep, currentStepIndex, userLocation, onNextStep, onReset }: Props) {
  const { theme } = useAppPreferences();
  const target = useMemo(() => stepTarget(route, activeStep), [route, activeStep]);
  const distance = useMemo(() => (userLocation && target ? distanceMeters(userLocation, target) : null), [target, userLocation]);
  if (!route || !isNavigationActive(flowState)) return null;

  const stepsCount = route.journeySteps?.length || route.steps?.length || 0;
  const icon = iconForFlow(flowState, activeStep);
  const isCompleted = flowState === "completed";
  const title = primaryTitle(flowState, route, activeStep);
  const subtitle = secondaryText(flowState, route, activeStep, metersText(distance));

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow, shadowOpacity: theme.isLight ? 0.14 : 0.35 }]}>
        <View style={styles.topRow}>
          <View style={[styles.iconCircle, { backgroundColor: theme.accent }]}><MaterialCommunityIcons name={icon as any} size={18} color={theme.accentText} /></View>
          <View style={styles.mainText}>
            <Text style={[styles.kicker, { color: theme.accent }]}>ARBE NAVIGATION</Text>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]} numberOfLines={1}>{subtitle}</Text>
          </View>
          <Pressable onPress={onReset} style={[styles.closeButton, { backgroundColor: theme.surfaceMuted }]}><Ionicons name="close" size={16} color={theme.text} /></Pressable>
        </View>
        <View style={styles.bottomRow}>
          <View style={[styles.progressPill, { backgroundColor: theme.surfaceMuted }]}><Text style={[styles.progressText, { color: theme.text }]}>{stepsCount ? `${Math.min(currentStepIndex + 1, stepsCount)}/${stepsCount}` : "GO"}</Text></View>
          <View style={[styles.routePill, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}><Text style={[styles.routePillText, { color: theme.accent }]}>{routeLabel(route)}</Text></View>
          <Pressable onPress={isCompleted ? onReset : onNextStep} style={[styles.action, { backgroundColor: theme.accent }, isCompleted && styles.actionDone]}>
            <Text style={[styles.actionText, { color: theme.accentText }]}>{actionText(flowState)}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", top: 92, left: 16, right: 16, zIndex: 35, elevation: 35 },
  card: { padding: UI.padL, borderRadius: 22, backgroundColor: "rgba(5, 9, 20, 0.88)", borderWidth: 1, borderColor: "rgba(53,242,180,0.16)", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  topRow: { flexDirection: "row", alignItems: "center", gap: UI.gapM },
  iconCircle: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.green },
  mainText: { flex: 1 },
  kicker: { color: COLORS.green, fontSize: T.tiny, lineHeight: LINE_HEIGHT.tiny, letterSpacing: 1.1, fontWeight: "900" },
  title: { color: COLORS.text, fontSize: T.card, lineHeight: LINE_HEIGHT.card, fontWeight: "900", marginTop: 1 },
  subtitle: { color: COLORS.muted, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginTop: 1 },
  closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  bottomRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: UI.gapM },
  progressPill: { height: 32, minWidth: 44, paddingHorizontal: 10, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" },
  progressText: { color: COLORS.text, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
  routePill: { height: 32, paddingHorizontal: 12, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(53,242,180,0.55)", backgroundColor: "rgba(53,242,180,0.10)" },
  routePillText: { color: COLORS.green, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
  action: { marginLeft: "auto", height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.green },
  actionDone: { backgroundColor: "#FF5A5F" },
  actionText: { color: COLORS.greenDark, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
});
