import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type {
  Coordinate,
  TransitFlowState,
  TransitRouteOption,
  TransitStep,
} from "../transit/models/transitTypes";

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
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function stepTarget(route: TransitRouteOption | null, step: TransitStep | null): Coordinate | null {
  if (!route || !step) return null;

  const polyline = Array.isArray(step.polyline) ? step.polyline : [];
  const lastPoint = polyline.length ? toCoordinate(polyline[polyline.length - 1]) : null;

  if (step.type === "walk" || step.type === "board") {
    return lastPoint ?? route.originStop?.coordinate ?? toCoordinate(route.originStop);
  }

  if (step.type === "ride" || step.type === "bus" || step.type === "alight" || step.type === "arrive") {
    return lastPoint ?? route.destinationStop?.coordinate ?? toCoordinate(route.destinationStop);
  }

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

function primaryTitle(flowState: TransitFlowState, route: TransitRouteOption | null, step: TransitStep | null) {
  if (flowState === "walking_to_stop") return step?.title || `Eik iki stotelės „${route?.boardStopName || ""}“`.trim();
  if (flowState === "waiting_bus") return `Lauk autobuso ${route?.routeLabel || ""}`.trim();
  if (flowState === "onboard") return step?.title || `Važiuok autobusu ${route?.routeLabel || ""}`.trim();
  if (flowState === "transfer") return step?.title || "Persėsk";
  if (flowState === "arriving") return step?.title || `Išlipk: ${route?.alightStopName || "kita stotelė"}`;
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
  if (flowState === "walking_to_stop") return "ATĖJAU";
  if (flowState === "waiting_bus") return "ĮLIPAU";
  if (flowState === "onboard") return "TOLIAU";
  if (flowState === "transfer") return "PERSĖDAU";
  if (flowState === "arriving") return "IŠLIPAU";
  if (flowState === "completed") return "BAIGTA";
  return "TOLIAU";
}

export default function NavigationHUD({
  flowState,
  route,
  activeStep,
  currentStepIndex,
  userLocation,
  onNextStep,
  onReset,
}: Props) {
  const target = useMemo(() => stepTarget(route, activeStep), [route, activeStep]);

  const distance = useMemo(() => {
    if (!userLocation || !target) return null;
    return distanceMeters(userLocation, target);
  }, [target, userLocation]);

  if (!route || !isNavigationActive(flowState)) return null;

  const distanceLabel = metersText(distance);
  const title = primaryTitle(flowState, route, activeStep);
  const subtitle = secondaryText(flowState, route, activeStep, distanceLabel);
  const stepsCount = route.journeySteps?.length || route.steps?.length || 0;
  const icon = iconForFlow(flowState, activeStep);
  const isCompleted = flowState === "completed";

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={icon as any} size={24} color="#06130E" />
          </View>
          <View style={styles.mainText}>
            <Text style={styles.kicker}>ARBE NAVIGATION</Text>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
          </View>
          <Pressable onPress={onReset} style={styles.closeButton}>
            <Ionicons name="close" size={18} color="#D8FBEF" />
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.progressPill}>
            <Text style={styles.progressText}>
              {stepsCount ? `${Math.min(currentStepIndex + 1, stepsCount)}/${stepsCount}` : "GO"}
            </Text>
          </View>
          <View style={styles.routePill}>
            <Text style={styles.routePillText}>BUS {route.routeLabel}</Text>
          </View>
          <Pressable
            onPress={isCompleted ? onReset : onNextStep}
            style={[styles.actionButton, isCompleted && styles.doneButton]}
          >
            <Text style={styles.actionText}>{isCompleted ? "UŽDARYTI" : actionText(flowState)}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 96,
    left: 14,
    right: 14,
    zIndex: 50,
  },
  card: {
    borderRadius: 28,
    padding: 14,
    backgroundColor: "rgba(4, 10, 14, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(80, 255, 190, 0.28)",
    shadowColor: "#00FFC2",
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35F2B4",
  },
  mainText: { flex: 1 },
  kicker: {
    color: "#70FFD0",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 3,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
  },
  subtitle: {
    color: "#B9C8D5",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  progressPill: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressText: { color: "#EFFFF8", fontSize: 12, fontWeight: "900" },
  routePill: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(53,242,180,0.12)",
    borderWidth: 1,
    borderColor: "rgba(53,242,180,0.28)",
  },
  routePillText: { color: "#70FFD0", fontSize: 12, fontWeight: "900" },
  actionButton: {
    marginLeft: "auto",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#35F2B4",
  },
  doneButton: { backgroundColor: "#69E1FF" },
  actionText: { color: "#04100C", fontSize: 12, fontWeight: "900" },
});
