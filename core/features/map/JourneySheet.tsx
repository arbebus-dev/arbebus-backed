import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { TransitFlowState, TransitRouteOption } from "../transit/models/transitTypes";

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

function stateCopy(state: TransitFlowState, route: TransitRouteOption | null) {
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
        subtitle: "Skaičiuojame maršrutus iš tavo vietos.",
        icon: "location" as const,
      };
    case "routes_loading":
      return {
        title: "Ieškome geriausio maršruto",
        subtitle: "Tikriname stoteles, grafikus ir kelionės laiką.",
        icon: "sync" as const,
      };
    case "route_options":
      return {
        title: "Pasirink maršrutą",
        subtitle: "Apple Maps principas: variantai apačioje, kelias žemėlapyje.",
        icon: "bus" as const,
      };
    case "route_selected":
      return {
        title: `Autobusas ${route?.routeLabel || ""}`,
        subtitle: "Spausk GO ir pradėk kelionę.",
        icon: "navigate" as const,
      };
    case "walking_to_stop":
      return {
        title: "Eik iki stotelės",
        subtitle: route
          ? `${route.boardStopName} • apie ${Math.max(1, route.totalWalkMinutes || route.walkingMinutes || 1)} min pėsčiomis`
          : "Eik iki pažymėtos stotelės.",
        icon: "walk" as const,
      };
    case "waiting_bus":
      return {
        title: `Lauk autobuso ${route?.routeLabel || ""}`,
        subtitle: route?.etaMinutes != null ? `Atvyksta maždaug už ${route.etaMinutes} min` : "Stebėk autobusą žemėlapyje.",
        icon: "time" as const,
      };
    case "onboard":
      return {
        title: `Važiuok ${route?.stopCount || 0} stotelių`,
        subtitle: route ? `Išlipimas: ${route.alightStopName}` : "Sek kelionės eigą.",
        icon: "bus" as const,
      };
    case "transfer":
      return {
        title: "Persėsk į kitą autobusą",
        subtitle: "Sek kitą žingsnį apačioje.",
        icon: "swap-horizontal" as const,
      };
    case "arriving":
      return {
        title: "Išlipk kitoje stotelėje",
        subtitle: route ? route.alightStopName : "Artėjame prie tikslo.",
        icon: "flag" as const,
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

function RouteCard({
  route,
  selected,
  onPress,
}: {
  route: TransitRouteOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.routeCard, selected && styles.routeCardSelected]}>
      <View style={styles.routeBadge}>
        <Text style={styles.routeBadgeText}>{route.routeLabel}</Text>
      </View>

      <View style={styles.routeInfo}>
        <Text style={styles.routeTitle} numberOfLines={1}>
          {route.boardStopName} → {route.alightStopName}
        </Text>
        <Text style={styles.routeSubtitle} numberOfLines={1}>
          {route.totalDurationMinutes || route.totalMinutes || "?"} min • {route.stopCount || 0} st. • {route.transfersCount || 0} persėd.
        </Text>
      </View>

      <Text style={styles.eta}>{route.etaMinutes != null ? `${route.etaMinutes} min` : "ETA"}</Text>
    </Pressable>
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
  const copy = stateCopy(flowState, selectedRoute);
  const showRoutes = flowState === "route_options" && routeOptions.length > 0;
  const showGo = flowState === "route_selected";
  const showNext = ["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving"].includes(flowState);

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.headerRow}>
        <View style={styles.mainIcon}>
          <Ionicons name={copy.icon} size={22} color="#CFFFEA" />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>

        {flowState !== "idle" ? (
          <Pressable onPress={onReset} hitSlop={12}>
            <Ionicons name="close" size={22} color="#AEB7D8" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.statusPill}>Live autobusai: {liveBusCount}</Text>
        {selectedRoute ? <Text style={styles.statusPill}>Nr. {selectedRoute.routeLabel}</Text> : null}
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

      {selectedRoute && flowState !== "route_options" ? (
        <View style={styles.detailBox}>
          <Text style={styles.detailTitle}>Kelionė autobusu {selectedRoute.routeLabel}</Text>
          <Text style={styles.detailText}>Įlipk: {selectedRoute.boardStopName}</Text>
          <Text style={styles.detailText}>Išlipk: {selectedRoute.alightStopName}</Text>
          <Text style={styles.detailText}>
            Stotelės: {selectedRoute.stopCount || 0} • Persėdimai: {selectedRoute.transfersCount || 0}
          </Text>
        </View>
      ) : null}

      {showGo ? (
        <Pressable style={styles.primaryButton} onPress={onStartJourney}>
          <Text style={styles.primaryText}>GO</Text>
        </Pressable>
      ) : null}

      {showNext ? (
        <Pressable style={styles.primaryButton} onPress={onNextStep}>
          <Text style={styles.primaryText}>TOLIAU</Text>
        </Pressable>
      ) : null}

      {flowState === "completed" ? (
        <Pressable style={styles.primaryButton} onPress={onReset}>
          <Text style={styles.primaryText}>NAUJAS MARŠRUTAS</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "rgba(8,13,27,0.97)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    zIndex: 20,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.24)",
    marginBottom: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mainIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(58,255,184,0.14)",
  },
  headerText: { flex: 1 },
  title: { color: "white", fontSize: 20, fontWeight: "900" },
  subtitle: { color: "#AEB7D8", marginTop: 4, fontSize: 13, lineHeight: 18 },
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
  error: { color: "#FF8F8F", marginTop: 10, fontWeight: "700" },
  routeList: { gap: 10, paddingVertical: 14 },
  routeCard: {
    width: 292,
    minHeight: 86,
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  routeCardSelected: {
    borderColor: "rgba(58,255,184,0.8)",
    backgroundColor: "rgba(58,255,184,0.10)",
  },
  routeBadge: {
    minWidth: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35F2B4",
  },
  routeBadgeText: { color: "#03110B", fontSize: 18, fontWeight: "900" },
  routeInfo: { flex: 1 },
  routeTitle: { color: "white", fontSize: 14, fontWeight: "900" },
  routeSubtitle: { color: "#98A4C6", marginTop: 4, fontSize: 12 },
  eta: { color: "#CFFFEA", fontWeight: "900", fontSize: 13 },
  detailBox: { marginTop: 14, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.06)" },
  detailTitle: { color: "white", fontWeight: "900", marginBottom: 6 },
  detailText: { color: "#B8C2E4", marginTop: 3, fontSize: 13 },
  primaryButton: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35F2B4",
  },
  primaryText: { color: "#03110B", fontSize: 16, fontWeight: "900", letterSpacing: 0.6 },
});
