import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE } from "../../constants/api";

type FeedType = "all" | "world" | "transport" | "deal" | "update";
type LiveSectionStatus = "live" | "fallback" | "empty" | "error";

type NewsItem = {
  id: string;
  type: Exclude<FeedType, "all">;
  title: string;
  subtitle: string;
  badge?: string;
  cta?: string;
  accent?: string;
  icon:
    | keyof typeof Ionicons.glyphMap
    | keyof typeof MaterialCommunityIcons.glyphMap
    | string;
  iconLibrary: "ion" | "mdi";
  createdAt?: string;
  source?: string;
  url?: string;
  isLive?: boolean;
};

type NewsMeta = {
  partial?: boolean;
  sections?: Partial<Record<Exclude<FeedType, "all">, LiveSectionStatus>>;
  errors?: Array<{ section?: string; message?: string }>;
};

function normalizeItem(raw: any): NewsItem | null {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id || !raw.title || !raw.subtitle || !raw.type) return null;

  const allowedTypes = new Set(["world", "transport", "deal", "update"]);

  if (!allowedTypes.has(raw.type)) return null;

  return {
    id: String(raw.id),
    type: raw.type,
    title: String(raw.title),
    subtitle: String(raw.subtitle),
    badge: raw.badge ? String(raw.badge) : undefined,
    cta: raw.cta ? String(raw.cta) : undefined,
    accent: raw.accent ? String(raw.accent) : undefined,
    icon: raw.icon ? String(raw.icon) : "newspaper-outline",
    iconLibrary: raw.iconLibrary === "mdi" ? "mdi" : "ion",
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    source: raw.source ? String(raw.source) : undefined,
    url: raw.url ? String(raw.url) : undefined,
    isLive: Boolean(raw.isLive),
  };
}

function FeedIcon({ item }: { item: NewsItem }) {
  const color = item.accent || "#8ED8FF";

  if (item.iconLibrary === "mdi") {
    return (
      <MaterialCommunityIcons
        name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={20}
        color={color}
      />
    );
  }

  return (
    <Ionicons
      name={item.icon as keyof typeof Ionicons.glyphMap}
      size={20}
      color={color}
    />
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatusPill({
  label,
  value,
}: {
  label: string;
  value?: LiveSectionStatus;
}) {
  const activeValue = value || "empty";
  const isLive = activeValue === "live";

  return (
    <View
      style={[
        styles.statusPill,
        isLive ? styles.statusPillLive : styles.statusPillFallback,
      ]}
    >
      <Text style={styles.statusPillText}>
        {label}: {activeValue}
      </Text>
    </View>
  );
}

function NewsCard({
  item,
  onPress,
}: {
  item: NewsItem;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardGlow} />

      <View style={styles.cardTopRow}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: `${item.accent || "#8ED8FF"}18` },
          ]}
        >
          <FeedIcon item={item} />
        </View>

        <View style={styles.cardTextWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>

            {!!item.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </View>

          <Text style={styles.cardSubtitle} numberOfLines={4}>
            {item.subtitle}
          </Text>

          {(item.source || item.createdAt) && (
            <Text style={styles.metaText} numberOfLines={2}>
              {[item.isLive ? "LIVE" : "Fallback", item.source, item.createdAt]
                .filter(Boolean)
                .join(" • ")}
            </Text>
          )}
        </View>
      </View>

      {!!item.cta && !!item.url && (
        <View style={styles.cardFooter}>
          <Text style={styles.ctaText}>{item.cta}</Text>
          <Ionicons name="chevron-forward" size={16} color="#AFC3E6" />
        </View>
      )}
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="newspaper-outline" size={22} color="#DCEBFF" />
      </View>
      <Text style={styles.emptyTitle}>Naujienų kol kas nėra</Text>
      <Text style={styles.emptySubtitle}>
        Kai backend grąžins įrašus, jie atsiras čia.
      </Text>
    </View>
  );
}

export default function NewsScreen() {
  const [activeFilter, setActiveFilter] = useState<FeedType>("all");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [meta, setMeta] = useState<NewsMeta>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/news`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      const rawItems = Array.isArray(json) ? json : json?.items;

      if (!Array.isArray(rawItems)) {
        throw new Error("Invalid /news payload");
      }

      const normalized = rawItems
        .map(normalizeItem)
        .filter(Boolean) as NewsItem[];

      setItems(normalized);
      setMeta({
        partial: Boolean(json?.meta?.partial),
        sections: json?.meta?.sections || {},
        errors: Array.isArray(json?.meta?.errors) ? json.meta.errors : [],
      });
    } catch (error) {
      console.log("News fetch error:", error);
      setItems([]);
      setMeta({
        partial: true,
        errors: [{ section: "news", message: "Nepavyko užkrauti feed." }],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchNews();
  }, [fetchNews]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => item.type === activeFilter);
  }, [activeFilter, items]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNews(true);
  }, [fetchNews]);

  const handleOpenItem = useCallback(async (item: NewsItem) => {
    if (!item.url) return;

    try {
      const supported = await Linking.canOpenURL(item.url);
      if (supported) {
        await Linking.openURL(item.url);
      }
    } catch (error) {
      console.log("Open news url error:", error);
    }
  }, []);

  const heroFeedText = useMemo(() => {
    if (loading) return "Kraunama...";
    if (meta.partial) return "Partial live feed";
    return "Live BBC world news";
  }, [loading, meta.partial]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />

            <Text style={styles.eyebrow}>ARBEBUS NEWS</Text>
            <Text style={styles.heroTitle}>Pasaulio naujienos</Text>
            <Text style={styles.heroSubtitle}>
              Live pasaulio naujienos iš BBC RSS per Arbebus backend.
            </Text>

            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaBadge}>
                <Text style={styles.heroMetaText}>{heroFeedText}</Text>
              </View>

              <Pressable
                onPress={() => void fetchNews(true)}
                style={styles.refreshButton}
              >
                <Ionicons name="refresh-outline" size={16} color="#DCEBFF" />
              </Pressable>
            </View>

            <View style={styles.statusRow}>
              <StatusPill label="World" value={meta.sections?.world} />
              <StatusPill label="Transport" value={meta.sections?.transport} />
              <StatusPill label="Update" value={meta.sections?.update} />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            <FilterChip
              label="Visi"
              active={activeFilter === "all"}
              onPress={() => setActiveFilter("all")}
            />
            <FilterChip
              label="World"
              active={activeFilter === "world"}
              onPress={() => setActiveFilter("world")}
            />
            <FilterChip
              label="Transport"
              active={activeFilter === "transport"}
              onPress={() => setActiveFilter("transport")}
            />
            <FilterChip
              label="Deals"
              active={activeFilter === "deal"}
              onPress={() => setActiveFilter("deal")}
            />
            <FilterChip
              label="Updates"
              active={activeFilter === "update"}
              onPress={() => setActiveFilter("update")}
            />
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aktualu dabar</Text>
            <Text style={styles.sectionMeta}>
              {loading ? "..." : `${filteredItems.length} įrašai`}
            </Text>
          </View>

          {!!meta.errors?.length && !loading && (
            <View style={styles.warningCard}>
              <Ionicons name="warning-outline" size={16} color="#FFD37A" />
              <Text style={styles.warningText} numberOfLines={3}>
                Kai kurie šaltiniai laikinai neatsakė. Rodomas likęs feed be app crash.
              </Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator />
              <Text style={styles.loadingText}>Kraunamos live naujienos…</Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <EmptyState />
          ) : (
            filteredItems.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                onPress={() => void handleOpenItem(item)}
              />
            ))
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#07101D",
  },
  container: {
    flex: 1,
    backgroundColor: "#07101D",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginBottom: 16,
  },
  heroGlow: {
    position: "absolute",
    top: -18,
    left: 30,
    right: 30,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(71,182,255,0.08)",
  },
  eyebrow: {
    color: "#8FB7FF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#AFC3E6",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  heroMetaRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroMetaBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  heroMetaText: {
    color: "#EAF2FF",
    fontSize: 11,
    fontWeight: "800",
  },
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillLive: {
    backgroundColor: "rgba(34,197,94,0.16)",
  },
  statusPillFallback: {
    backgroundColor: "rgba(245,158,11,0.16)",
  },
  statusPillText: {
    color: "#EAF2FF",
    fontSize: 11,
    fontWeight: "800",
  },
  filtersRow: {
    paddingBottom: 10,
    paddingRight: 12,
  },
  filterChip: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    marginRight: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: "rgba(77,141,255,0.18)",
    borderColor: "rgba(77,141,255,0.28)",
  },
  filterChipText: {
    color: "#B7C8E6",
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  sectionHeader: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  sectionMeta: {
    color: "#8FA5C7",
    fontSize: 12,
    fontWeight: "700",
  },
  warningCard: {
    marginBottom: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,211,122,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,211,122,0.14)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  warningText: {
    flex: 1,
    color: "#FDE7B1",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  loadingWrap: {
    paddingVertical: 28,
    alignItems: "center",
  },
  loadingText: {
    color: "#AFC3E6",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  card: {
    borderRadius: 24,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginBottom: 12,
  },
  cardGlow: {
    position: "absolute",
    top: -24,
    left: 40,
    right: 40,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTextWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  cardTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  badgeText: {
    color: "#DCE7FF",
    fontSize: 10,
    fontWeight: "800",
  },
  cardSubtitle: {
    color: "#AFC3E6",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  metaText: {
    color: "#7E93B7",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaText: {
    color: "#EAF2FF",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 34,
    paddingHorizontal: 24,
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