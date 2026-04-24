import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { PlaceSuggestion } from "../../core/features/rideBooking/models";
import type { TravelMode } from "../../types/home";
import {
  getPrimaryButtonIcon,
  getPrimaryButtonLabel,
} from "../../utils/homeUi";
import UltraPressable from "../ui/UltraPressable";

type Recommendation = {
  id: string;
  icon?: string | null;
  title?: string | null;
  subtitle?: string | null;
  price?: string | null;
  etaLabel?: string | null;
  description?: string | null;
  accent?: string | null;
  rightIcons?: string[] | null;
  journeyBadges?:
    | {
        icon?: string | null;
        label?: string | null;
      }[]
    | null;
  journeySteps?:
    | {
        icon?: string | null;
        title?: string | null;
        subtitle?: string | null;
      }[]
    | null;
  notice?: string | null;
  mode?:
    | "smart"
    | "taxi"
    | "scooter"
    | "bus"
    | "walk"
    | "train"
    | "airport"
    | null;
};

type SearchField = "from" | "to";

type Props = {
  translateY: Animated.Value | Animated.AnimatedInterpolation<string | number>;
  panResponder: any;
  sheetContentBottomPadding: number;
  smartCardOpacity:
    | Animated.Value
    | Animated.AnimatedInterpolation<string | number>;
  smartCardTranslateY:
    | Animated.Value
    | Animated.AnimatedInterpolation<string | number>;
  ctaPulse: Animated.Value | Animated.AnimatedInterpolation<string | number>;
  selectedMode: TravelMode;
  eta: number | null;
  isPro: boolean;
  rideStatus: string;
  liveEtaSeconds: number | null;
  getFinalMode: () => string | null;
  formatEtaCountdown: (seconds: number | null) => string;
  selectedRecommendation?: Recommendation | null;
  recommendations?: Recommendation[];
  selectedRecommendationId?: string;
  onSelectRecommendation?: (id: string) => void;
  homeLocation: string | null;
  workLocation: string | null;
  selectedBus: any;
  pickupLabel?: string;
  destinationLabel?: string;
  routeSummaryText?: string;
  onSelectSmart: () => void | Promise<void>;
  onSelectTaxi: () => void | Promise<void>;
  onSelectScooter: () => void | Promise<void>;
  onSelectBus: () => void | Promise<void>;
  onSelectTrain: () => void | Promise<void>;
  onSelectAirport: () => void | Promise<void>;
  onQuickHome: () => void | Promise<void>;
  onQuickWork: () => void | Promise<void>;
  onQuickAirport: () => void | Promise<void>;
  onSaveHome: () => void | Promise<void>;
  onSaveWork: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onPrimaryAction: () => void | Promise<void>;
  onOpenPro: () => void | Promise<void>;
  fromQuery: string;
  toQuery: string;
  activeField: SearchField;
  onFocusField: (field: SearchField) => void;
  onChangeQuery: (value: string) => void;
  onSwap: () => void;
  onClearField: (field: SearchField) => void;
  searchResults: PlaceSuggestion[];
  searchLoading: boolean;
  isSearchExpanded: boolean;
  onSelectSuggestion: (item: PlaceSuggestion) => void;
};

function SearchRow({
  label,
  value,
  placeholder,
  field,
  activeField,
  onFocusField,
  onChangeQuery,
  onClearField,
  icon,
}: {
  label: string;
  value: string;
  placeholder: string;
  field: SearchField;
  activeField: SearchField;
  onFocusField: (field: SearchField) => void;
  onChangeQuery: (value: string) => void;
  onClearField: (field: SearchField) => void;
  icon: React.ReactNode;
}) {
  const active = activeField === field;

  return (
    <Pressable
      onPress={() => onFocusField(field)}
      style={[styles.searchRow, active && styles.searchRowActive]}
    >
      <View style={styles.searchIconWrap}>{icon}</View>

      <View style={styles.searchTextWrap}>
        <Text style={styles.searchLabel}>{label}</Text>
        <TextInput
          value={value}
          onFocus={() => onFocusField(field)}
          onChangeText={onChangeQuery}
          placeholder={placeholder}
          placeholderTextColor="#7F92B2"
          style={styles.searchInput}
        />
      </View>

      {value ? (
        <Pressable
          onPress={() => onClearField(field)}
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={18} color="#AFC3E6" />
        </Pressable>
      ) : (
        <View style={styles.clearPlaceholder} />
      )}
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
  return (
    <Pressable style={styles.resultRow} onPress={onPress}>
      <View style={styles.resultIconWrap}>
        <Ionicons name="location-outline" size={18} color="#8ED8FF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {item.title}
        </Text>
        {!!item.subtitle ? (
          <Text style={styles.resultSubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function getJourneyTimeWindow(etaText?: string | null) {
  const now = new Date();
  const etaMinutes = (() => {
    if (!etaText) return 7;
    const parsed = parseInt(etaText, 10);
    return Number.isFinite(parsed) ? parsed : 7;
  })();

  const end = new Date(now.getTime() + etaMinutes * 60 * 1000);
  const pad = (v: number) => v.toString().padStart(2, "0");

  return `${pad(now.getHours())}:${pad(now.getMinutes())} - ${pad(
    end.getHours()
  )}:${pad(end.getMinutes())}`;
}

function getModeAccent(mode?: Recommendation["mode"] | TravelMode | null) {
  if (mode === "taxi") return "#FBBF24";
  if (mode === "bus") return "#60A5FA";
  if (mode === "train") return "#C084FC";
  if (mode === "airport") return "#34D399";
  if (mode === "scooter") return "#22D3EE";
  if (mode === "walk") return "#22C55E";
  return "#60A5FA";
}

function Badge({
  icon,
  label,
  accent,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  accent: string;
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          borderColor: `${accent}30`,
          backgroundColor: `${accent}12`,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={14} color={accent} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function TimelineStep({
  icon,
  title,
  subtitle,
  accent,
  isLast,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  accent: string;
  isLast?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineLeft}>
        <View
          style={[
            styles.timelineDot,
            {
              borderColor: `${accent}35`,
              backgroundColor: `${accent}14`,
            },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={13} color={accent} />
        </View>
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>

      <View style={styles.timelineContent}>
        <Text style={styles.timelineTitle} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle ? (
          <Text style={styles.timelineSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

function HomeBottomSheet({
  translateY,
  panResponder,
  sheetContentBottomPadding,
  smartCardOpacity,
  smartCardTranslateY,
  ctaPulse,
  selectedMode,
  eta,
  isPro,
  rideStatus,
  liveEtaSeconds,
  getFinalMode,
  formatEtaCountdown,
  selectedRecommendation,
  recommendations = [],
  selectedRecommendationId,
  onSelectRecommendation,
  homeLocation,
  workLocation,
  selectedBus,
  pickupLabel,
  destinationLabel,
  routeSummaryText,
  onSelectSmart,
  onSelectTaxi,
  onSelectScooter,
  onSelectBus,
  onSelectTrain,
  onSelectAirport,
  onQuickHome,
  onQuickWork,
  onQuickAirport,
  onSaveHome,
  onSaveWork,
  onRefresh,
  onPrimaryAction,
  onOpenPro,
  fromQuery,
  toQuery,
  activeField,
  onFocusField,
  onChangeQuery,
  onSwap,
  onClearField,
  searchResults,
  searchLoading,
  isSearchExpanded,
  onSelectSuggestion,
}: Props) {
  const accent = selectedRecommendation?.accent || getModeAccent(selectedMode);

  const etaText =
    selectedRecommendation?.etaLabel ||
    (rideStatus === "driver_arriving"
      ? formatEtaCountdown(liveEtaSeconds)
      : `${eta ?? 7} min`);

  const summaryTitle =
    selectedRecommendation?.title ||
    (selectedMode === "taxi"
      ? "Taxi"
      : selectedMode === "scooter"
      ? "Scooter"
      : selectedMode === "train"
      ? "Traukinys"
      : selectedMode === "airport"
      ? "Airport"
      : selectedMode === "walk"
      ? "Pėsčiomis"
      : selectedMode === "bus"
      ? selectedRecommendation?.title || "Autobusas"
      : "Smart Route");

  const timeWindow = getJourneyTimeWindow(etaText);

  const shouldShowJourney =
    Boolean(destinationLabel && destinationLabel !== "Choose destination") ||
    Boolean(toQuery.trim()) ||
    Boolean(selectedRecommendation);

  const journeyBadges =
    selectedRecommendation?.journeyBadges?.map((item) => ({
      icon: (item.icon ||
        "bus") as keyof typeof MaterialCommunityIcons.glyphMap,
      label: item.label || "Segment",
    })) || [];

  const journeySteps = selectedRecommendation?.journeySteps || [];
  const selectedBusLabel = selectedBus?.number || selectedBus?.vehicleLabel || null;
  const selectedBusDirection = selectedBus?.directionName || null;
  const summarySubtitle =
    selectedRecommendation?.description ||
    routeSummaryText ||
    [pickupLabel, destinationLabel].filter(Boolean).join(" → ");

  const primaryLabel = isPro
    ? getPrimaryButtonLabel({
        rideStatus,
        liveEtaSeconds,
        selectedMode,
        isPro,
        getFinalMode,
        formatEtaCountdown,
      })
    : "Unlock Pro Journey";

  const primaryIcon = (isPro
    ? getPrimaryButtonIcon({
        rideStatus,
        selectedMode,
        isPro,
        getFinalMode,
      })
    : "crown-outline") as keyof typeof MaterialCommunityIcons.glyphMap;

  return (
    <Animated.View pointerEvents="box-none" style={styles.sheetShell}>
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY }],
          },
        ]}
      >
      <View style={styles.handleArea} {...panResponder.panHandlers}>
        <View style={styles.handle} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: sheetContentBottomPadding,
          paddingTop: 6,
        }}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Find journey</Text>

          <SearchRow
            label="Iš kur"
            value={fromQuery}
            placeholder="Current location"
            field="from"
            activeField={activeField}
            onFocusField={onFocusField}
            onChangeQuery={onChangeQuery}
            onClearField={onClearField}
            icon={<View style={styles.fromDot} />}
          />

          <View style={styles.swapWrap}>
            <View style={styles.swapDivider} />
            <Pressable onPress={onSwap} style={styles.swapButton}>
              <MaterialCommunityIcons
                name="swap-vertical"
                size={18}
                color="#EAF2FF"
              />
            </Pressable>
          </View>

          <SearchRow
            label="Į kur"
            value={toQuery}
            placeholder="Įvesk adresą, vietą ar POI"
            field="to"
            activeField={activeField}
            onFocusField={onFocusField}
            onChangeQuery={onChangeQuery}
            onClearField={onClearField}
            icon={
              <MaterialCommunityIcons
                name="map-marker-radius-outline"
                size={18}
                color="#7CE7A2"
              />
            }
          />

          {(isSearchExpanded || searchLoading || searchResults.length > 0) && (
            <View style={styles.resultsWrap}>
              {searchLoading ? (
                <View style={styles.stateRow}>
                  <ActivityIndicator />
                  <Text style={styles.stateText}>Ieškome vietų…</Text>
                </View>
              ) : null}

              {!searchLoading &&
                searchResults.slice(0, 6).map((item) => (
                  <ResultRow
                    key={item.id}
                    item={item}
                    onPress={() => onSelectSuggestion(item)}
                  />
                ))}
            </View>
          )}
        </View>

        {shouldShowJourney ? (
          <Animated.View
            style={{
              opacity: smartCardOpacity,
              transform: [{ translateY: smartCardTranslateY }],
            }}
          >
            <View style={styles.card}>
              <View style={styles.headerTop}>
                <Text style={styles.eyebrow}>LIVE JOURNEY</Text>
                {!isPro ? (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>PRO</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.tripHeader}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.timeWindow}>{timeWindow}</Text>
                  <Text style={styles.tripTitle} numberOfLines={1}>
                    {summaryTitle}
                  </Text>
                  <Text style={styles.tripSubtitle} numberOfLines={2}>
                    {selectedRecommendation?.description ||
                      selectedRecommendation?.subtitle ||
                      "Kelionės variantas"}
                  </Text>
                </View>

                <View style={styles.etaBox}>
                  <Text style={styles.etaValue}>{etaText}</Text>
                  <Text style={styles.etaCaption}>ETA</Text>
                  <Text style={styles.priceValue}>
                    {selectedRecommendation?.price || "—"}
                  </Text>
                </View>
              </View>

              {journeyBadges.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.badgesRow}
                >
                  {journeyBadges.map((item, index) => (
                    <Badge
                      key={`${item.label}-${index}`}
                      icon={item.icon}
                      label={item.label}
                      accent={accent}
                    />
                  ))}
                </ScrollView>
              ) : null}

              <View style={styles.noticeBox}>
                <MaterialCommunityIcons
                  name="ticket-confirmation-outline"
                  size={16}
                  color="#9EC5FF"
                />
                <Text style={styles.noticeText}>
                  {selectedRecommendation?.notice ||
                    (selectedBusLabel
                      ? `Pasirinktas autobusas ${selectedBusLabel}${selectedBusDirection ? ` • ${selectedBusDirection}` : ""}`
                      : "Kelionė paruošta. Pasirink veiksmą apačioje.")}
                </Text>
              </View>

              {journeySteps.length > 0 ? (
                <View style={styles.timelineCard}>
                  {journeySteps.map((step, index) => (
                    <TimelineStep
                      key={`${step.title || "step"}-${index}`}
                      icon={
                        (step.icon ||
                          "map-marker") as keyof typeof MaterialCommunityIcons.glyphMap
                      }
                      title={step.title || "Journey step"}
                      subtitle={step.subtitle || ""}
                      accent={accent}
                      isLast={index === journeySteps.length - 1}
                    />
                  ))}
                </View>
              ) : null}

              {recommendations.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recoRail}
                >
                  {recommendations.slice(0, 4).map((item) => {
                    const active = item.id === selectedRecommendationId;

                    return (
                      <UltraPressable
                        key={item.id}
                        onPress={() => onSelectRecommendation?.(item.id)}
                        style={{ marginRight: 10 }}
                      >
                        <View
                          style={[
                            styles.recoCard,
                            active && styles.recoCardActive,
                          ]}
                        >
                          <Text style={styles.recoTitle} numberOfLines={1}>
                            {item.title || "Variantas"}
                          </Text>
                          <Text style={styles.recoSub} numberOfLines={2}>
                            {item.etaLabel || item.subtitle || "Maršrutas"}
                          </Text>
                        </View>
                      </UltraPressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <View style={styles.quickRow}>
                <UltraPressable onPress={onQuickHome} onLongPress={onSaveHome}>
                  <View style={styles.quickAction}>
                    <Ionicons name="home-outline" size={16} color="#EAF2FF" />
                    <Text style={styles.quickText}>
                      {homeLocation ? "Home" : "Set Home"}
                    </Text>
                  </View>
                </UltraPressable>

                <UltraPressable onPress={onQuickWork} onLongPress={onSaveWork}>
                  <View style={styles.quickAction}>
                    <Ionicons
                      name="briefcase-outline"
                      size={16}
                      color="#EAF2FF"
                    />
                    <Text style={styles.quickText}>
                      {workLocation ? "Work" : "Set Work"}
                    </Text>
                  </View>
                </UltraPressable>

                <UltraPressable onPress={onQuickAirport}>
                  <View style={styles.quickAction}>
                    <Ionicons
                      name="airplane-outline"
                      size={16}
                      color="#EAF2FF"
                    />
                    <Text style={styles.quickText}>Airport</Text>
                  </View>
                </UltraPressable>

                <UltraPressable onPress={onRefresh}>
                  <View style={styles.iconAction}>
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color="#DCE7FF"
                    />
                  </View>
                </UltraPressable>
              </View>

              <UltraPressable onPress={isPro ? onPrimaryAction : onOpenPro}>
                <Animated.View
                  style={[
                    styles.ctaButton,
                    {
                      transform: [{ scale: ctaPulse as any }],
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={primaryIcon}
                    size={18}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.ctaText}>{primaryLabel}</Text>
                </Animated.View>
              </UltraPressable>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheetShell: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 22,
  },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: "rgba(9,16,31,0.96)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  card: {
    borderRadius: 24,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 12,
  },
  searchRow: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  searchRowActive: {
    backgroundColor: "rgba(88,173,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(88,173,255,0.18)",
  },
  searchIconWrap: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  searchTextWrap: {
    flex: 1,
    justifyContent: "center",
  },
  searchLabel: {
    color: "#91A8CC",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  searchInput: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    paddingVertical: 2,
  },
  clearButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 8,
  },
  clearPlaceholder: {
    width: 34,
    height: 34,
    marginLeft: 8,
  },
  swapWrap: {
    position: "relative",
    justifyContent: "center",
    marginVertical: 8,
    minHeight: 24,
  },
  swapDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  swapButton: {
    position: "absolute",
    right: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(61,184,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(61,184,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  fromDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#60A5FA",
  },
  resultsWrap: {
    marginTop: 10,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  stateRow: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  stateText: {
    color: "#DCE7FF",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 10,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
  },
  resultIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(56,189,248,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  resultTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  resultSubtitle: {
    color: "#9FB1CC",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  eyebrow: {
    color: "#9EC5FF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  proBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(251,191,36,0.14)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.24)",
  },
  proBadgeText: {
    color: "#FFD978",
    fontSize: 10,
    fontWeight: "800",
  },
  tripHeader: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 12,
  },
  timeWindow: {
    color: "#DDE8FF",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  tripTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 4,
  },
  tripSubtitle: {
    color: "#AFC3E6",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  etaBox: {
    width: 92,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  etaValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  etaCaption: {
    color: "#88A0C7",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  priceValue: {
    color: "#D7E5FF",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },
  badgesRow: {
    paddingBottom: 2,
  },
  badge: {
    minHeight: 36,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeText: {
    color: "#EAF2FF",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 6,
  },
  noticeBox: {
    marginTop: 14,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  noticeText: {
    flex: 1,
    color: "#B8C9E6",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginLeft: 9,
  },
  timelineCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  timelineLeft: {
    width: 34,
    alignItems: "center",
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 1,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
    paddingLeft: 4,
  },
  timelineTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  timelineSubtitle: {
    color: "#AFC3E6",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    fontWeight: "700",
  },
  recoRail: {
    paddingTop: 14,
  },
  recoCard: {
    width: 156,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  recoCardActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  recoTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  recoSub: {
    color: "#AFC3E6",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  quickRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  quickAction: {
    minHeight: 40,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.045)",
    flexDirection: "row",
    alignItems: "center",
  },
  quickText: {
    color: "#EAF2FF",
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 7,
  },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.045)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButton: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#4D8DFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 2,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});

export default memo(HomeBottomSheet);