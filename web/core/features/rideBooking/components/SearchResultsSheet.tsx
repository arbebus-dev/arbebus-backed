import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PlaceSuggestion } from "../models";

type Props = {
  visible: boolean;
  results: PlaceSuggestion[];
  onSelect: (item: PlaceSuggestion) => void;
  onClose: () => void;
  loading?: boolean;
  query?: string;
  recentResults?: PlaceSuggestion[];
  homeLabel?: string | null;
  workLabel?: string | null;
  onQuickHome?: () => void;
  onQuickWork?: () => void;
};

function getSuggestionMeta(item: PlaceSuggestion) {
  const title = (item.title || "").toLowerCase();
  const subtitle = (item.subtitle || "").toLowerCase();

  if (item.id.startsWith("recent:")) {
    return {
      iconType: "ion" as const,
      iconName: "time-outline",
      iconColor: "#8ED8FF",
      iconBg: "rgba(71, 182, 255, 0.14)",
      badge: "Recent",
    };
  }

  if (
    title.includes("station") ||
    title.includes("stotel") ||
    subtitle.includes("station") ||
    subtitle.includes("stotel")
  ) {
    return {
      iconType: "mdi" as const,
      iconName: "bus-stop",
      iconColor: "#C7A7FF",
      iconBg: "rgba(199, 167, 255, 0.14)",
      badge: "Stop",
    };
  }

  if (
    title.includes("airport") ||
    title.includes("oro uost") ||
    subtitle.includes("airport") ||
    subtitle.includes("oro uost")
  ) {
    return {
      iconType: "mdi" as const,
      iconName: "airplane",
      iconColor: "#7CE7A2",
      iconBg: "rgba(124, 231, 162, 0.14)",
      badge: "Airport",
    };
  }

  if (
    /\d/.test(title) ||
    subtitle.includes("gatv") ||
    subtitle.includes("street") ||
    subtitle.includes("avenue")
  ) {
    return {
      iconType: "mdi" as const,
      iconName: "map-marker-path",
      iconColor: "#FFD782",
      iconBg: "rgba(255, 215, 130, 0.15)",
      badge: "Address",
    };
  }

  if (
    title.includes("shop") ||
    title.includes("mall") ||
    title.includes("park") ||
    title.includes("hotel") ||
    title.includes("restaurant") ||
    title.includes("cafe") ||
    title.includes("kavin") ||
    title.includes("maxima") ||
    title.includes("iki") ||
    title.includes("rimi")
  ) {
    return {
      iconType: "mdi" as const,
      iconName: "storefront-outline",
      iconColor: "#7CE7A2",
      iconBg: "rgba(124, 231, 162, 0.14)",
      badge: "POI",
    };
  }

  if (
    title.includes("klaip") ||
    title.includes("viln") ||
    title.includes("kaun") ||
    subtitle.includes("lithuania") ||
    subtitle.includes("lietuva")
  ) {
    return {
      iconType: "ion" as const,
      iconName: "business-outline",
      iconColor: "#AFC3E6",
      iconBg: "rgba(175, 195, 230, 0.14)",
      badge: "City",
    };
  }

  return {
    iconType: "ion" as const,
    iconName: "location-outline",
    iconColor: "#8ED8FF",
    iconBg: "rgba(71, 182, 255, 0.14)",
    badge: "Place",
  };
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function QuickActionCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickCard} onPress={onPress}>
      <View style={styles.quickIconWrap}>{icon}</View>

      <View style={styles.quickTextWrap}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#8FA5C7" />
    </Pressable>
  );
}

function ResultRow({
  item,
  onPress,
}: {
  item: PlaceSuggestion;
  onPress: () => void;
}) {
  const meta = getSuggestionMeta(item);

  return (
    <Pressable style={styles.resultRow} onPress={onPress}>
      <View style={[styles.resultIconWrap, { backgroundColor: meta.iconBg }]}>
        {meta.iconType === "ion" ? (
          <Ionicons
            name={meta.iconName as any}
            size={18}
            color={meta.iconColor}
          />
        ) : (
          <MaterialCommunityIcons
            name={meta.iconName as any}
            size={18}
            color={meta.iconColor}
          />
        )}
      </View>

      <View style={styles.resultTextWrap}>
        <View style={styles.titleBadgeRow}>
          <Text style={styles.resultTitle} numberOfLines={1}>
            {item.title}
          </Text>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>{meta.badge}</Text>
          </View>
        </View>

        {!!item.subtitle ? (
          <Text style={styles.resultSubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  loading?: boolean;
}) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        {loading ? (
          <ActivityIndicator color="#DCEBFF" />
        ) : (
          <Ionicons name={icon} size={22} color="#DCEBFF" />
        )}
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function SearchResultsSheet({
  visible,
  results,
  onSelect,
  onClose,
  loading = false,
  query = "",
  recentResults = [],
  homeLabel,
  workLabel,
  onQuickHome,
  onQuickWork,
}: Props) {
  const normalizedQuery = query.trim();

  const hasQuery = normalizedQuery.length > 0;
  const hasResults = results.length > 0;
  const hasRecent = recentResults.length > 0;
  const hasSaved = Boolean(homeLabel || workLabel);

  const dedupedRecent = useMemo(() => {
    const map = new Map<string, PlaceSuggestion>();

    recentResults.forEach((item) => {
      const key = `${item.title}|${item.subtitle || ""}`.toLowerCase();
      if (!map.has(key)) {
        map.set(key, item);
      }
    });

    return Array.from(map.values()).slice(0, 5);
  }, [recentResults]);

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Search</Text>
            <Text style={styles.headerSubtitle}>
              {hasQuery
                ? "Adresai, gatvės, miestai, POI"
                : "Recent paieškos ir greiti pasirinkimai"}
            </Text>
          </View>

          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={18} color="#EAF2FF" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {hasSaved ? (
            <>
              <SectionHeader title="Greiti pasirinkimai" />

              <View style={styles.quickList}>
                {homeLabel && onQuickHome ? (
                  <QuickActionCard
                    title="Home"
                    subtitle={homeLabel}
                    onPress={onQuickHome}
                    icon={
                      <Ionicons name="home-outline" size={18} color="#8ED8FF" />
                    }
                  />
                ) : null}

                {workLabel && onQuickWork ? (
                  <QuickActionCard
                    title="Work"
                    subtitle={workLabel}
                    onPress={onQuickWork}
                    icon={
                      <Ionicons
                        name="briefcase-outline"
                        size={18}
                        color="#7CE7A2"
                      />
                    }
                  />
                ) : null}
              </View>
            </>
          ) : null}

          {!hasQuery && hasRecent ? (
            <>
              <SectionHeader title="Recent searches" />

              <View style={styles.resultsGroup}>
                {dedupedRecent.map((item) => (
                  <ResultRow
                    key={item.id}
                    item={item}
                    onPress={() => onSelect(item)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {loading ? (
            <EmptyState
              icon="search-outline"
              title="Ieškome vietų..."
              subtitle="Tikriname adresus, gatves, miestus ir POI"
              loading
            />
          ) : null}

          {!loading && hasQuery && hasResults ? (
            <>
              <SectionHeader title="Results" />

              <View style={styles.resultsGroup}>
                {results.map((item) => (
                  <ResultRow
                    key={item.id}
                    item={item}
                    onPress={() => onSelect(item)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {!loading && hasQuery && !hasResults ? (
            <EmptyState
              icon="locate-outline"
              title="Nieko neradome"
              subtitle="Pabandyk tikslesnį adresą, vietą ar POI pavadinimą"
            />
          ) : null}

          {!loading && !hasQuery && !hasRecent && !hasSaved ? (
            <EmptyState
              icon="sparkles-outline"
              title="Pradėk paiešką"
              subtitle="Įvesk adresą, gatvę, miestą arba vietos pavadinimą"
            />
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 232,
    left: 16,
    right: 16,
    zIndex: 29,
  },
  sheet: {
    maxHeight: 440,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "rgba(8, 15, 29, 0.97)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 3,
  },
  headerSubtitle: {
    color: "#90A7CB",
    fontSize: 12,
    fontWeight: "600",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    maxHeight: 372,
  },
  contentContainer: {
    paddingTop: 10,
    paddingBottom: 14,
  },
  sectionHeader: {
    color: "#8FA5C7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  quickList: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 10,
  },
  quickCard: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  quickTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  quickTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  quickSubtitle: {
    color: "#9FB1CC",
    fontSize: 12,
    fontWeight: "600",
  },
  resultsGroup: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 18,
    marginHorizontal: 4,
  },
  resultIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },
  resultTextWrap: {
    flex: 1,
    paddingRight: 4,
  },
  titleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  resultTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  resultSubtitle: {
    color: "#9FB1CC",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  badgeText: {
    color: "#D8E6FF",
    fontSize: 10,
    fontWeight: "800",
  },
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptySubtitle: {
    color: "#9FB1CC",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    textAlign: "center",
  },
});