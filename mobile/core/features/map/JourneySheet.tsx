import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { type ComponentProps, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { saveFavoritePlace } from "@/core/services/favorites/favoritePlacesService";
import { COLORS, LINE_HEIGHT, T } from "@/core/theme/typography";
import FavoritePlacesSheet from "../rideBooking/components/FavoritePlacesSheet";
import TravelTimeModal, {
  type TravelTimeMode,
  type TravelTimeSelection,
} from "../rideBooking/components/TravelTimeModal";
import {
  buildJourneyViewModel,
  cleanRouteNumber,
  cleanStopName,
  getSteps,
  routeNumbersFromRoute,
} from "../transit/models/journeyStateMachine";
import { fetchTransitRoutes, type TransitScheduleRoute } from "../transit/services/transitApi";
import type {
  PlaceSearchResult,
  TransitFlowState,
  TransitRouteOption,
  TransitStep,
} from "../transit/models/transitTypes";

type MaterialCommunityIconName = ComponentProps<
  typeof MaterialCommunityIcons
>["name"];
type IoniconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  flowState: TransitFlowState;
  liveBusCount: number;
  query: string;
  searchResults: PlaceSearchResult[];
  isSearching?: boolean;
  isPlanning?: boolean;
  routeOptions: TransitRouteOption[];
  selectedRoute: TransitRouteOption | null;
  currentStepIndex?: number;
  travelTimeMode?: TravelTimeMode;
  travelTimeDate?: Date | string | null;
  onChangeTravelTime?: (selection: TravelTimeSelection) => void;
  selectedOrigin?: PlaceSearchResult | null;
  selectedDestination?: PlaceSearchResult | null;
  selectedMapPlace?: PlaceSearchResult | null;
  isReverseGeocoding?: boolean;
  onClearMapPlace?: () => void;
  onUseMapPlaceAsOrigin?: (place: PlaceSearchResult) => void;
  onUseMapPlaceAsDestination?: (place: PlaceSearchResult) => void;
  error?: string | null;
  isOffline?: boolean;
  offlineMessage?: string | null;
  isRerouting?: boolean;
  reroutingMessage?: string | null;
  onChangeQuery: (text: string) => void;
  onSubmitSearch: () => void;
  onSelectDestination: (place: PlaceSearchResult) => void;
  onSelectOrigin?: (place: PlaceSearchResult) => void;
  onClearOrigin?: () => void;
  onSwapPlaces?: () => void;
  onChooseRoute: (route: TransitRouteOption) => void;
  onStartJourney: () => void;
  onNextStep: () => void;
  onBackToRoutes: () => void;
  onBackToSearch: () => void;
  onReset: () => void;
  onOpenFerries?: () => void;
  onOpenBusRoute?: (route: TransitScheduleRoute) => void;
};

type Stage = "search" | "loading" | "routes" | "details" | "navigation";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_TOP = 64;
const SHEET_RADIUS = 32;
const SNAP_FULL = SHEET_TOP;
const SNAP_MID = Math.round(SCREEN_HEIGHT * 0.46);
// Default search position: high enough to show IŠ KUR / Į KUR / KADA and favourites.
const SNAP_BOTTOM = Math.round(SCREEN_HEIGHT * 0.56);
const SNAP_COMPACT = Math.round(SCREEN_HEIGHT * 0.72);
const SHEET_HEIGHT = SCREEN_HEIGHT - SHEET_TOP + 32;
const SHEET_POINTS = [SNAP_FULL, SNAP_MID, SNAP_BOTTOM] as const;
const NAV_SHEET_POINTS = [SNAP_FULL, SNAP_MID, SNAP_COMPACT] as const;

function n(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function routeLabel(route: TransitRouteOption | null) {
  return (
    routeNumbersFromRoute(route)[0] ||
    cleanRouteNumber(route?.routeLabel || route?.routeId || route?.title) ||
    "BUS"
  );
}

function routeSummary(route: TransitRouteOption) {
  const duration = n(route.totalDurationMinutes ?? route.totalMinutes, 0);
  const walk = n(route.totalWalkMinutes ?? route.walkingMinutes, 0);
  const transfers = n(route.transfersCount ?? route.transfers, 0);
  const stops = n(route.stopCount, 0);
  return { duration, walk, transfers, stops, label: routeLabel(route) };
}

function routeWindow(route: TransitRouteOption) {
  const dep = timeText(route.departureText);
  const arr = timeText(route.arrivalText);
  if (dep && arr) return `${dep} → ${arr}`;
  if (dep) return `Išvyksta ${dep}`;
  if (arr) return `Atvyksta ${arr}`;
  return "pagal tvarkaraštį";
}

function routeReliability(route: TransitRouteOption) {
  const quality = (route as any).routingQuality || {};
  const liveEta = (route as any).liveEta || {};
  const liveMinutes =
    liveEta?.etaMinutes ?? (route as any).summary?.liveEtaMinutes;

  if (liveMinutes != null) {
    return `Live GPS • atvyks ~${Math.round(Number(liveMinutes))} min`;
  }

  if (quality.hasRealtimeGps) return "Live GPS aktyvus";
  if (route.boardingState) return String(route.boardingState);
  return "GTFS tvarkaraštis";
}

function stepIcon(step: TransitStep | null | undefined) {
  if (!step) return "circle-small";
  if (step.type === "walk") return "walk";
  if (step.type === "board") return "bus-clock";
  if (step.type === "ride" || step.type === "bus") return "bus";
  if (step.type === "transfer") return "swap-horizontal";
  if (step.type === "alight" || step.type === "arrive") return "flag-checkered";
  return "circle-small";
}

function stepLabel(step: TransitStep) {
  const route = cleanRouteNumber(
    step.routeNumber || step.routeLabel || step.routeId,
  );
  if (route && step.type !== "walk") return route;
  const minutes = n(step.durationMinutes ?? step.minutes, 0);
  if (minutes) return `${minutes} min`;
  return step.type === "walk" ? "eik" : "";
}

function timeText(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parts = raw.split(":");
  if (parts.length >= 2)
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  return raw;
}

function stopTimeText(stop: any) {
  return timeText(
    stop?.departureTime ||
      stop?.arrivalTime ||
      stop?.departureText ||
      stop?.arrivalText,
  );
}

function travelTimeLabel(
  mode?: TravelTimeMode,
  value?: Date | string | null,
  language: string = "lt",
  t?: any,
) {
  if (!mode || mode === "now" || !value)
    return t?.common?.leaveNow ?? "Išvykti dabar";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime()))
    return mode === "arrive"
      ? (t?.common?.arriveBy ?? "Atvykti iki")
      : (t?.common?.leaveNow ?? "Išvykti");
  const local = new Date(
    date.toLocaleString("en-US", { timeZone: "Europe/Vilnius" }),
  );

  const hh = String(local.getHours()).padStart(2, "0");
  const mm = String(local.getMinutes()).padStart(2, "0");
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const day = sameDay
    ? language === "en"
      ? "Today"
      : "Šiandien"
    : new Intl.DateTimeFormat(language === "en" ? "en-US" : "lt-LT", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(date);
  const prefix =
    mode === "arrive"
      ? (t?.common?.arriveBy ?? "Atvykti iki")
      : (t?.common?.leaveNow ?? "Išvykti");
  return `${prefix}: ${day} ${hh}:${mm}`;
}

function stepMetaLine(step: TransitStep, t: any) {
  const items = [
    step.departureTime
      ? `${t.common.departureAt} ${timeText(step.departureTime)}`
      : null,
    step.arrivalTime
      ? `${t.common.arrivalAt} ${timeText(step.arrivalTime)}`
      : null,
    step.stopCount != null && Number(step.stopCount) > 0
      ? `${Number(step.stopCount)} ${t.common.stopLabelPlural}`
      : null,
    step.durationMinutes != null
      ? `${Number(step.durationMinutes)} ${t.common.minutes}`
      : null,
  ].filter(Boolean);
  return items.join(" • ");
}

function placeSubtitle(place: PlaceSearchResult) {
  const meters = n(place.distanceMeters, 0);
  if (meters > 0 && meters < 1000) return `${Math.round(meters)} m`;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return place.subtitle || "Klaipėda";
}

function stageFor(
  flowState: TransitFlowState,
  selectedRoute: TransitRouteOption | null,
): Stage {
  if ((selectedRoute as any)?.summary?.scheduleOnly) return "details";
  if (flowState === "routes_loading" || flowState === "destination_selected")
    return "loading";
  if (flowState === "idle" || flowState === "searching") return "search";
  if (flowState === "route_options") return "routes";
  if (flowState === "route_selected") return "details";
  if (
    [
      "walking_to_stop",
      "waiting_bus",
      "onboard",
      "transfer",
      "arriving",
      "completed",
    ].includes(flowState)
  )
    return "navigation";
  return selectedRoute ? "details" : "search";
}

function snapForStage(stage: Stage, query: string, resultCount: number) {
  if (stage === "search") {
    if (query.trim().length >= 2 || resultCount > 0) return SNAP_MID;
    return SNAP_BOTTOM;
  }
  if (stage === "loading") return SNAP_MID;
  if (stage === "routes") return SNAP_MID;
  if (stage === "details") return SNAP_MID;
  if (stage === "navigation") return SNAP_COMPACT;
  return SNAP_BOTTOM;
}

function nearestSnap(y: number, stage: Stage) {
  const points = stage === "navigation" ? NAV_SHEET_POINTS : SHEET_POINTS;
  const velocityBias = y < SNAP_MID ? -10 : 10;

  return points.reduce((best, point) => {
    return Math.abs(point - (y + velocityBias)) <
      Math.abs(best - (y + velocityBias))
      ? point
      : best;
  }, points[0]);
}

function animateTo(value: Animated.Value, toValue: number) {
  Animated.spring(value, {
    toValue,
    useNativeDriver: true,
    damping: 34,
    stiffness: 205,
    mass: 0.88,
    restDisplacementThreshold: 0.6,
    restSpeedThreshold: 0.6,
  }).start();
}

function ModeSelector() {
  const { theme } = useAppPreferences();
  return (
    <View style={[styles.modeSelector, { backgroundColor: theme.surfaceSoft }]}>
      {[
        ["car", "car"],
        ["walk", "walk"],
        ["bus", "bus"],
        ["bike", "bicycle"],
      ].map(([key, icon]) => (
        <View
          key={key}
          style={[
            styles.modeItem,
            key === "bus" && [
              styles.modeItemActive,
              { backgroundColor: theme.accentSoft, shadowColor: theme.shadow },
            ],
          ]}
        >
          <MaterialCommunityIcons
            name={icon as any}
            size={15}
            color={key === "bus" ? theme.accentText : theme.dim}
          />
        </View>
      ))}
    </View>
  );
}

function Header({
  title,
  subtitle,
  icon,
  badge,
  onClose,
  onBack,
}: {
  title: string;
  subtitle?: string;
  icon?: MaterialCommunityIconName;
  badge?: string;
  onClose: () => void;
  onBack?: () => void;
}) {
  const { theme } = useAppPreferences();
  return (
    <View style={styles.headerRow}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={[styles.roundControl, { backgroundColor: theme.surfaceMuted }]}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </Pressable>
      ) : null}
      <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
        <MaterialCommunityIcons
          name={icon ?? "directions-fork"}
          size={17}
          color={theme.accent}
        />
      </View>
      <View style={styles.headerTextBlock}>
        <Text style={[styles.kicker, { color: theme.muted }]}>
          ARBE NAVIGATION
        </Text>
        <Text
          style={[styles.sheetTitle, { color: theme.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.sheetSubtitle, { color: theme.muted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View
          style={[styles.headerBadge, { backgroundColor: theme.accentSoft }]}
        >
          <Text style={[styles.headerBadgeText, { color: theme.accentText }]}>
            {badge}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={onClose}
        style={[styles.roundControl, { backgroundColor: theme.surfaceMuted }]}
        hitSlop={12}
      >
        <Ionicons name="close" size={16} color={theme.text} />
      </Pressable>
    </View>
  );
}

function AppleSearchHeader({ panHandlers }: { panHandlers?: unknown }) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  return (
    <View {...(panHandlers || {})} style={styles.fixedHeaderCompact}>
      <Text style={[styles.appleSheetTitleCentered, { color: theme.text }]}>
        {t.common.appName}
      </Text>
    </View>
  );
}

function QuickMenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: MaterialCommunityIconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const { theme } = useAppPreferences();
  return (
    <Pressable
      style={styles.quickMenuRow}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
    >
      <View
        style={[styles.quickMenuIcon, { backgroundColor: theme.accentSoft }]}
      >
        <MaterialCommunityIcons name={icon} size={17} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.quickMenuTitle, { color: theme.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.quickMenuSubtitle, { color: theme.muted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color={theme.dim} />
    </Pressable>
  );
}

function TripInputRow({
  icon,
  label,
  value,
  children,
}: {
  icon: MaterialCommunityIconName;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  const { theme } = useAppPreferences();
  return (
    <View style={styles.tripInputRow}>
      <View
        style={[styles.tripInputIcon, { backgroundColor: theme.accentSoft }]}
      >
        <MaterialCommunityIcons name={icon} size={15} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tripInputLabel, { color: theme.muted }]}>
          {label}
        </Text>
        {children ? (
          children
        ) : (
          <Text
            style={[styles.tripInputValue, { color: theme.text }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
      </View>
    </View>
  );
}

function InlineInput({
  value,
  placeholder,
  onChangeText,
  onFocus,
  onSubmit,
  onClear,
  isLoading,
}: {
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onSubmit?: () => void;
  onClear?: () => void;
  isLoading?: boolean;
}) {
  const { theme } = useAppPreferences();
  return (
    <View
      style={[
        styles.inlineInputRow,
        { backgroundColor: theme.inputBackground },
      ]}
    >
      <Ionicons name="search" size={16} color={theme.dim} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSubmitEditing={() => {
          Keyboard.dismiss();
          // Do not auto-plan on keyboard submit. Search results are only suggestions;
          // route planning starts after the user taps a concrete result.
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.dim}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        style={[styles.inlineInput, { color: theme.text }]}
      />
      {isLoading ? (
        <ActivityIndicator size="small" color={COLORS.green} />
      ) : null}
      {value.trim().length ? (
        <Pressable
          onPress={onClear}
          hitSlop={12}
          style={styles.searchClearButton}
        >
          <Ionicons name="close" size={13} color={theme.dim} />
        </Pressable>
      ) : null}
    </View>
  );
}

function TripSearchForm({
  props,
  activeField,
  setActiveField,
}: {
  props: Props;
  activeField: "from" | "to";
  setActiveField: (field: "from" | "to") => void;
}) {
  const { t, language } = useLanguage();
  const { theme } = useAppPreferences();
  const [timeModalOpen, setTimeModalOpen] = React.useState(false);
  const fromValue =
    activeField === "from" ? props.query : props.selectedOrigin?.title || "";
  const toValue =
    activeField === "to" ? props.query : props.selectedDestination?.title || "";

  const beginEdit = (field: "from" | "to") => {
    setActiveField(field);
    if (field === "from") {
      props.onChangeQuery(props.selectedOrigin?.title || "");
    } else {
      props.onChangeQuery(props.selectedDestination?.title || "");
    }
  };

  return (
    <View
      style={[
        styles.tripFormCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <TripInputRow icon="crosshairs-gps" label={t.sheet.from}>
        <InlineInput
          value={fromValue}
          placeholder={
            (t.sheet as any).fromPlaceholder || (t.sheet as any).from
          }
          onFocus={() => beginEdit("from")}
          onChangeText={(text) => {
            setActiveField("from");
            props.onChangeQuery(text);
          }}
          onSubmit={() => props.onSubmitSearch()}
          onClear={() => {
            setActiveField("from");
            props.onClearOrigin?.();
            props.onChangeQuery("");
          }}
          isLoading={activeField === "from" && props.isSearching}
        />
      </TripInputRow>
      <Pressable
        style={[
          styles.swapPlacesButton,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        ]}
        onPress={() => {
          void Haptics.selectionAsync();
          props.onSwapPlaces?.();
        }}
        hitSlop={12}
      >
        <Ionicons name="swap-vertical" size={23} color={theme.accent} />
      </Pressable>
      <View style={[styles.tripDivider, { backgroundColor: theme.border }]} />
      <TripInputRow icon="map-marker" label={t.sheet.to}>
        <InlineInput
          value={toValue}
          placeholder={
            (t.sheet as any).toPlaceholder ||
            (t.common as any).searchPlaceholder
          }
          onFocus={() => beginEdit("to")}
          onChangeText={(text) => {
            setActiveField("to");
            props.onChangeQuery(text);
          }}
          onSubmit={props.onSubmitSearch}
          onClear={props.onReset}
          isLoading={activeField === "to" && props.isSearching}
        />
      </TripInputRow>
      <View style={[styles.tripDivider, { backgroundColor: theme.border }]} />
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setTimeModalOpen(true);
        }}
      >
        <TripInputRow
          icon="clock-outline"
          label={t.sheet.when}
          value={travelTimeLabel(
            props.travelTimeMode,
            props.travelTimeDate,
            language,
            t,
          )}
        />
      </Pressable>
      <TravelTimeModal
        visible={timeModalOpen}
        initialMode={props.travelTimeMode || "now"}
        initialDate={
          props.travelTimeDate ? new Date(props.travelTimeDate) : null
        }
        onClose={() => setTimeModalOpen(false)}
        onConfirm={(selection) => {
          props.onChangeTravelTime?.(selection);
          setTimeModalOpen(false);
        }}
      />
    </View>
  );
}

function iconForPlaceType(type?: string) {
  const value = String(type || "").toLowerCase();
  if (value === "stop") return "bus-stop";
  if (value === "station") return "train";
  if (value === "ferry") return "ferry";
  if (value === "city" || value === "region") return "map-marker-radius";
  if (value === "address") return "map-marker-outline";
  if (value === "street") return "road-variant";
  return "map-marker";
}

function normalizeDisplayCategory(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "Vieta";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function PlacePreviewCard({ props }: { props: Props }) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  const place = props.selectedMapPlace;
  if (!place) return null;

  const useAsOrigin = () => {
    void Haptics.selectionAsync();
    props.onUseMapPlaceAsOrigin?.(place);
  };

  const useAsDestination = () => {
    void Haptics.selectionAsync();
    props.onUseMapPlaceAsDestination?.(place);
  };

  const rawPhotos = Array.isArray((place as { photos?: unknown[] }).photos)
    ? ((place as { photos?: unknown[] }).photos ?? [])
    : [];
  const rawPhotoUrls = Array.isArray(
    (place as { photoUrls?: unknown[] }).photoUrls,
  )
    ? ((place as { photoUrls?: unknown[] }).photoUrls ?? [])
    : [];
  const photos = [
    ...rawPhotos.map((photo) =>
      typeof photo === "string"
        ? photo
        : photo && typeof photo === "object" && "url" in photo
          ? String((photo as { url?: unknown }).url || "")
          : "",
    ),
    ...rawPhotoUrls.map((url) => (typeof url === "string" ? url : "")),
  ]
    .filter((url): url is string => Boolean(url))
    .slice(0, 6);
  const rating = Number((place as any).rating);
  const hasRating = Number.isFinite(rating) && rating > 0;
  const userRatingCount = Number((place as any).userRatingCount || 0);
  const openNow = (place as any).openNow;
  const openText =
    (place as any).openNowText ||
    (openNow === true
      ? "Atidaryta dabar"
      : openNow === false
        ? "Uždaryta dabar"
        : null);
  const category = normalizeDisplayCategory(
    (place as any).category || place.type,
  );
  const hours = Array.isArray((place as any).openingHours)
    ? (place as any).openingHours.slice(0, 2)
    : [];

  return (
    <View
      style={[
        styles.placePreviewCardPro,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
      ]}
    >
      {photos.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.placePhotoStrip}
          contentContainerStyle={styles.placePhotoContent}
        >
          {photos.map((uri: string, index: number) => (
            <Image
              key={`${uri}-${index}`}
              source={{ uri }}
              style={styles.placePhoto}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.placePreviewTopPro}>
        <View
          style={[
            styles.placePreviewIcon,
            { backgroundColor: theme.accentSoft },
          ]}
        >
          <MaterialCommunityIcons
            name={iconForPlaceType(place.type) as any}
            size={18}
            color={COLORS.green}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.placePreviewKicker, { color: theme.accent }]}>
            {t.sheet.selectedPlace}
          </Text>
          <Text
            style={[styles.placePreviewTitle, { color: theme.text }]}
            numberOfLines={2}
          >
            {place.title}
          </Text>
          <Text
            style={[styles.placePreviewSubtitle, { color: theme.muted }]}
            numberOfLines={2}
          >
            {place.subtitle || placeSubtitle(place)}
          </Text>
        </View>
        <Pressable
          onPress={props.onClearMapPlace}
          hitSlop={12}
          style={[
            styles.placePreviewClosePro,
            { backgroundColor: theme.surfaceMuted },
          ]}
        >
          <Ionicons name="close" size={16} color={theme.dim} />
        </Pressable>
      </View>

      {props.isReverseGeocoding ? (
        <View style={styles.placeLoadingRowPro}>
          <ActivityIndicator size="small" color={COLORS.green} />
          <Text style={[styles.placeLoadingText, { color: theme.muted }]}>
            {t.sheet.locatingPlace}
          </Text>
        </View>
      ) : null}

      <View style={styles.placeMetaGrid}>
        <View
          style={[
            styles.placeMetaPill,
            { backgroundColor: theme.surfaceMuted },
          ]}
        >
          <Text style={[styles.placeMetaText, { color: theme.muted }]}>
            {category}
          </Text>
        </View>
        {hasRating ? (
          <View
            style={[
              styles.placeMetaPill,
              { backgroundColor: theme.surfaceMuted },
            ]}
          >
            <Text style={[styles.placeMetaText, { color: theme.muted }]}>
              ★ {rating.toFixed(1)}
              {userRatingCount ? ` (${userRatingCount})` : ""}
            </Text>
          </View>
        ) : null}
        {openText ? (
          <View
            style={[
              styles.placeMetaPill,
              openNow === true && styles.placeMetaPillOpen,
              openNow === false && styles.placeMetaPillClosed,
            ]}
          >
            <Text
              style={[
                styles.placeMetaText,
                openNow === true && styles.placeMetaTextOpen,
                openNow === false && styles.placeMetaTextClosed,
              ]}
            >
              {openText}
            </Text>
          </View>
        ) : null}
      </View>

      {hours.length ? (
        <View
          style={[
            styles.placeHoursBox,
            { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
          ]}
        >
          {hours.map((line: string, index: number) => (
            <Text
              key={`place-hour-${line}-${index}`}
              style={[styles.placeHoursText, { color: theme.muted }]}
              numberOfLines={1}
            >
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.placePreviewActions}>
        <Pressable
          style={[
            styles.placeActionButtonSecondary,
            { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
          ]}
          onPress={useAsOrigin}
        >
          <Text style={[styles.placeActionText, { color: theme.text }]}>
            {t.sheet.useAsFrom}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.placeActionButtonSecondary,
            { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
          ]}
          onPress={useAsDestination}
        >
          <Text style={[styles.placeActionText, { color: theme.text }]}>
            {t.sheet.useAsTo}
          </Text>
        </Pressable>
      </View>
      <Pressable
        style={[styles.placeRouteButton, { backgroundColor: theme.accent }]}
        onPress={useAsDestination}
      >
        <MaterialCommunityIcons
          name="navigation-variant"
          size={16}
          color={COLORS.green}
        />
        <Text
          style={[styles.placeRouteButtonText, { color: theme.accentText }]}
        >
          {t.sheet.showRoute}
        </Text>
      </Pressable>
    </View>
  );
}

type AppleMenuPanelMode = "home" | "bus_routes";

function AppleMenuContent({
  props,
  onOpenFavoritePlaces,
}: {
  props: Props;
  onOpenFavoritePlaces: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  const [routes, setRoutes] = React.useState<TransitScheduleRoute[]>([]);
  const [loadingRoutes, setLoadingRoutes] = React.useState(false);
  const [panelMode, setPanelMode] = React.useState<AppleMenuPanelMode>("home");

  useEffect(() => {
    let cancelled = false;
    setLoadingRoutes(true);
    fetchTransitRoutes()
      .then((items) => {
        if (!cancelled) setRoutes(items);
      })
      .catch(() => {
        if (!cancelled) setRoutes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRoutes(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (panelMode === "bus_routes") {
    return (
      <View style={styles.appleMenuRoot}>
        <View
          style={[
            styles.menuCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <QuickMenuRow
            icon="chevron-left"
            title="Autobusai"
            subtitle="Visi Klaipėdos GTFS maršrutai"
            onPress={() => setPanelMode("home")}
          />

          {loadingRoutes ? (
            <View style={styles.quickMenuLoadingRow}>
              <ActivityIndicator color={theme.accent} size="small" />
              <Text style={[styles.quickMenuSubtitle, { color: theme.muted }]}>Kraunami autobusų maršrutai...</Text>
            </View>
          ) : null}

          {!loadingRoutes && routes.length === 0 ? (
            <Text style={[styles.quickMenuSubtitle, { color: theme.muted }]}>Maršrutų nepavyko užkrauti.</Text>
          ) : null}

          {routes.map((route) => (
            <QuickMenuRow
              key={`bus-route-${route.routeId}`}
              icon="bus"
              title={`${route.shortName} Autobusas`}
              subtitle={route.subtitle || route.longName || "Stotelės ir pilna linija žemėlapyje"}
              onPress={() => props.onOpenBusRoute?.(route)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.appleMenuRoot}>
      <View
        style={[
          styles.menuCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.menuSectionTitleInside, { color: theme.muted }]}>AUTOBUSAI</Text>
        <QuickMenuRow
          icon="bus"
          title="Autobusai"
          subtitle="Visi Klaipėdos GTFS maršrutai"
          onPress={() => setPanelMode("bus_routes")}
        />
      </View>

      <View
        style={[
          styles.menuCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.menuSectionTitleInside, { color: theme.muted }]}>KELTAI</Text>
        <QuickMenuRow
          icon="ferry"
          title="Keltai"
          subtitle="Tvarkaraščiai: Klaipėda, Smiltynė, Nida"
          onPress={() => props.onOpenFerries?.()}
        />
      </View>

      <View
        style={[
          styles.menuCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.menuSectionTitleInside, { color: theme.muted }]}>MĖGSTAMOS VIETOS</Text>
        <QuickMenuRow
          icon="heart"
          title={t.sheet.favouritePlaces}
          subtitle={t.sheet.favouritePlacesSubtitle}
          onPress={onOpenFavoritePlaces}
        />
      </View>
    </View>
  );
}

function SearchHeader({ panHandlers }: { panHandlers?: unknown }) {
  return <AppleSearchHeader panHandlers={panHandlers} />;
}

function SearchSkeletonRows() {
  const { theme } = useAppPreferences();
  return (
    <View style={styles.searchSkeletonWrap}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.searchSkeletonRow}>
          <View
            style={[
              styles.searchSkeletonIcon,
              { backgroundColor: theme.surfaceMuted },
            ]}
          />
          <View style={{ flex: 1 }}>
            <View
              style={[
                styles.searchSkeletonLineWide,
                { backgroundColor: theme.surfaceMuted },
              ]}
            />
            <View
              style={[
                styles.searchSkeletonLineSmall,
                { backgroundColor: theme.surfaceSoft },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function SearchState(props: Props & { panHandlers?: unknown }) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  const [activeField, setActiveField] = React.useState<"from" | "to">("to");
  const [favoritePlacesVisible, setFavoritePlacesVisible] =
    React.useState(false);
  const hasResults = props.searchResults.length > 0;
  const hasQuery = props.query.trim().length >= 2;
  const showSkeleton = Boolean(props.isSearching && hasQuery && !hasResults);
  const showEmpty = hasQuery && !hasResults && !props.isSearching;

  return (
    <View style={styles.stateRoot}>
      <SearchHeader panHandlers={props.panHandlers} />
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.searchScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PlacePreviewCard props={props} />

        <TripSearchForm
          props={props}
          activeField={activeField}
          setActiveField={setActiveField}
        />

        {showSkeleton ? <SearchSkeletonRows /> : null}

        {props.error && hasQuery && !props.isSearching && !hasResults ? (
          <View
            style={[
              styles.emptyBlockCompact,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {t.common.routeSearchFailed}
            </Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              {props.error}
            </Text>
          </View>
        ) : null}

        {hasResults
          ? props.searchResults.slice(0, 8).map((place, index) => (
              <Pressable
                key={`search-result-${place.id || place.title || "place"}-${place.latitude || ""}-${place.longitude || ""}-${index}`}
                style={[
                  styles.searchResultRow,
                  { borderBottomColor: theme.border },
                ]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  if (activeField === "from") {
                    props.onSelectOrigin?.(place);
                    props.onChangeQuery("");
                    setActiveField("to");
                    return;
                  }
                  const hasCoordinate = Boolean(
                    place.coordinate ||
                    (Number.isFinite(Number(place.latitude)) &&
                      Number.isFinite(Number(place.longitude))),
                  );
                  const needsMoreAddressText =
                    Boolean((place as any).requiresHouseNumber) &&
                    !hasCoordinate &&
                    !/\b\d+[a-z]?\b/i.test(String(place.title || ""));

                  if (needsMoreAddressText) {
                    props.onChangeQuery(`${place.title} `);
                    return;
                  }

                  props.onChangeQuery("");
                  props.onSelectDestination(place);
                }}
              >
                <View
                  style={[
                    styles.resultIcon,
                    { backgroundColor: theme.accentSoft },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={iconForPlaceType(place.type) as any}
                    size={14}
                    color={COLORS.green}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.resultTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {cleanStopName(place.title)}
                  </Text>
                  <Text
                    style={[styles.resultSubtitle, { color: theme.muted }]}
                    numberOfLines={1}
                  >
                    {placeSubtitle(place)}
                  </Text>
                </View>
                <Pressable
                  style={styles.favoriteSaveButton}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    void Haptics.selectionAsync();
                    void saveFavoritePlace({
                      id: place.id,
                      title: cleanStopName(place.title),
                      subtitle: placeSubtitle(place),
                      type: place.type,
                      latitude: place.latitude ?? place.coordinate?.latitude,
                      longitude: place.longitude ?? place.coordinate?.longitude,
                      coordinate: place.coordinate,
                      createdAt: new Date().toISOString(),
                    });
                  }}
                  hitSlop={10}
                >
                  <Ionicons
                    name="heart-outline"
                    size={19}
                    color={COLORS.green}
                  />
                </Pressable>
                <Ionicons name="chevron-forward" size={14} color={theme.dim} />
              </Pressable>
            ))
          : null}

        {showEmpty ? (
          <View
            style={[
              styles.emptyBlockCompact,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {t.sheet.noResultsTitle}
            </Text>
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              {activeField === "from"
                ? (t.sheet as any).fromPlaceholder ||
                  (t.sheet as any).noResultsText
                : (t.sheet as any).noResultsText}
            </Text>
          </View>
        ) : null}

        {!hasResults && !showSkeleton && !hasQuery ? (
          <AppleMenuContent
            props={props}
            onOpenFavoritePlaces={() => setFavoritePlacesVisible(true)}
          />
        ) : null}
      </ScrollView>
      <FavoritePlacesSheet
        visible={favoritePlacesVisible}
        onClose={() => setFavoritePlacesVisible(false)}
        onSelectPlace={(place) => {
          setFavoritePlacesVisible(false);
          if (place.coordinate) {
            props.onChangeQuery("");
            props.onSelectDestination(place as any);
            return;
          }
          props.onChangeQuery(place.title);
          setTimeout(() => props.onSubmitSearch(), 0);
        }}
      />
    </View>
  );
}

function LoadingState({ onReset }: Pick<Props, "onReset">) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  return (
    <View style={styles.stateRoot}>
      <View style={styles.fixedHeader}>
        <Header
          title={t.common.loadingRoutes}
          subtitle={t.common.checkingStops}
          icon="bus-clock"
          onClose={onReset}
        />
      </View>
      <View
        style={[
          styles.loadingBox,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <ActivityIndicator color={COLORS.green} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          {t.common.loadingNearbyStops}
        </Text>
        <Text style={[styles.loadingSubtext, { color: theme.muted }]}>
          {t.common.loadingSubtext}
        </Text>
        <View
          style={[styles.skeletonCard, { backgroundColor: theme.surfaceMuted }]}
        />
        <View
          style={[
            styles.skeletonCard,
            styles.skeletonCardShort,
            { backgroundColor: theme.surfaceSoft },
          ]}
        />
      </View>
    </View>
  );
}

function RoutePills({ route }: { route: TransitRouteOption }) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  const labels = routeNumbersFromRoute(route).slice(0, 4);
  const s = routeSummary(route);
  return (
    <View style={styles.pillRow}>
      {labels.map((item, index) => (
        <View
          key={`route-pill-${item}-${index}`}
          style={[styles.busBadge, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.busBadgeText, { color: theme.accentText }]}>
            {item}
          </Text>
        </View>
      ))}
      <View
        style={[
          styles.neutralBadge,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.neutralBadgeText, { color: theme.muted }]}>
          {s.stops
            ? `${s.stops} ${t.common.stopCountShort}`
            : t.common.stopLabelPlural}
        </Text>
      </View>
      {s.walk ? (
        <View
          style={[
            styles.neutralBadge,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.neutralBadgeText, { color: theme.muted }]}>
            {`${t.common.walk} ${s.walk} ${t.common.minutes}`}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.neutralBadge,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.neutralBadgeText, { color: theme.muted }]}>
          {s.transfers
            ? `${s.transfers} ${t.common.transferShort}`
            : t.common.direct}
        </Text>
      </View>
      {(route as any).routingQuality?.hasRealtimeGps ||
      (route as any).liveVehicle ? (
        <View
          style={[
            styles.liveBadge,
            { backgroundColor: theme.accentSoft, borderColor: theme.accent },
          ]}
        >
          <Text style={[styles.liveBadgeText, { color: theme.accent }]}>
            Live GPS
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function RouteCard({
  route,
  selected,
  onPress,
}: {
  route: TransitRouteOption;
  selected?: boolean;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  const s = routeSummary(route);
  const steps = getSteps(route).slice(0, 4);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.routeCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
        selected && [
          styles.routeCardSelected,
          { borderColor: theme.accent, backgroundColor: theme.accentSoft },
        ],
      ]}
    >
      <View style={styles.routeCardTop}>
        <View style={styles.routeDurationBlock}>
          <Text style={[styles.routeDuration, { color: theme.text }]}>
            {s.duration || "–"} min
          </Text>
          <Text
            style={[styles.routeSubtitle, { color: theme.muted }]}
            numberOfLines={1}
          >
            {routeWindow(route)}
          </Text>
          <Text
            style={[styles.routeLiveText, { color: theme.dim }]}
            numberOfLines={1}
          >
            {routeReliability(route)}
          </Text>
        </View>
        <View
          style={[styles.routeTimeBox, { backgroundColor: theme.surfaceMuted }]}
        >
          <Text
            style={[styles.routeOptionBadgeText, { color: theme.accent }]}
            numberOfLines={1}
          >
            {String(
              (route as any).optionLabel || (route as any).badge || "Maršrutas",
            )}
          </Text>
          <Text style={[styles.routeTimeText, { color: theme.text }]}>
            {s.label}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.dim} />
        </View>
      </View>
      <View style={styles.routeMiniTimeline}>
        {steps.map((step, index) => (
          <View
            key={`route-mini-step-${step.id || step.title || step.type || "step"}-${index}`}
            style={styles.routeMiniStep}
          >
            <View
              style={[
                styles.routeMiniIcon,
                { backgroundColor: theme.accentSoft },
              ]}
            >
              <MaterialCommunityIcons
                name={stepIcon(step) as any}
                size={11}
                color={COLORS.green}
              />
            </View>
            <Text
              style={[styles.routeMiniText, { color: theme.muted }]}
              numberOfLines={1}
            >
              {stepLabel(step) ||
                cleanStopName(step.stopName || step.fromStopName || step.title)}
            </Text>
          </View>
        ))}
      </View>
      <RoutePills route={route} />
      <View style={styles.routeSelectRow}>
        <Text style={[styles.routeSelectHint, { color: theme.muted }]}>
          {selected ? t.common.selectedRoute : t.common.viewDetails}
        </Text>
        <View style={[styles.routeGoPill, { backgroundColor: theme.accent }]}>
          <Text style={[styles.routeGoText, { color: theme.accentText }]}>
            GO
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function RoutesListState(props: Props) {
  const { t, language } = useLanguage();
  const { theme } = useAppPreferences();
  const destination =
    props.routeOptions[0]?.destinationStop?.name ||
    props.routeOptions[0]?.alightStopName ||
    "tikslas";
  return (
    <View style={styles.stateRoot}>
      <View style={styles.fixedHeader}>
        <Header
          title={t.common.routeListTitle}
          subtitle={`${t.common.currentLocation} → ${cleanStopName(destination)}`}
          icon="bus"
          onClose={props.onReset}
          onBack={props.onBackToSearch}
        />
        <ModeSelector />
        <View style={styles.toolbarRow}>
          <Pressable
            style={[
              styles.blueChip,
              { backgroundColor: theme.accentSoft, borderColor: theme.accent },
            ]}
          >
            <Text style={[styles.blueChipText, { color: theme.accentText }]}>
              {travelTimeLabel(
                props.travelTimeMode,
                props.travelTimeDate,
                language,
                t,
              )}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.grayChip,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.grayChipText, { color: theme.muted }]}>
              {t.common.lessWalking}
            </Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.routesContent}
        showsVerticalScrollIndicator={false}
      >
        {props.error ? (
          <Text style={[styles.inlineError, { color: theme.danger }]}>
            {props.error}
          </Text>
        ) : null}
        {props.routeOptions.map((route, index) => (
          <RouteCard
            key={`route-option-${route.id || route.routeId || route.routeLabel || "route"}-${index}`}
            route={route}
            selected={route.id === props.selectedRoute?.id}
            onPress={() => props.onChooseRoute(route)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function StopTimeline({ step }: { step: TransitStep }) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  const stops = Array.isArray(
    step.stops?.length ? step.stops : step.rideStops || step.routeStops,
  )
    ? step.stops?.length
      ? step.stops
      : step.rideStops || step.routeStops || []
    : [];

  if (!stops.length || (step.type !== "ride" && step.type !== "bus"))
    return null;

  const compactStops = stops.slice(0, 9);
  const hidden = Math.max(0, stops.length - compactStops.length);

  return (
    <View
      style={[
        styles.stopTimelineBox,
        { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
      ]}
    >
      {compactStops.map((stop: any, index: number) => {
        const name = cleanStopName(
          stop.stopName || stop.name || stop.title || t.common.stopLabel,
        );
        const tText = stopTimeText(stop);
        return (
          <View
            key={`${stop.id || name}-${index}`}
            style={styles.stopTimelineRow}
          >
            <Text style={[styles.stopTimelineTime, { color: theme.dim }]}>
              {tText || "—"}
            </Text>
            <View
              style={[
                styles.stopTimelineDot,
                { backgroundColor: theme.accent },
              ]}
            />
            <Text
              style={[styles.stopTimelineName, { color: theme.text }]}
              numberOfLines={1}
            >
              {name}
            </Text>
          </View>
        );
      })}
      {hidden ? (
        <Text style={[styles.stopTimelineMore, { color: theme.muted }]}>
          {t.common.moreStops.replace("{count}", String(hidden))}
        </Text>
      ) : null}
    </View>
  );
}

function StepRow({ step, active }: { step: TransitStep; active?: boolean }) {
  const { t } = useLanguage();
  const { theme } = useAppPreferences();
  const meta = stepMetaLine(step, t);
  const subtitle =
    step.subtitle ||
    [
      cleanStopName(step.stopName || step.fromStopName),
      step.toStopName ? `→ ${cleanStopName(step.toStopName)}` : null,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <View
      style={[
        styles.stepRowBlock,
        { backgroundColor: theme.surface, borderColor: theme.border },
        active && [
          styles.stepRowBlockActive,
          { backgroundColor: theme.accentSoft, borderColor: theme.accent },
        ],
      ]}
    >
      <View style={styles.stepRowTop}>
        <View style={styles.stepRail}>
          <View
            style={[
              styles.stepLineDot,
              { backgroundColor: theme.dim },
              active && [
                styles.stepLineDotActive,
                { backgroundColor: theme.accent },
              ],
            ]}
          />
        </View>
        <View
          style={[styles.stepIconMini, { backgroundColor: theme.accentSoft }]}
        >
          <MaterialCommunityIcons
            name={stepIcon(step) as any}
            size={12}
            color={active ? COLORS.greenDark : COLORS.green}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.stepTitle, { color: theme.text }]}
            numberOfLines={2}
          >
            {step.title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.stepSubtitle, { color: theme.muted }]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text
              style={[styles.stepMetaText, { color: theme.dim }]}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.stepBadge,
            { color: theme.accentText, backgroundColor: theme.accent },
          ]}
        >
          {stepLabel(step)}
        </Text>
      </View>
      <StopTimeline step={step} />
    </View>
  );
}

function RouteDetailsState(props: Props) {
  const { theme } = useAppPreferences();
  const route = props.selectedRoute || props.routeOptions[0] || null;
  if (!route) return <SearchState {...props} />;
  const s = routeSummary(route);
  const steps = getSteps(route);
  return (
    <View style={styles.stateRoot}>
      <View style={styles.fixedHeader}>
        <Header
          title="Kelionės detalės"
          subtitle={`${cleanStopName(route.boardStopName)} → ${cleanStopName(route.alightStopName)}`}
          icon="bus"
          onClose={props.onReset}
          onBack={props.onBackToRoutes}
        />
        <View
          style={[
            styles.detailSummaryCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailDuration, { color: theme.text }]}>
              {s.duration || "–"} min
            </Text>
            <Text
              style={[styles.detailSubtitle, { color: theme.muted }]}
              numberOfLines={1}
            >
              {routeWindow(route)}
            </Text>
            <Text
              style={[styles.detailLiveText, { color: theme.dim }]}
              numberOfLines={1}
            >
              {routeReliability(route)}
            </Text>
          </View>
          <RoutePills route={route} />
          <View style={styles.routeStatsGrid}>
            <View
              style={[
                styles.routeStatPill,
                {
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.routeStatValue, { color: theme.text }]}>
                {s.stops}
              </Text>
              <Text style={[styles.routeStatLabel, { color: theme.muted }]}>
                stotelės
              </Text>
            </View>
            <View
              style={[
                styles.routeStatPill,
                {
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.routeStatValue, { color: theme.text }]}>
                {s.transfers}
              </Text>
              <Text style={[styles.routeStatLabel, { color: theme.muted }]}>
                persėdimai
              </Text>
            </View>
            <View
              style={[
                styles.routeStatPill,
                {
                  backgroundColor: theme.surfaceSoft,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.routeStatValue, { color: theme.text }]}>
                {s.walk}
              </Text>
              <Text style={[styles.routeStatLabel, { color: theme.muted }]}>
                min eiti
              </Text>
            </View>
          </View>
        </View>
      </View>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.stepsContent}
        showsVerticalScrollIndicator={false}
      >
        {steps.map((step, index) => (
          <StepRow
            key={`details-step-${step.id || step.title || step.type || "step"}-${index}`}
            step={step}
            active={index === 0}
          />
        ))}
      </ScrollView>
      <View
        style={[
          styles.stickyCtaWrap,
          {
            backgroundColor: theme.backgroundElevated,
            borderTopColor: theme.border,
          },
        ]}
      >
        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.accent }]}
          onPress={props.onStartJourney}
        >
          <Ionicons name="navigate" size={14} color={COLORS.green} />
          <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>
            GO — pradėti kelionę
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavigationState(props: Props) {
  const { theme } = useAppPreferences();
  const route = props.selectedRoute;
  if (!route) return <SearchState {...props} />;
  const vm = buildJourneyViewModel(
    props.flowState,
    route,
    props.currentStepIndex || 0,
  );
  const steps = getSteps(route);
  const active = vm.activeStep || steps[0];
  return (
    <View style={styles.stateRoot}>
      <View style={styles.fixedHeader}>
        <Header
          title={vm.title}
          subtitle={vm.subtitle}
          icon={stepIcon(active)}
          badge={vm.progressLabel}
          onClose={props.onReset}
          onBack={props.onBackToRoutes}
        />
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: theme.surfaceMuted },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.accent },
              { width: `${Math.round(vm.progressPercent * 100)}%` },
            ]}
          />
        </View>
      </View>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.navStepsContent}
        showsVerticalScrollIndicator={false}
      >
        {steps
          .slice(Math.max(0, vm.activeStepIndex - 1), vm.activeStepIndex + 5)
          .map((step, idx) => {
            const absolute = Math.max(0, vm.activeStepIndex - 1) + idx;
            return (
              <StepRow
                key={`navigation-step-${step.id || step.title || step.type || "step"}-${absolute}`}
                step={step}
                active={absolute === vm.activeStepIndex}
              />
            );
          })}
      </ScrollView>
      <View
        style={[
          styles.stickyCtaWrap,
          {
            backgroundColor: theme.backgroundElevated,
            borderTopColor: theme.border,
          },
        ]}
      >
        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.accent }]}
          onPress={
            props.flowState === "completed" ? props.onReset : props.onNextStep
          }
        >
          <Text style={[styles.primaryButtonText, { color: theme.accentText }]}>
            {vm.primaryCta}
          </Text>
          <Ionicons name="arrow-forward" size={15} color={COLORS.green} />
        </Pressable>
      </View>
    </View>
  );
}

export default function JourneySheet(props: Props) {
  const { theme } = useAppPreferences();
  const stage: Stage = props.selectedMapPlace
    ? "search"
    : stageFor(props.flowState, props.selectedRoute);
  const translateY = useRef(
    new Animated.Value(
      snapForStage(stage, props.query, props.searchResults.length),
    ),
  ).current;
  const translateYValue = useRef(
    snapForStage(stage, props.query, props.searchResults.length),
  );
  const startY = useRef(translateYValue.current);
  const keyboardOpen = useRef(false);
  const userSnapRef = useRef(
    snapForStage(stage, props.query, props.searchResults.length),
  );

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      keyboardOpen.current = true;

      // Do not collapse the sheet while the user is typing. If the user has
      // already dragged it higher than MID, keep that expanded position.
      const next = Math.min(translateYValue.current, SNAP_MID);
      translateYValue.current = next;
      userSnapRef.current = next;
      animateTo(translateY, next);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpen.current = false;
      const suggested = snapForStage(
        stage,
        props.query,
        props.searchResults.length,
      );
      const next =
        props.query.trim().length >= 2
          ? Math.min(userSnapRef.current, suggested)
          : suggested;
      translateYValue.current = next;
      userSnapRef.current = next;
      animateTo(translateY, next);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [stage, props.query, props.searchResults.length, translateY]);

  useEffect(() => {
    if (keyboardOpen.current) return;

    const suggested = snapForStage(
      stage,
      props.query,
      props.searchResults.length,
    );
    const next =
      props.query.trim().length >= 2
        ? Math.min(userSnapRef.current, suggested)
        : suggested;
    translateYValue.current = next;
    userSnapRef.current = next;
    animateTo(translateY, next);
  }, [stage, props.query, props.searchResults.length, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dy) > 4 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.08,
        onPanResponderGrant: () => {
          startY.current = translateYValue.current;
          translateY.stopAnimation((value) => {
            translateYValue.current = value;
            startY.current = value;
          });
        },
        onPanResponderMove: (_evt, gesture) => {
          const maxSnap = stage === "navigation" ? SNAP_COMPACT : SNAP_BOTTOM;
          const next = Math.max(
            SNAP_FULL,
            Math.min(maxSnap, startY.current + gesture.dy),
          );
          translateYValue.current = next;
          translateY.setValue(next);
        },
        onPanResponderRelease: (_evt, gesture) => {
          const projected = translateYValue.current + gesture.vy * 165;
          const rawSnap = nearestSnap(projected, stage);
          const snap = keyboardOpen.current
            ? Math.min(rawSnap, SNAP_MID)
            : rawSnap;
          translateYValue.current = snap;
          userSnapRef.current = snap;
          animateTo(translateY, snap);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
        onPanResponderTerminate: () => {
          const rawSnap = nearestSnap(translateYValue.current, stage);
          const snap = keyboardOpen.current
            ? Math.min(rawSnap, SNAP_MID)
            : rawSnap;
          translateYValue.current = snap;
          userSnapRef.current = snap;
          animateTo(translateY, snap);
        },
      }),
    [stage, translateY],
  );

  return (
    <Animated.View
      style={[
        styles.sheetShell,
        theme.isLight && styles.sheetShellLight,
        { height: SHEET_HEIGHT, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={theme.isLight ? 58 : 92}
        tint={theme.isLight ? "light" : "dark"}
        style={[
          styles.blurSurface,
          { backgroundColor: theme.surfaceStrong, borderColor: theme.border },
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.dragArea}>
          <View style={[styles.grabber, { backgroundColor: theme.grabber }]} />
        </View>
        {stage === "search" ? (
          <SearchState {...props} panHandlers={panResponder.panHandlers} />
        ) : null}
        {stage === "loading" ? <LoadingState onReset={props.onReset} /> : null}
        {stage === "routes" ? <RoutesListState {...props} /> : null}
        {stage === "details" ? <RouteDetailsState {...props} /> : null}
        {stage === "navigation" ? <NavigationState {...props} /> : null}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheetShellLight: { backgroundColor: "rgb(246,248,252)" },
  blurSurfaceLight: { backgroundColor: "rgb(255,255,255)" },
  searchSkeletonWrap: { gap: 10, paddingTop: 10, paddingBottom: 8 },
  searchSkeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  searchSkeletonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  searchSkeletonLineWide: {
    width: "72%",
    height: 13,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 8,
  },
  searchSkeletonLineSmall: {
    width: "44%",
    height: 10,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  sheetShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: "hidden",
    zIndex: 30,
    elevation: 30,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    backgroundColor: "rgb(5,10,18)",
  },
  blurSurface: {
    flex: 1,
    backgroundColor: "rgb(5,10,18)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  dragArea: { height: 30, alignItems: "center", justifyContent: "center" },
  grabber: {
    width: 64,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
  stateRoot: { flex: 1 },
  fixedHeader: { paddingHorizontal: 18, paddingBottom: 10 },
  fixedHeaderCompact: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  roundControl: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.green,
  },
  headerTextBlock: { flex: 1 },
  kicker: {
    color: COLORS.green,
    fontSize: T.tiny,
    lineHeight: LINE_HEIGHT.tiny,
    letterSpacing: 1.4,
    fontWeight: "900",
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: T.title,
    lineHeight: LINE_HEIGHT.title,
    fontWeight: "900",
    marginTop: 1,
  },
  sheetSubtitle: {
    color: COLORS.muted,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "700",
    marginTop: 1,
  },
  headerBadge: {
    minWidth: 34,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,25,36,0.10)",
  },
  headerBadgeText: {
    color: COLORS.text,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
  },
  modeSelector: {
    height: 42,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modeItem: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modeItemActive: {
    backgroundColor: "rgba(55,245,174,0.15)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  endpointBox: {
    borderRadius: 18,
    backgroundColor: "rgba(8,18,32,0.92)",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  endpointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 31,
  },
  locationDotBlue: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.green,
  },
  endpointText: {
    color: COLORS.text,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "700",
  },
  endpointDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginLeft: 20,
    marginVertical: 4,
  },
  searchInputRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "700",
    paddingVertical: 0,
  },
  searchClearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,25,36,0.08)",
  },
  searchScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 110,
  },
  appleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  appleSearchPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: "rgba(8,18,32,0.94)",
    borderWidth: 1,
    borderColor: "rgba(55,245,174,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  profileAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,18,32,0.94)",
    borderWidth: 1,
    borderColor: "rgba(55,245,174,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  appleStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 2,
  },
  appleStatusChip: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(53,242,180,0.14)",
  },
  appleStatusChipWarning: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,193,7,0.18)",
  },
  appleStatusText: {
    color: COLORS.greenDark,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
  },
  appleStatusTextWarning: {
    color: "#8A5A00",
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
  },

  placePreviewCardPro: {
    borderRadius: 26,
    backgroundColor: "rgba(8,18,32,0.95)",
    borderWidth: 1,
    borderColor: "rgba(55,245,174,0.18)",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
  },
  placePhotoStrip: { marginHorizontal: -4, marginBottom: 12 },
  placePhotoContent: { paddingHorizontal: 4, gap: 8 },
  placePhoto: {
    width: 148,
    height: 92,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  placePreviewTopPro: { flexDirection: "row", alignItems: "center", gap: 11 },
  placePreviewClosePro: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,25,36,0.08)",
  },
  placeLoadingRowPro: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  placeMetaGrid: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  placeMetaPillOpen: { backgroundColor: "rgba(52,245,179,0.18)" },
  placeMetaPillClosed: { backgroundColor: "rgba(255,99,99,0.14)" },
  placeMetaTextOpen: { color: COLORS.greenDark },
  placeMetaTextClosed: { color: "#9A1C1C" },
  placeHoursBox: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 3,
  },
  placeHoursText: {
    color: COLORS.muted,
    fontSize: T.tiny,
    lineHeight: LINE_HEIGHT.tiny,
    fontWeight: "800",
  },
  placePreviewCard: {
    borderRadius: 24,
    backgroundColor: "rgba(8,18,32,0.94)",
    borderWidth: 1,
    borderColor: "rgba(55,245,174,0.18)",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  placePreviewTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  placePreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(52,245,179,0.18)",
  },
  placePreviewKicker: {
    color: COLORS.muted,
    fontSize: T.tiny,
    lineHeight: LINE_HEIGHT.tiny,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  placePreviewTitle: {
    color: COLORS.text,
    fontSize: T.section,
    lineHeight: LINE_HEIGHT.section,
    fontWeight: "900",
    marginTop: 2,
  },
  placePreviewSubtitle: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "700",
    marginTop: 1,
  },
  placePreviewClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,25,36,0.07)",
  },
  placeLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingLeft: 53,
  },
  placeLoadingText: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "800",
  },
  placeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingLeft: 53,
  },
  placeMetaPill: {
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 9,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  placeMetaText: {
    color: COLORS.muted,
    fontSize: T.tiny,
    lineHeight: LINE_HEIGHT.tiny,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  placePreviewActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  placeActionButtonSecondary: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  placeActionButtonPrimary: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.green,
  },
  placeRouteButton: {
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 9,
    backgroundColor: COLORS.green,
    shadowColor: "#34F5B3",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  placeRouteButtonText: {
    color: COLORS.greenDark,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "900",
  },
  placeActionText: {
    color: COLORS.text,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
  },
  placeActionTextPrimary: {
    color: COLORS.greenDark,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
  },
  appleMenuRoot: { paddingBottom: 18 },
  menuSectionTitle: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuSectionTitleInside: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  suggestionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  suggestionChip: {
    minHeight: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(8,18,32,0.92)",
    borderWidth: 1,
    borderColor: "rgba(55,245,174,0.18)",
  },
  suggestionChipText: {
    color: COLORS.text,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
  },
  menuCard: {
    borderRadius: 22,
    padding: 10,
    backgroundColor: "rgba(8,18,32,0.88)",
    borderWidth: 1,
    borderColor: "rgba(55,245,174,0.18)",
    marginBottom: 12,
  },
  quickMenuLoadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  quickMenuRow: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickMenuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(53,242,180,0.18)",
  },
  quickMenuTitle: {
    color: COLORS.text,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "900",
  },
  quickMenuSubtitle: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "700",
    marginTop: 1,
  },
  emptyBlock: { paddingTop: 24 },
  emptyBlockCompact: {
    borderRadius: 18,
    backgroundColor: "rgba(8,18,32,0.86)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: T.section,
    lineHeight: LINE_HEIGHT.section,
    fontWeight: "900",
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "700",
    marginTop: 4,
  },
  searchResultRow: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(8,18,32,0.88)",
    marginBottom: 8,
  },
  resultIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(53,242,180,0.18)",
  },
  resultTitle: {
    color: COLORS.text,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "800",
  },
  resultSubtitle: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "600",
    marginTop: 1,
  },
  inlineError: {
    color: "#B00020",
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "700",
    marginBottom: 8,
  },
  loadingBox: {
    marginHorizontal: 18,
    borderRadius: 18,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    backgroundColor: "rgba(8,18,32,0.88)",
  },
  loadingText: {
    color: COLORS.text,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "700",
    textAlign: "center",
  },
  loadingSubtext: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "700",
    textAlign: "center",
  },
  skeletonCard: {
    width: "100%",
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  skeletonCardShort: { width: "82%", opacity: 0.72 },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  blueChip: {
    backgroundColor: COLORS.green,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  blueChipText: {
    color: COLORS.greenDark,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "800",
  },
  grayChip: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  grayChipText: {
    color: COLORS.text,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "800",
  },
  routesContent: { paddingHorizontal: 18, paddingBottom: 115, paddingTop: 2 },
  routeCard: {
    borderRadius: 24,
    backgroundColor: "rgba(8,18,32,0.94)",
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  routeCardSelected: {
    borderColor: "rgba(55,245,174,0.72)",
    backgroundColor: "rgba(55,245,174,0.13)",
  },
  routeCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  routeDurationBlock: { flex: 1 },
  routeDuration: {
    color: COLORS.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.9,
  },
  routeSubtitle: {
    color: COLORS.text,
    opacity: 0.82,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "800",
  },
  routeLiveText: {
    color: COLORS.green,
    fontSize: T.tiny,
    lineHeight: LINE_HEIGHT.tiny,
    fontWeight: "900",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  routeTimeBox: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  routeTimeText: {
    color: COLORS.text,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
  },
  routeMiniTimeline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 11,
  },
  routeMiniStep: {
    maxWidth: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  routeMiniIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(55,245,174,0.13)",
  },
  routeMiniText: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    maxWidth: 58,
  },
  routeSelectRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routeSelectHint: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "800",
  },
  routeGoPill: {
    height: 30,
    minWidth: 54,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.green,
    paddingHorizontal: 12,
  },
  routeGoText: {
    color: COLORS.greenDark,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  busBadge: {
    minWidth: 30,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.green,
    paddingHorizontal: 7,
  },
  busBadgeText: {
    color: COLORS.greenDark,
    fontSize: T.badge,
    lineHeight: LINE_HEIGHT.badge,
    fontWeight: "900",
  },
  neutralBadge: {
    minHeight: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
  },
  neutralBadgeText: {
    color: COLORS.text,
    fontSize: T.badge,
    lineHeight: LINE_HEIGHT.badge,
    fontWeight: "800",
  },
  liveBadge: {
    minHeight: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  liveBadgeText: {
    fontSize: T.badge,
    lineHeight: LINE_HEIGHT.badge,
    fontWeight: "900",
  },
  routeOptionBadgeText: {
    fontSize: T.tiny,
    lineHeight: LINE_HEIGHT.tiny,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailSummaryCard: {
    borderRadius: 24,
    backgroundColor: "rgba(8,18,32,0.94)",
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  detailDuration: {
    color: COLORS.text,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.9,
  },
  detailSubtitle: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "800",
    marginTop: 2,
  },
  detailLiveText: {
    color: COLORS.green,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
    marginTop: 3,
    marginBottom: 10,
  },
  routeStatsGrid: { flexDirection: "row", gap: 8, marginTop: 10 },
  routeStatPill: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  routeStatValue: {
    color: COLORS.text,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "900",
  },
  routeStatLabel: {
    color: COLORS.muted,
    fontSize: T.badge,
    lineHeight: LINE_HEIGHT.badge,
    fontWeight: "800",
    marginTop: 1,
  },
  // Extra bottom padding keeps the last trip steps above the floating bottom tab bar
  // and above the fixed CTA button. Without this, the tab bar can cover the
  // “GO — pradėti kelionę” button on iPhone/Android.
  stepsContent: { paddingHorizontal: 18, paddingBottom: 240, paddingTop: 2 },
  navStepsContent: { paddingHorizontal: 18, paddingBottom: 240, paddingTop: 4 },
  stepRow: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: "rgba(8,18,32,0.76)",
    marginBottom: 7,
  },
  stepRowBlock: {
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: "rgba(8,18,32,0.82)",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(55,245,174,0.16)",
  },
  stepRowBlockActive: {
    borderColor: "rgba(53,242,180,0.44)",
    backgroundColor: "rgba(53,242,180,0.10)",
  },
  stepRowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepRail: { width: 12, alignItems: "center" },
  stepLineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(80,90,110,0.42)",
  },
  stepLineDotActive: { backgroundColor: COLORS.green },
  stepIconMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(53,242,180,0.18)",
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "800",
  },
  stepSubtitle: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "700",
    marginTop: 1,
  },
  stepMetaText: {
    color: COLORS.dim,
    fontSize: T.badge,
    lineHeight: LINE_HEIGHT.badge,
    fontWeight: "800",
    marginTop: 3,
  },
  stepBadge: {
    color: COLORS.greenDark,
    fontSize: T.badge,
    lineHeight: LINE_HEIGHT.badge,
    fontWeight: "900",
    minWidth: 36,
    textAlign: "right",
  },
  stopTimelineBox: {
    marginLeft: 50,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stopTimelineRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stopTimelineTime: {
    width: 56,
    color: COLORS.dim,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  stopTimelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
  stopTimelineName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  stopTimelineMore: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: T.badge,
    lineHeight: LINE_HEIGHT.badge,
    fontWeight: "800",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(20,27,37,0.12)",
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: COLORS.green },
  // Raised above the floating Keliauti / Paskyra tab bar.
  stickyCtaWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 112,
    zIndex: 50,
    elevation: 50,
  },
  primaryButton: {
    height: 54,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: COLORS.green,
    shadowColor: COLORS.green,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryButtonText: {
    color: COLORS.greenDark,
    fontSize: T.cta,
    lineHeight: LINE_HEIGHT.cta,
    fontWeight: "900",
  },
  appleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  appleSheetKicker: {
    color: COLORS.green,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2.4,
    marginBottom: 2,
  },
  appleSheetTitle: {
    color: COLORS.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  appleSheetTitleCentered: {
    color: COLORS.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.25,
  },
  tripFormCard: {
    position: "relative",
    borderRadius: 28,
    padding: 12,
    backgroundColor: "rgba(7,12,22,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 12,
    marginTop: 2,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  swapPlacesButton: {
    position: "absolute",
    right: 18,
    top: 71,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,251,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  favoriteSaveButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(52,245,162,0.10)",
    marginRight: 2,
  },
  tripInputRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  tripInputIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(52,245,179,0.14)",
  },
  tripInputLabel: {
    color: COLORS.muted,
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  tripInputValue: {
    color: COLORS.text,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "900",
  },
  inlineInputRow: {
    minHeight: 38,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  inlineInput: {
    flex: 1,
    minHeight: 38,
    paddingVertical: 0,
    color: COLORS.text,
    fontSize: T.body,
    lineHeight: LINE_HEIGHT.body,
    fontWeight: "800",
  },
  tripDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginLeft: 56,
  },
});
