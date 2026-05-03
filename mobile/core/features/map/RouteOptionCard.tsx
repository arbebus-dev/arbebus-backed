import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, LINE_HEIGHT, T } from "@/core/theme/typography";
import { cleanRouteNumber } from "../transit/models/journeyStateMachine";
import type { TransitRouteOption } from "../transit/models/transitTypes";

type Props = { route: TransitRouteOption; selected?: boolean; onPress?: () => void };

function getRouteNumbers(route: TransitRouteOption): string[] {
  if (Array.isArray(route.routeNumbers) && route.routeNumbers.length) return route.routeNumbers.map(cleanRouteNumber).filter(Boolean);
  return route.routeLabel?.split("→").map(cleanRouteNumber).filter(Boolean) || [cleanRouteNumber(route.routeId || route.title || "BUS")];
}

function getSummary(route: TransitRouteOption) {
  const duration = route.totalDurationMinutes || route.totalMinutes || 0;
  const walk = route.totalWalkMinutes || route.walkingMinutes || 0;
  const transfers = route.transfersCount ?? route.transfers ?? 0;
  const stops = route.stopCount ?? 0;
  const eta = route.liveEta?.etaMinutes ?? route.etaMinutes ?? null;
  return { duration, walk, transfers, stops, eta };
}

export default function RouteOptionCard({ route, selected, onPress }: Props) {
  const numbers = useMemo(() => getRouteNumbers(route), [route]);
  const summary = useMemo(() => getSummary(route), [route]);
  return (
    <Pressable onPress={onPress} style={[styles.container, selected && styles.containerSelected]}>
      <View style={styles.badge}><Text style={styles.badgeText} numberOfLines={1}>{numbers.join("→")}</Text></View>
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.duration}>{summary.duration} min</Text>
          {summary.transfers > 0 ? <Text style={styles.transferBadge}>{summary.transfers} pers.</Text> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>{summary.walk} min ėjimo • {summary.stops} st.</Text>
        <Text style={styles.hint} numberOfLines={1}>{summary.eta != null && summary.eta < 90 ? `Autobusas po ${summary.eta} min` : `${route.boardStopName} → ${route.alightStopName}`}</Text>
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "chevron-forward"} size={18} color={selected ? COLORS.green : COLORS.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { width: 284, borderRadius: 16, padding: 10, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: COLORS.soft, borderWidth: 1, borderColor: COLORS.line },
  containerSelected: { borderColor: COLORS.green, backgroundColor: "rgba(53,242,180,0.10)" },
  badge: { width: 52, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.green, paddingHorizontal: 5 },
  badgeText: { color: COLORS.greenDark, fontWeight: "900", fontSize: T.badge, lineHeight: LINE_HEIGHT.badge, textAlign: "center" },
  info: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  duration: { color: COLORS.text, fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900" },
  transferBadge: { color: COLORS.green, fontSize: T.badge, lineHeight: LINE_HEIGHT.badge, fontWeight: "900" },
  subtitle: { color: COLORS.muted, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginTop: 2 },
  hint: { color: COLORS.dim, fontSize: T.badge, lineHeight: LINE_HEIGHT.badge, fontWeight: "700", marginTop: 2 },
});
