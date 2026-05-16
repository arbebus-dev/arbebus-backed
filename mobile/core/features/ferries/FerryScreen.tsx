import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { COLORS, LINE_HEIGHT, T } from "@/core/theme/typography";
import { fetchFerryOverview } from "./services/ferryApi";
import type { FerryDeparture, FerryOverview, FerryRoute } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
};

function countdownText(minutes: number) {
  if (!Number.isFinite(minutes)) return "pagal grafiką";
  if (minutes <= 0) return "dabar";
  if (minutes < 60) return `po ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `po ${hours} val. ${rest} min` : `po ${hours} val.`;
}

function sourceLabel(route?: FerryRoute | FerryDeparture | null) {
  if (!route?.sourceName) return "oficialus statinis grafikas";
  return `${route.sourceName} • statinis grafikas`;
}

export default function FerryScreen({ visible, onClose }: Props) {
  const { theme } = useAppPreferences();
  const [data, setData] = useState<FerryOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchFerryOverview()
      .then((overview) => {
        if (!cancelled) setData(overview);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nepavyko gauti keltų grafiko");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const nextDepartures = data?.nextDepartures ?? [];
  const routes = data?.routes ?? [];
  const nextByRoute = useMemo(() => {
    const map = new Map<string, FerryDeparture>();
    for (const item of nextDepartures) {
      if (!map.has(item.routeId)) map.set(item.routeId, item);
    }
    return map;
  }, [nextDepartures]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={[styles.panel, { backgroundColor: theme.backgroundElevated, borderColor: theme.border, shadowColor: theme.shadow }]}> 
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}> 
            <MaterialCommunityIcons name="ferry" size={24} color={COLORS.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: theme.accent }]}>ARBEBUS</Text>
            <Text style={[styles.title, { color: theme.text }]}>Keltai</Text>
            <Text style={[styles.subtitle, { color: theme.muted }]}>Klaipėda, Smiltynė ir Nida</Text>
          </View>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              onClose();
            }}
            hitSlop={12}
            style={[styles.closeButton, { backgroundColor: theme.surfaceMuted }]}
          >
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={COLORS.green} />
            <Text style={[styles.centerText, { color: theme.muted }]}>Kraunamas keltų grafikas…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.warningBox, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
            <Text style={[styles.warningTitle, { color: theme.text }]}>Nepavyko atidaryti keltų</Text>
            <Text style={[styles.warningText, { color: theme.muted }]}>{error}</Text>
          </View>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {nextDepartures.length ? (
            <View style={[styles.nextCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Artimiausi išvykimai</Text>
              {nextDepartures.slice(0, 4).map((item) => (
                <View key={`${item.routeId}-${item.departureAt}`} style={[styles.nextRow, { borderBottomColor: theme.border }]}> 
                  <View style={[styles.timePill, { backgroundColor: theme.accentSoft }]}> 
                    <Text style={[styles.timeText, { color: theme.accent }]}>{item.departureTime}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.routeTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.routeMeta, { color: theme.muted }]}>
                      {countdownText(item.minutesUntil)} • kelionė ~{item.durationMinutes} min
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {routes.map((route) => {
            const next = nextByRoute.get(route.id);
            const departures = route.departures ?? route.schedule ?? [];
            return (
              <View key={route.id} style={[styles.routeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
                <View style={styles.routeHeader}>
                  <View style={[styles.routeIcon, { backgroundColor: theme.accentSoft }]}> 
                    <MaterialCommunityIcons name="ferry" size={18} color={COLORS.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.routeTitle, { color: theme.text }]}>{route.title}</Text>
                    <Text style={[styles.routeMeta, { color: theme.muted }]}>
                      {route.operator} • ~{route.durationMinutes} min
                    </Text>
                  </View>
                  {next ? (
                    <View style={[styles.nextMiniPill, { backgroundColor: theme.surfaceMuted }]}> 
                      <Text style={[styles.nextMiniText, { color: theme.text }]}>{next.departureTime}</Text>
                    </View>
                  ) : null}
                </View>

                {route.season ? (
                  <Text style={[styles.seasonText, { color: route.activeNow === false ? "#F5A623" : theme.muted }]}> 
                    Sezonas: {route.season.from} – {route.season.to}{route.activeNow === false ? " • ne sezono metu" : ""}
                  </Text>
                ) : null}

                <View style={styles.departuresWrap}>
                  {departures.slice(0, 18).map((time) => (
                    <View key={`${route.id}-${time}`} style={[styles.departureChip, { backgroundColor: theme.surfaceMuted }]}> 
                      <Text style={[styles.departureText, { color: theme.text }]}>{time}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.sourceText, { color: theme.dim }]}>{sourceLabel(route)}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 80,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  panel: {
    maxHeight: "88%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingTop: 14,
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 12 },
  headerIcon: { width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  kicker: { fontSize: T.tiny, lineHeight: LINE_HEIGHT.tiny, fontWeight: "900", letterSpacing: 1.2 },
  title: { fontSize: T.title, lineHeight: LINE_HEIGHT.title, fontWeight: "900" },
  subtitle: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700" },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 18, paddingBottom: 32, gap: 12 },
  centerBlock: { alignItems: "center", paddingVertical: 24, gap: 10 },
  centerText: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700" },
  warningBox: { marginHorizontal: 18, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
  warningTitle: { fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900" },
  warningText: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginTop: 4 },
  nextCard: { borderWidth: 1, borderRadius: 24, padding: 14 },
  sectionTitle: { fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900", marginBottom: 8 },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  timePill: { minWidth: 62, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  timeText: { fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900" },
  routeCard: { borderWidth: 1, borderRadius: 24, padding: 14 },
  routeHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  routeIcon: { width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  routeTitle: { fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900" },
  routeMeta: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginTop: 2 },
  nextMiniPill: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  nextMiniText: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
  seasonText: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "800", marginTop: 10 },
  departuresWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  departureChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  departureText: { fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
  sourceText: { fontSize: T.tiny, lineHeight: LINE_HEIGHT.tiny, fontWeight: "700", marginTop: 12 },
});
