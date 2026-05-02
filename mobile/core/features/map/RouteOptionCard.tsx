import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { TransitRouteOption } from "../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption;
  selected?: boolean;
  onPress?: () => void;
};

function cleanRouteNumber(value?: string | null) {
  return String(value || "")
    .split("•")[0]
    .trim();
}

function getRouteNumbers(route: TransitRouteOption): string[] {
  if (Array.isArray(route.routeNumbers) && route.routeNumbers.length) {
    return route.routeNumbers.map(cleanRouteNumber);
  }

  return route.routeLabel
    ?.split("→")
    .map((x) => cleanRouteNumber(x))
    .filter(Boolean) || [];
}

function getSummary(route: TransitRouteOption) {
  const duration =
    route.totalDurationMinutes || route.totalMinutes || 0;

  const walk =
    route.totalWalkMinutes || route.walkingMinutes || 0;

  const bus =
    route.totalBusMinutes != null
      ? route.totalBusMinutes
      : Math.max(0, duration - walk);

  const transfers =
    route.transfersCount ?? route.transfers ?? 0;

  const stops = route.stopCount ?? 0;

  const eta =
    route.liveEta?.etaMinutes ?? route.etaMinutes ?? null;

  return {
    duration,
    walk,
    bus,
    transfers,
    stops,
    eta,
  };
}

export default function RouteOptionCard({
  route,
  selected,
  onPress,
}: Props) {
  const numbers = useMemo(() => getRouteNumbers(route), [route]);
  const summary = useMemo(() => getSummary(route), [route]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        selected && styles.containerSelected,
      ]}
    >
      {/* LEFT BADGE */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {numbers.length ? numbers.join("→") : route.routeLabel}
        </Text>
      </View>

      {/* INFO */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.duration}>
            {summary.duration} min
          </Text>

          {summary.transfers > 0 && (
            <Text style={styles.transferBadge}>
              {summary.transfers} persėd.
            </Text>
          )}
        </View>

        <Text style={styles.subtitle}>
          {summary.walk} min ėjimo • {summary.stops} st.
        </Text>

        <Text style={styles.hint}>
          {summary.eta != null
            ? `Autobusas po ${summary.eta} min`
            : `${route.boardStopName} → ${route.alightStopName}`}
        </Text>
      </View>

      {/* RIGHT ICON */}
      <Ionicons
        name={selected ? "checkmark-circle" : "chevron-forward"}
        size={22}
        color={selected ? "#35F2B4" : "#AEB7D8"}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 300,
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  containerSelected: {
    borderColor: "#35F2B4",
    backgroundColor: "rgba(53,242,180,0.1)",
  },

  badge: {
    width: 70,
    height: 55,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35F2B4",
    paddingHorizontal: 6,
  },

  badgeText: {
    color: "#03110B",
    fontWeight: "900",
    fontSize: 12,
    textAlign: "center",
  },

  info: {
    flex: 1,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  duration: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
  },

  transferBadge: {
    backgroundColor: "#FFB84D",
    color: "#03110B",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  subtitle: {
    marginTop: 4,
    color: "#AEB7D8",
    fontSize: 12,
  },

  hint: {
    marginTop: 4,
    color: "#35F2B4",
    fontSize: 11,
    fontWeight: "700",
  },
});