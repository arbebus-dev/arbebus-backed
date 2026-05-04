import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useLanguage } from "@/core/i18n/LanguageContext";
import { COLORS, LINE_HEIGHT, T } from "@/core/theme/typography";
import {
  buildJourneyViewModel,
  cleanRouteNumber,
  cleanStopName,
  getSteps,
  routeNumbersFromRoute,
} from "../transit/models/journeyStateMachine";
import type {
  PlaceSearchResult,
  TransitFlowState,
  TransitRouteOption,
  TransitStep,
} from "../transit/models/transitTypes";

type Props = {
  flowState: TransitFlowState;
  liveBusCount: number;
  query: string;
  searchResults: PlaceSearchResult[];
  isSearching?: boolean;
  isPlanning?: boolean;
  routeOptions: TransitRouteOption[];
  selectedRoute: TransitRouteOption | null;
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
  onChooseRoute: (route: TransitRouteOption) => void;
  onStartJourney: () => void;
  onNextStep: () => void;
  onBackToRoutes: () => void;
  onBackToSearch: () => void;
  onReset: () => void;
};

type Stage = "search" | "loading" | "routes" | "details" | "navigation";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_TOP = 68;
const SNAP_FULL = SHEET_TOP;
const SNAP_MID = Math.round(SCREEN_HEIGHT * 0.43);
const SNAP_BOTTOM = Math.max(SCREEN_HEIGHT - 118, SCREEN_HEIGHT * 0.855);
const SNAP_COMPACT = Math.max(SCREEN_HEIGHT - 220, SCREEN_HEIGHT * 0.72);
const SHEET_HEIGHT = SCREEN_HEIGHT - SHEET_TOP + 28;

function n(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function routeLabel(route: TransitRouteOption | null) {
  return routeNumbersFromRoute(route)[0] || cleanRouteNumber(route?.routeLabel || route?.routeId || route?.title) || "BUS";
}

function routeSummary(route: TransitRouteOption) {
  const duration = n(route.totalDurationMinutes ?? route.totalMinutes, 0);
  const walk = n(route.totalWalkMinutes ?? route.walkingMinutes, 0);
  const transfers = n(route.transfersCount ?? route.transfers, 0);
  const stops = n(route.stopCount, 0);
  return { duration, walk, transfers, stops, label: routeLabel(route) };
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
  const route = cleanRouteNumber(step.routeNumber || step.routeLabel || step.routeId);
  if (route && step.type !== "walk") return route;
  const minutes = n(step.durationMinutes ?? step.minutes, 0);
  if (minutes) return `${minutes} min`;
  return step.type === "walk" ? "eik" : "";
}

function placeSubtitle(place: PlaceSearchResult) {
  const meters = n(place.distanceMeters, 0);
  if (meters > 0 && meters < 1000) return `${Math.round(meters)} m`;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return place.subtitle || "Klaipėda";
}

function stageFor(flowState: TransitFlowState, selectedRoute: TransitRouteOption | null): Stage {
  if (flowState === "routes_loading" || flowState === "destination_selected") return "loading";
  if (flowState === "idle" || flowState === "searching") return "search";
  if (flowState === "route_options") return "routes";
  if (flowState === "route_selected") return "details";
  if (["walking_to_stop", "waiting_bus", "onboard", "transfer", "arriving", "completed"].includes(flowState)) return "navigation";
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
  const points = stage === "navigation"
    ? [SNAP_FULL, SNAP_MID, SNAP_COMPACT]
    : [SNAP_FULL, SNAP_MID, SNAP_BOTTOM];

  return points.reduce((best, point) => {
    return Math.abs(point - y) < Math.abs(best - y) ? point : best;
  }, points[0]);
}

function animateTo(value: Animated.Value, toValue: number) {
  Animated.spring(value, {
    toValue,
    useNativeDriver: true,
    damping: 28,
    stiffness: 220,
    mass: 0.85,
  }).start();
}

function ModeSelector() {
  return (
    <View style={styles.modeSelector}>
      {[
        ["car", "car"],
        ["walk", "walk"],
        ["bus", "bus"],
        ["bike", "bicycle"],
      ].map(([key, icon]) => (
        <View key={key} style={[styles.modeItem, key === "bus" && styles.modeItemActive]}>
          <MaterialCommunityIcons name={icon as any} size={15} color={key === "bus" ? COLORS.greenDark : "#273144"} />
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
  icon?: any;
  badge?: string;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <View style={styles.headerRow}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.roundControl} hitSlop={12}>
          <Ionicons name="chevron-back" size={17} color={COLORS.textDark} />
        </Pressable>
      ) : null}
      <View style={styles.headerIcon}>
        <MaterialCommunityIcons name={icon || "directions-fork"} size={17} color={COLORS.greenDark} />
      </View>
      <View style={styles.headerTextBlock}>
        <Text style={styles.kicker}>ARBE NAVIGATION</Text>
        <Text style={styles.sheetTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.sheetSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{badge}</Text></View>
      ) : null}
      <Pressable onPress={onClose} style={styles.roundControl} hitSlop={12}>
        <Ionicons name="close" size={16} color={COLORS.textDark} />
      </Pressable>
    </View>
  );
}

function SearchInput(props: Pick<Props, "query" | "isSearching" | "onChangeQuery" | "onSubmitSearch" | "onReset">) {
  const { t } = useLanguage();
  return (
    <View style={styles.searchInputRow}>
      <Ionicons name="search" size={16} color="#657088" />
      <TextInput
        value={props.query}
        onChangeText={props.onChangeQuery}
        onSubmitEditing={() => {
          Keyboard.dismiss();
          props.onSubmitSearch();
        }}
        placeholder={t.common.searchPlaceholder}
        placeholderTextColor="#75809A"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.searchInput}
      />
      {props.isSearching ? <ActivityIndicator size="small" color={COLORS.green} /> : null}
      {props.query.trim().length ? (
        <Pressable onPress={props.onReset} hitSlop={12} style={styles.searchClearButton}>
          <Ionicons name="close" size={13} color="#657088" />
        </Pressable>
      ) : null}
    </View>
  );
}

function ProfileAvatar() {
  return (
    <Pressable
      style={styles.profileAvatar}
      onPress={() => {
        void Haptics.selectionAsync();
      }}
      hitSlop={10}
    >
      <Ionicons name="person" size={17} color="#0B1220" />
    </Pressable>
  );
}

function AppleSearchHeader({ panHandlers }: { panHandlers?: any }) {
  const { t } = useLanguage();
  return (
    <View {...(panHandlers || {})} style={styles.fixedHeaderCompact}>
      <Text style={styles.appleSheetTitleCentered}>{t.common.appName}</Text>
    </View>
  );
}

function QuickMenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.quickMenuRow}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
    >
      <View style={styles.quickMenuIcon}>
        <MaterialCommunityIcons name={icon} size={17} color={COLORS.greenDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickMenuTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.quickMenuSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={15} color="rgba(20,27,37,0.35)" />
    </Pressable>
  );
}

function SuggestionChip({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.suggestionChip}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
    >
      <MaterialCommunityIcons name={icon} size={15} color={COLORS.greenDark} />
      <Text style={styles.suggestionChipText}>{label}</Text>
    </Pressable>
  );
}

function TripInputRow({
  icon,
  label,
  value,
  children,
}: {
  icon: any;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.tripInputRow}>
      <View style={styles.tripInputIcon}>
        <MaterialCommunityIcons name={icon} size={15} color={COLORS.greenDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tripInputLabel}>{label}</Text>
        {children ? children : <Text style={styles.tripInputValue} numberOfLines={1}>{value}</Text>}
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
  return (
    <View style={styles.inlineInputRow}>
      <Ionicons name="search" size={16} color="#657088" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSubmitEditing={() => {
          Keyboard.dismiss();
          onSubmit?.();
        }}
        placeholder={placeholder}
        placeholderTextColor="#75809A"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        style={styles.inlineInput}
      />
      {isLoading ? <ActivityIndicator size="small" color={COLORS.green} /> : null}
      {value.trim().length ? (
        <Pressable onPress={onClear} hitSlop={12} style={styles.searchClearButton}>
          <Ionicons name="close" size={13} color="#657088" />
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
  const { t } = useLanguage();
  const fromValue = activeField === "from" ? props.query : props.selectedOrigin?.title || "";
  const toValue = activeField === "to" ? props.query : props.selectedDestination?.title || props.query || "";

  const beginEdit = (field: "from" | "to") => {
    setActiveField(field);
    if (field === "from") {
      props.onChangeQuery(props.selectedOrigin?.title || "");
    } else {
      props.onChangeQuery(props.selectedDestination?.title || props.query || "");
    }
  };

  return (
    <View style={styles.tripFormCard}>
      <TripInputRow icon="crosshairs-gps" label={t.sheet.from}>
        <InlineInput
          value={fromValue}
          placeholder={t.sheet.fromPlaceholder || t.sheet.from}
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
      <View style={styles.tripDivider} />
      <TripInputRow icon="map-marker" label={t.sheet.to}>
        <InlineInput
          value={toValue}
          placeholder={t.sheet.toPlaceholder || t.common.searchPlaceholder}
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
      <View style={styles.tripDivider} />
      <TripInputRow icon="clock-outline" label={t.sheet.when} value={t.sheet.now} />
    </View>
  );
}


function iconForPlaceType(type?: string) {
  const value = String(type || '').toLowerCase();
  if (value === 'stop') return 'bus-stop';
  if (value === 'station') return 'train';
  if (value === 'ferry') return 'ferry';
  if (value === 'city' || value === 'region') return 'map-marker-radius';
  if (value === 'address') return 'map-marker-outline';
  return 'map-marker';
}

function PlacePreviewCard({ props }: { props: Props }) {
  const { t } = useLanguage();
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

  return (
    <View style={styles.placePreviewCard}>
      <View style={styles.placePreviewTop}>
        <View style={styles.placePreviewIcon}>
          <MaterialCommunityIcons name={iconForPlaceType(place.type) as any} size={18} color={COLORS.greenDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.placePreviewKicker}>{t.sheet.selectedPlace}</Text>
          <Text style={styles.placePreviewTitle} numberOfLines={1}>{place.title}</Text>
          <Text style={styles.placePreviewSubtitle} numberOfLines={2}>{place.subtitle || placeSubtitle(place)}</Text>
        </View>
        <Pressable onPress={props.onClearMapPlace} hitSlop={12} style={styles.placePreviewClose}>
          <Ionicons name="close" size={14} color="#657088" />
        </Pressable>
      </View>

      {props.isReverseGeocoding ? (
        <View style={styles.placeLoadingRow}>
          <ActivityIndicator size="small" color={COLORS.green} />
          <Text style={styles.placeLoadingText}>{t.sheet.locatingPlace}</Text>
        </View>
      ) : null}

      <View style={styles.placePreviewActions}>
        <Pressable style={styles.placeActionButtonSecondary} onPress={useAsOrigin}>
          <Text style={styles.placeActionText}>{t.sheet.useAsFrom}</Text>
        </Pressable>
        <Pressable style={styles.placeActionButtonSecondary} onPress={useAsDestination}>
          <Text style={styles.placeActionText}>{t.sheet.useAsTo}</Text>
        </Pressable>
      </View>
      <Pressable style={styles.placeRouteButton} onPress={useAsDestination}>
        <MaterialCommunityIcons name="navigation-variant" size={16} color={COLORS.greenDark} />
        <Text style={styles.placeRouteButtonText}>{t.sheet.showRoute}</Text>
      </Pressable>
    </View>
  );
}

function AppleMenuContent(props: Props) {
  const { t } = useLanguage();

  const runPresetSearch = (value: string) => {
    props.onChangeQuery(value);
    setTimeout(() => props.onSubmitSearch(), 0);
  };

  return (
    <View style={styles.appleMenuRoot}>
      <View style={styles.menuCard}>
        <Text style={styles.menuSectionTitleInside}>{t.sheet.favourites}</Text>
        <QuickMenuRow
          icon="heart"
          title={t.sheet.favouritePlaces}
          subtitle={t.sheet.favouritePlacesSubtitle}
          onPress={() => runPresetSearch(t.sheet.favouritePlaces)}
        />
        <QuickMenuRow
          icon="star"
          title={t.sheet.favouriteStops}
          subtitle={t.sheet.favouriteStopsSubtitle}
          onPress={() => runPresetSearch(t.sheet.favouriteStops)}
        />
      </View>
    </View>
  );
}

function SearchHeader({ panHandlers }: { panHandlers?: any }) {
  return <AppleSearchHeader panHandlers={panHandlers} />;
}

function SearchState(props: Props & { panHandlers?: any }) {
  const { t } = useLanguage();
  const [activeField, setActiveField] = React.useState<"from" | "to">("to");
  const hasResults = props.searchResults.length > 0;
  const hasQuery = props.query.trim().length >= 2;
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

        <TripSearchForm props={props} activeField={activeField} setActiveField={setActiveField} />

        {hasResults ? props.searchResults.slice(0, 10).map((place) => (
          <Pressable
            key={place.id}
            style={styles.searchResultRow}
            onPress={() => {
              void Haptics.selectionAsync();
              if (activeField === "from") {
                props.onSelectOrigin?.(place);
                props.onChangeQuery("");
                return;
              }
              props.onSelectDestination(place);
            }}
          >
            <View style={styles.resultIcon}><Ionicons name="location" size={12} color={COLORS.green} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle} numberOfLines={1}>{cleanStopName(place.title)}</Text>
              <Text style={styles.resultSubtitle} numberOfLines={1}>{placeSubtitle(place)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={COLORS.dim} />
          </Pressable>
        )) : null}

        {showEmpty ? (
          <View style={styles.emptyBlockCompact}>
            <Text style={styles.emptyTitle}>{t.sheet.noResultsTitle}</Text>
            <Text style={styles.emptyText}>{activeField === "from" ? (t.sheet.fromPlaceholder || t.sheet.noResultsText) : t.sheet.noResultsText}</Text>
          </View>
        ) : null}

        {!hasResults ? <AppleMenuContent {...props} /> : null}
      </ScrollView>
    </View>
  );
}

function LoadingState({ onReset }: Pick<Props, "onReset">) {
  return (
    <View style={styles.stateRoot}>
      <View style={styles.fixedHeader}>
        <Header title="Ieškome maršrutų" subtitle="Tikriname stoteles ir tvarkaraščius" icon="bus-clock" onClose={onReset} />
      </View>
      <View style={styles.loadingBox}>
        <ActivityIndicator color={COLORS.green} />
        <Text style={styles.loadingText}>Skaičiuojame kelionės variantus…</Text>
      </View>
    </View>
  );
}

function RoutePills({ route }: { route: TransitRouteOption }) {
  const labels = routeNumbersFromRoute(route).slice(0, 3);
  const s = routeSummary(route);
  return (
    <View style={styles.pillRow}>
      {labels.map((item) => <View key={item} style={styles.busBadge}><Text style={styles.busBadgeText}>{item}</Text></View>)}
      {s.walk ? <View style={styles.neutralBadge}><Text style={styles.neutralBadgeText}>eiti {s.walk} min</Text></View> : null}
      <View style={styles.neutralBadge}><Text style={styles.neutralBadgeText}>{s.transfers ? `${s.transfers} pers.` : "tiesiogiai"}</Text></View>
    </View>
  );
}

function RouteCard({ route, selected, onPress }: { route: TransitRouteOption; selected?: boolean; onPress: () => void }) {
  const s = routeSummary(route);
  return (
    <Pressable onPress={onPress} style={[styles.routeCard, selected && styles.routeCardSelected]}>
      <View style={styles.routeCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeDuration}>{s.duration || "–"} min</Text>
          <Text style={styles.routeSubtitle} numberOfLines={1}>Bus {route.departureText || "pagal tvarkaraštį"}</Text>
        </View>
        <View style={styles.routeTimeBox}>
          <Text style={styles.routeTimeText}>{s.label}</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.dim} />
        </View>
      </View>
      <RoutePills route={route} />
    </Pressable>
  );
}

function RoutesListState(props: Props) {
  const destination = props.routeOptions[0]?.destinationStop?.name || props.routeOptions[0]?.alightStopName || "tikslas";
  return (
    <View style={styles.stateRoot}>
      <View style={styles.fixedHeader}>
        <Header title="Directions" subtitle={`My Location → ${cleanStopName(destination)}`} icon="bus" onClose={props.onReset} onBack={props.onBackToSearch} />
        <ModeSelector />
        <View style={styles.toolbarRow}>
          <Pressable style={styles.blueChip}><Text style={styles.blueChipText}>Leave now</Text></Pressable>
          <Pressable style={styles.grayChip}><Text style={styles.grayChipText}>Prefer</Text></Pressable>
        </View>
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.routesContent} showsVerticalScrollIndicator={false}>
        {props.error ? <Text style={styles.inlineError}>{props.error}</Text> : null}
        {props.routeOptions.map((route) => (
          <RouteCard key={route.id} route={route} selected={route.id === props.selectedRoute?.id} onPress={() => props.onChooseRoute(route)} />
        ))}
      </ScrollView>
    </View>
  );
}

function StepRow({ step, active }: { step: TransitStep; active?: boolean }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <View style={[styles.stepLineDot, active && styles.stepLineDotActive]} />
      </View>
      <View style={styles.stepIconMini}><MaterialCommunityIcons name={stepIcon(step) as any} size={12} color={active ? COLORS.greenDark : COLORS.green} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle} numberOfLines={1}>{step.title}</Text>
        <Text style={styles.stepSubtitle} numberOfLines={1}>
          {[cleanStopName(step.stopName || step.fromStopName), step.toStopName ? `→ ${cleanStopName(step.toStopName)}` : null].filter(Boolean).join(" ")}
        </Text>
      </View>
      <Text style={styles.stepBadge}>{stepLabel(step)}</Text>
    </View>
  );
}

function RouteDetailsState(props: Props) {
  const route = props.selectedRoute || props.routeOptions[0] || null;
  if (!route) return <SearchState {...props} />;
  const s = routeSummary(route);
  const steps = getSteps(route);
  return (
    <View style={styles.stateRoot}>
      <View style={styles.fixedHeader}>
        <Header title="Route details" subtitle={`${cleanStopName(route.boardStopName)} → ${cleanStopName(route.alightStopName)}`} icon="bus" onClose={props.onReset} onBack={props.onBackToRoutes} />
        <View style={styles.detailSummaryCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailDuration}>{s.duration || "–"} min</Text>
            <Text style={styles.detailSubtitle} numberOfLines={1}>Bus {route.departureText || "pagal tvarkaraštį"}</Text>
          </View>
          <RoutePills route={route} />
        </View>
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.stepsContent} showsVerticalScrollIndicator={false}>
        {steps.map((step, index) => <StepRow key={step.id || index} step={step} active={index === 0} />)}
      </ScrollView>
      <View style={styles.stickyCtaWrap}>
        <Pressable style={styles.primaryButton} onPress={props.onStartJourney}>
          <Ionicons name="navigate" size={14} color={COLORS.greenDark} />
          <Text style={styles.primaryButtonText}>Start navigation</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavigationState(props: Props) {
  const route = props.selectedRoute;
  if (!route) return <SearchState {...props} />;
  const vm = buildJourneyViewModel(props.flowState, route, 0);
  const steps = getSteps(route);
  const active = vm.activeStep || steps[0];
  return (
    <View style={styles.stateRoot}>
      <View style={styles.fixedHeader}>
        <Header title={vm.title} subtitle={vm.subtitle} icon={stepIcon(active)} badge={vm.progressLabel} onClose={props.onReset} onBack={props.onBackToRoutes} />
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(vm.progressPercent * 100)}%` }]} /></View>
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.navStepsContent} showsVerticalScrollIndicator={false}>
        {steps.slice(Math.max(0, vm.activeStepIndex - 1), vm.activeStepIndex + 5).map((step, idx) => {
          const absolute = Math.max(0, vm.activeStepIndex - 1) + idx;
          return <StepRow key={step.id || absolute} step={step} active={absolute === vm.activeStepIndex} />;
        })}
      </ScrollView>
      <View style={styles.stickyCtaWrap}>
        <Pressable style={styles.primaryButton} onPress={props.flowState === "completed" ? props.onReset : props.onNextStep}>
          <Text style={styles.primaryButtonText}>{vm.primaryCta}</Text>
          <Ionicons name="arrow-forward" size={15} color={COLORS.greenDark} />
        </Pressable>
      </View>
    </View>
  );
}

export default function JourneySheet(props: Props) {
  const stage = stageFor(props.flowState, props.selectedRoute);
  const translateY = useRef(new Animated.Value(snapForStage(stage, props.query, props.searchResults.length))).current;
  const translateYValue = useRef(snapForStage(stage, props.query, props.searchResults.length));
  const startY = useRef(translateYValue.current);
  const keyboardOpen = useRef(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      keyboardOpen.current = true;
      const next = SNAP_MID;
      translateYValue.current = next;
      animateTo(translateY, next);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardOpen.current = false;
      const next = snapForStage(stage, props.query, props.searchResults.length);
      translateYValue.current = next;
      animateTo(translateY, next);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [stage, props.query, props.searchResults.length, translateY]);

  useEffect(() => {
    if (keyboardOpen.current) return;
    const next = snapForStage(stage, props.query, props.searchResults.length);
    translateYValue.current = next;
    animateTo(translateY, next);
  }, [stage, props.query, props.searchResults.length, translateY]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      startY.current = translateYValue.current;
      translateY.stopAnimation((value) => {
        translateYValue.current = value;
        startY.current = value;
      });
    },
    onPanResponderMove: (_evt, gesture) => {
      const next = Math.max(SNAP_FULL, Math.min(SNAP_BOTTOM, startY.current + gesture.dy));
      translateYValue.current = next;
      translateY.setValue(next);
    },
    onPanResponderRelease: (_evt, gesture) => {
      const projected = translateYValue.current + gesture.vy * 120;
      const snap = nearestSnap(projected, stage);
      translateYValue.current = snap;
      animateTo(translateY, snap);
      void Haptics.selectionAsync();
    },
    onPanResponderTerminate: () => {
      const snap = nearestSnap(translateYValue.current, stage);
      translateYValue.current = snap;
      animateTo(translateY, snap);
    },
  }), [stage, translateY]);

  return (
    <Animated.View
      style={[styles.sheetShell, { height: SHEET_HEIGHT, transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <BlurView intensity={86} tint="light" style={styles.blurSurface}>
        <View {...panResponder.panHandlers} style={styles.dragArea}>
          <View style={styles.grabber} />
        </View>
        {stage === "search" ? <SearchState {...props} panHandlers={panResponder.panHandlers} /> : null}
        {stage === "loading" ? <LoadingState onReset={props.onReset} /> : null}
        {stage === "routes" ? <RoutesListState {...props} /> : null}
        {stage === "details" ? <RouteDetailsState {...props} /> : null}
        {stage === "navigation" ? <NavigationState {...props} /> : null}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheetShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    zIndex: 30,
    elevation: 30,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    backgroundColor: "rgba(247,250,247,0.92)",
  },
  blurSurface: { flex: 1, backgroundColor: "rgba(247,250,247,0.74)" },
  dragArea: { height: 24, alignItems: "center", justifyContent: "center" },
  grabber: { width: 56, height: 5, borderRadius: 99, backgroundColor: "rgba(25,35,50,0.20)" },
  stateRoot: { flex: 1 },
  fixedHeader: { paddingHorizontal: 18, paddingBottom: 10 },
  fixedHeaderCompact: { paddingHorizontal: 18, paddingBottom: 10, alignItems: "center", justifyContent: "center" },
  scrollArea: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  roundControl: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,27,37,0.08)" },
  headerIcon: { width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.green },
  headerTextBlock: { flex: 1 },
  kicker: { color: "#17A67E", fontSize: T.tiny, lineHeight: LINE_HEIGHT.tiny, letterSpacing: 1.4, fontWeight: "900" },
  sheetTitle: { color: COLORS.textDark, fontSize: T.title, lineHeight: LINE_HEIGHT.title, fontWeight: "900", marginTop: 1 },
  sheetSubtitle: { color: "#596477", fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "700", marginTop: 1 },
  headerBadge: { minWidth: 34, height: 28, paddingHorizontal: 8, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(18,25,36,0.10)" },
  headerBadgeText: { color: COLORS.textDark, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
  modeSelector: { height: 42, borderRadius: 17, backgroundColor: "rgba(16,22,32,0.07)", padding: 4, flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  modeItem: { flex: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modeItemActive: { backgroundColor: "white", shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  endpointBox: { borderRadius: 18, backgroundColor: "rgba(255,255,255,0.70)", paddingHorizontal: 13, paddingVertical: 10 },
  endpointRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 31 },
  locationDotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.blue },
  endpointText: { color: COLORS.textDark, fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "700" },
  endpointDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(45,55,72,0.18)", marginLeft: 20, marginVertical: 4 },
  searchInputRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, color: COLORS.textDark, fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "700", paddingVertical: 0 },
  searchClearButton: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(18,25,36,0.08)" },
  searchScrollContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 110 },
  appleTopRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  appleSearchPill: { flex: 1, minHeight: 48, borderRadius: 24, paddingHorizontal: 14, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(20,27,37,0.06)", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  profileAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.86)", borderWidth: 1, borderColor: "rgba(20,27,37,0.07)", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  appleStatusRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 2 },
  appleStatusChip: { minHeight: 28, borderRadius: 14, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(53,242,180,0.14)" },
  appleStatusChipWarning: { minHeight: 28, borderRadius: 14, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,193,7,0.18)" },
  appleStatusText: { color: COLORS.greenDark, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
  appleStatusTextWarning: { color: "#8A5A00", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
  placePreviewCard: {
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(20,27,37,0.07)",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.10,
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
    color: "#667083",
    fontSize: T.tiny,
    lineHeight: LINE_HEIGHT.tiny,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  placePreviewTitle: {
    color: COLORS.textDark,
    fontSize: T.section,
    lineHeight: LINE_HEIGHT.section,
    fontWeight: "900",
    marginTop: 2,
  },
  placePreviewSubtitle: {
    color: "#667083",
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
    color: "#667083",
    fontSize: T.caption,
    lineHeight: LINE_HEIGHT.caption,
    fontWeight: "800",
  },
  placePreviewActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  placeActionButtonSecondary: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,27,37,0.07)",
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
    color: COLORS.textDark,
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
  menuSectionTitle: { color: "#667083", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8, marginLeft: 4 },
  menuSectionTitleInside: { color: "#667083", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6, paddingHorizontal: 4 },
  suggestionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  suggestionChip: { minHeight: 38, borderRadius: 19, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(20,27,37,0.06)" },
  suggestionChipText: { color: COLORS.textDark, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900" },
  menuCard: { borderRadius: 22, padding: 10, backgroundColor: "rgba(255,255,255,0.66)", borderWidth: 1, borderColor: "rgba(20,27,37,0.06)", marginBottom: 12 },
  quickMenuRow: { minHeight: 54, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  quickMenuIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(53,242,180,0.18)" },
  quickMenuTitle: { color: COLORS.textDark, fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900" },
  quickMenuSubtitle: { color: "#6A7488", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginTop: 1 },
  emptyBlock: { paddingTop: 24 },
  emptyBlockCompact: { borderRadius: 18, backgroundColor: "rgba(255,255,255,0.56)", paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  emptyTitle: { color: COLORS.textDark, fontSize: T.section, lineHeight: LINE_HEIGHT.section, fontWeight: "900" },
  emptyText: { color: "#667083", fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "700", marginTop: 4 },
  searchResultRow: { minHeight: 52, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.62)", marginBottom: 8 },
  resultIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(53,242,180,0.18)" },
  resultTitle: { color: COLORS.textDark, fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "800" },
  resultSubtitle: { color: "#6A7488", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "600", marginTop: 1 },
  inlineError: { color: "#B00020", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginBottom: 8 },
  loadingBox: { marginHorizontal: 18, borderRadius: 18, minHeight: 96, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.64)" },
  loadingText: { color: COLORS.textDark, fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "700" },
  toolbarRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  blueChip: { backgroundColor: COLORS.blue, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  blueChipText: { color: "white", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "800" },
  grayChip: { backgroundColor: "rgba(17,24,39,0.08)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  grayChipText: { color: COLORS.textDark, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "800" },
  routesContent: { paddingHorizontal: 18, paddingBottom: 115, paddingTop: 2 },
  routeCard: { borderRadius: 18, backgroundColor: "rgba(255,255,255,0.70)", padding: 13, marginBottom: 10, borderWidth: 1, borderColor: "rgba(35,47,70,0.07)" },
  routeCardSelected: { borderColor: COLORS.green, backgroundColor: "rgba(53,242,180,0.12)" },
  routeCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  routeDuration: { color: COLORS.textDark, fontSize: T.section, lineHeight: LINE_HEIGHT.section, fontWeight: "900" },
  routeSubtitle: { color: "#5E687A", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginTop: 2 },
  routeTimeBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeTimeText: { color: COLORS.textDark, fontSize: T.route, lineHeight: LINE_HEIGHT.route, fontWeight: "900" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  busBadge: { minWidth: 30, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.blue, paddingHorizontal: 7 },
  busBadgeText: { color: "white", fontSize: T.badge, lineHeight: LINE_HEIGHT.badge, fontWeight: "900" },
  neutralBadge: { minHeight: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,27,37,0.08)", paddingHorizontal: 8 },
  neutralBadgeText: { color: COLORS.textDark, fontSize: T.badge, lineHeight: LINE_HEIGHT.badge, fontWeight: "800" },
  detailSummaryCard: { borderRadius: 18, backgroundColor: "rgba(255,255,255,0.68)", padding: 13, marginBottom: 8 },
  detailDuration: { color: COLORS.textDark, fontSize: T.section, lineHeight: LINE_HEIGHT.section, fontWeight: "900" },
  detailSubtitle: { color: "#5E687A", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginTop: 2, marginBottom: 10 },
  stepsContent: { paddingHorizontal: 18, paddingBottom: 132, paddingTop: 2 },
  navStepsContent: { paddingHorizontal: 18, paddingBottom: 132, paddingTop: 4 },
  stepRow: { minHeight: 49, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.48)", marginBottom: 7 },
  stepRail: { width: 12, alignItems: "center" },
  stepLineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(80,90,110,0.42)" },
  stepLineDotActive: { backgroundColor: COLORS.green },
  stepIconMini: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(53,242,180,0.18)" },
  stepTitle: { color: COLORS.textDark, fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "800" },
  stepSubtitle: { color: "#626D82", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "700", marginTop: 1 },
  stepBadge: { color: COLORS.greenDark, fontSize: T.badge, lineHeight: LINE_HEIGHT.badge, fontWeight: "900", minWidth: 36, textAlign: "right" },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(20,27,37,0.12)", overflow: "hidden", marginBottom: 6 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: COLORS.green },
  stickyCtaWrap: { position: "absolute", left: 18, right: 18, bottom: 22 },
  primaryButton: { height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: COLORS.green },
  primaryButtonText: { color: COLORS.greenDark, fontSize: T.cta, lineHeight: LINE_HEIGHT.cta, fontWeight: "900" },
  appleTitleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  appleSheetKicker: { color: COLORS.green, fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2.4, marginBottom: 2 },
  appleSheetTitle: { color: COLORS.textDark, fontSize: 28, lineHeight: 34, fontWeight: "900" },
  appleSheetTitleCentered: { color: COLORS.textDark, fontSize: 20, lineHeight: 24, fontWeight: "900", textAlign: "center", letterSpacing: -0.2 },
  tripFormCard: { borderRadius: 24, padding: 12, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: "rgba(20,27,37,0.06)", marginBottom: 12, marginTop: 2 },
  tripInputRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 8, paddingVertical: 6 },
  tripInputIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(53,242,180,0.16)" },
  tripInputLabel: { color: "#667083", fontSize: T.caption, lineHeight: LINE_HEIGHT.caption, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  tripInputValue: { color: COLORS.textDark, fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "900" },
  tripDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(45,55,72,0.16)", marginLeft: 54 },
});
