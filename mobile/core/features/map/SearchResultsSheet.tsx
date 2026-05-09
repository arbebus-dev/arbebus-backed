import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { COLORS, LINE_HEIGHT, T, UI } from "@/core/theme/typography";
import { Ionicons } from "@expo/vector-icons";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import type { PlaceSearchResult } from "../transit/models/transitTypes";

type Props = {
  visible: boolean;
  results: PlaceSearchResult[];
  isLoading?: boolean;
  error?: string | null;
  onSelect: (result: PlaceSearchResult) => void;
};

function formatDistance(meters?: number) {
  if (!meters || meters <= 0) return "";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function iconForType(type?: string) {
  if (type === "stop") return "bus";
  if (type === "station") return "train";
  if (type === "ferry") return "boat";
  if (type === "address") return "home";
  if (type === "city" || type === "region") return "map";
  if (type === "poi") return "business";
  return "location";
}

function labelForType(type: string | undefined, t: any) {
  if (type === "stop") return t.common.stopLabel;
  if (type === "station") return t.common.stationLabel;
  if (type === "ferry") return t.common.ferryLabel;
  if (type === "address") return t.common.addressLabel;
  if (type === "city") return t.common.cityRegionLabel;
  if (type === "region") return t.common.regionLabel;
  if (type === "poi") return t.common.poiLabel;
  return t.common.poiLabel;
}

export default function SearchResultsSheet({
  visible,
  results,
  isLoading,
  error,
  onSelect,
}: Props) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  if (!visible) return null;
  const visibleResults = results.slice(0, 8);
  const showSkeleton = Boolean(isLoading && !visibleResults.length);
  return (
    <View style={[styles.sheet, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
      <View style={[styles.handle, { backgroundColor: theme.grabber }]} />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{t.common.searchHeaderTitle}</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>{t.common.searchHeaderSubtitle}</Text>
        </View>
        {isLoading ? <ActivityIndicator color={COLORS.green} /> : null}
      </View>
      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
      {!isLoading && !visibleResults.length ? (
        <Text style={[styles.empty, { color: theme.muted }]}>{t.common.searchEmptyExample}</Text>
      ) : null}
      {showSkeleton ? (
        <View style={styles.skeletonBox}>
          {[0, 1, 2].map((item) => (
            <View key={item} style={styles.skeletonRow}>
              <View style={[styles.skeletonIcon, { backgroundColor: theme.surfaceMuted }]} />
              <View style={styles.skeletonTextBox}>
                <View style={[styles.skeletonLineWide, { backgroundColor: theme.surfaceMuted }]} />
                <View style={[styles.skeletonLineSmall, { backgroundColor: theme.surfaceSoft }]} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {visibleResults.map((item) => {
          const distance = formatDistance(item.distanceMeters);
          const meta = [labelForType(item.type, t), distance, item.subtitle]
            .filter(Boolean)
            .join(" • ");
          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: theme.border },
                pressed && styles.rowPressed,
              ]}
              onPress={() => onSelect(item)}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
                <Ionicons
                  name={iconForType(item.type) as any}
                  size={16}
                  color={theme.accent}
                />
              </View>
              <View style={styles.textBox}>
                <Text style={[styles.resultTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.resultSubtitle, { color: theme.muted }]} numberOfLines={1}>
                  {meta}
                </Text>
              </View>
              <View style={[styles.goCircle, { backgroundColor: theme.accent }]}>
                <Ionicons name="navigate" size={15} color={theme.accentText} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "58%",
    paddingTop: 9,
    paddingHorizontal: UI.padXL,
    paddingBottom: 26,
    backgroundColor: "rgba(8, 13, 27, 0.985)",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    zIndex: 40,
    elevation: 40,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.26)",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 7,
  },
  title: {
    color: "white",
    fontSize: T.section,
    lineHeight: LINE_HEIGHT.section,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "700",
    marginTop: 3,
  },
  list: { paddingBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  rowPressed: { opacity: 0.7, transform: [{ scale: 0.995 }] },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(58,255,184,0.14)",
  },
  textBox: { flex: 1 },
  resultTitle: {
    color: "white",
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "900",
  },
  resultSubtitle: {
    color: COLORS.muted,
    marginTop: 2,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "700",
  },
  goCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.green,
  },
  empty: {
    color: COLORS.muted,
    paddingVertical: 14,
    lineHeight: LINE_HEIGHT.body,
    fontSize: T.body,
    fontWeight: "700",
  },
  error: {
    color: "#FF8F8F",
    paddingVertical: 8,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "700",
  },
  skeletonBox: { paddingVertical: 6 },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
  },
  skeletonIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  skeletonTextBox: { flex: 1, gap: 7 },
  skeletonLineWide: {
    width: "72%",
    height: 13,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  skeletonLineSmall: {
    width: "44%",
    height: 10,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
