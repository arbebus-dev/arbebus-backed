import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, View } from "react-native";
import MapView from "react-native-maps";
import Purchases from "react-native-purchases";
import { SafeAreaView } from "react-native-safe-area-context";

import HomeBackendStatus from "../../components/home/HomeBackendStatus";
import HomeBottomSheet from "../../components/home/HomeBottomSheet";
import HomeCachedDataBadge from "../../components/home/HomeCachedDataBadge";
import HomeEmptyState from "../../components/home/HomeEmptyState";
import HomeLoadingOverlay from "../../components/home/HomeLoadingOverlay";
import HomeMapLayer from "../../components/home/HomeMapLayer";
import HomeOnboarding from "../../components/home/HomeOnboarding";
import HomePaywall from "../../components/home/HomePaywall";
import HomeTopHud from "../../components/home/HomeTopHud";
import {
  SHEET_CLOSED_Y,
  SHEET_MID_Y,
  SHEET_OPEN_Y,
  TAB_BAR_BOTTOM,
  TAB_BAR_HEIGHT,
} from "../../constants/home";
import { useRideBooking } from "../../core/features/rideBooking/hooks/useRideBooking";
import { useBottomSheet } from "../../hooks/useBottomSheet";
import { useHomeActions } from "../../hooks/useHomeActions";
import { useHomeBootstrap } from "../../hooks/useHomeBootstrap";
import { useLeaveAlert } from "../../hooks/useLeaveAlerts";
import { useLiveBuses } from "../../hooks/useLiveBuses";
import { useNotifications } from "../../hooks/useNotifications";
import { useOnboardingActions } from "../../hooks/useOnboardingActions";
import { usePaywall } from "../../hooks/usePaywall";
import { usePrimaryAction } from "../../hooks/usePrimaryAction";
import { useProAccess } from "../../hooks/useProAccess";
import { useProGate } from "../../hooks/useProGate";
import { useRideStatusEffects } from "../../hooks/useRideStatusEffects";
import { useSmartRoute } from "../../hooks/useSmartRoute";
import { useTransportActions } from "../../hooks/useTransportActions";
import { useUiAnimations } from "../../hooks/useUiAnimations";
import { useWeather } from "../../hooks/useWeather";
import styles from "../../styles";
import { LiveBus, TravelMode } from "../../types/home";
import { getFloatingAiCopy } from "../../utils/homeUi";

type MdiIconName =
  React.ComponentProps<
    typeof import("@expo/vector-icons").MaterialCommunityIcons
  >["name"];

const onboardingSlides: {
  title: string;
  subtitle: string;
  icon: MdiIconName;
}[] = [
  {
    title: "Rask greičiausią kelią mieste",
    subtitle: "AI palygina autobusą, taxi ir ėjimą viename vaizde",
    icon: "brain",
  },
  {
    title: "Matyk realų transportą",
    subtitle: "Live autobusai, ETA ir aiškus maršrutas be spėliojimo",
    icon: "bus-clock",
  },
  {
    title: "Arbebus Pro sutaupo laiką",
    subtitle: "Gauk Smart Route, leave alerts ir delay alerts",
    icon: "crown-outline",
  },
];

function getDistanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;

  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) *
      Math.sin(dLon / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * y;
}

export default function HomeScreen() {
  const {
    rideDraft,
    mapState,
    etaBadgeText,
    rideStatus,
    initializeRideBooking,
    setExternalRoute,
    driverHeading,
    driverRoutePoints,
    driverInfo,

    isSearchExpanded,
    searchResults,
    searchLoading,
    recentSearches,
    activeField,
    fromQuery,
    toQuery,
    setSearchField,
    updateQuery,
    selectSuggestion,
    clearField,
    swapPlaces,

    pickupDisplayText,
    destinationDisplayText,
    routeSummaryText,
  } = useRideBooking();

  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const leaveNotificationIdRef = useRef<string | null>(null);

  const TAB_BAR_TOTAL_SPACE = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 12;
  const sheetContentBottomPadding = TAB_BAR_TOTAL_SPACE + 34;

  const [showFloatingAiCard] = useState(true);
  const modeTransition = useRef(new Animated.Value(1)).current;

  const [selectedMode, setSelectedMode] = useState<TravelMode>("smart");
  const [selectedBus, setSelectedBus] = useState<LiveBus | null>(null);
  const [destination, setDestination] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [delayAlertsEnabled] = useState(false);
  const [homeLocation, setHomeLocation] = useState<string | null>(null);
  const [workLocation, setWorkLocation] = useState<string | null>(null);
  const [showRideSummary, setShowRideSummary] = useState(false);
  const [liveEtaSeconds, setLiveEtaSeconds] = useState<number | null>(null);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [startupReady, setStartupReady] = useState(false);

  const smartCardOpacity = useRef(new Animated.Value(0)).current;
  const smartCardTranslateY = useRef(new Animated.Value(18)).current;
  const driverCardOpacity = useRef(new Animated.Value(0)).current;
  const driverCardTranslateY = useRef(new Animated.Value(24)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const aiHudFloat = useRef(new Animated.Value(0)).current;

  const lastReroutePointRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const lastRerouteAtRef = useRef<number>(0);

  const polylineCoords = useMemo(() => {
    return rideDraft.route?.polyline ?? [];
  }, [rideDraft.route]);

  const initialRegion = useMemo(
    () => ({
      latitude: 55.7033,
      longitude: 21.1443,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    }),
    []
  );

  const currentSlide = onboardingSlides[onboardingStep];

  const { userLocation, weatherNow } = useWeather();
  const { notificationsReady } = useNotifications();

  const {
    liveBuses,
    isLoadingBuses,
    lastUpdate,
    usedCachedData,
    isBackendSleeping,
    busAnimationsRef,
    loadCachedBuses,
  } = useLiveBuses({
    initialDataLoaded,
    isPro,
    delayAlertsEnabled,
    notificationsReady,
    selectedBus,
    onSelectedBusUpdated: setSelectedBus,
  });

  const { translateY, animateSheet, panResponder } = useBottomSheet({
    sheetOpenY: SHEET_OPEN_Y,
    sheetMidY: SHEET_MID_Y,
    sheetClosedY: SHEET_CLOSED_Y,
    onSnapHaptic: async () => {
      try {
        await Haptics.selectionAsync();
      } catch {}
    },
  });

  const {
    showPaywall,
    showProSheet,
    paywallCopy,
    setShowPaywall,
    setShowProSheet,
    setPaywallSource,
    openProPaywall,
    closeAllPaywalls,
  } = usePaywall();

  const effectivePickupPlace = rideDraft.pickup
    ? {
        ...rideDraft.pickup,
        title: rideDraft.pickup.title ?? "",
        subtitle: rideDraft.pickup.subtitle ?? "",
      }
    : userLocation
    ? {
        id: "current-location",
        title: "Current location",
        subtitle: "Your live location",
        coordinate: userLocation,
      }
    : null;

  const {
    eta,
    bestBusId,
    routeCoords,
    selectedRecommendationId,
    recommendations,
    selectedRecommendation,
    setAiSuggestion,
    setEta,
    setSelectedRecommendationId,
    handleSmartRoute,
    getFinalMode,
    selectRecommendation,
  } = useSmartRoute({
    selectedMode,
    liveBuses,
    selectedBus,
    isPro,
    pickup: effectivePickupPlace,
    destinationPlace: rideDraft.destination
      ? {
          ...rideDraft.destination,
          title: rideDraft.destination.title ?? "",
          subtitle: rideDraft.destination.subtitle ?? "",
        }
      : null,
    setExternalRoute: (route) => {
      setExternalRoute(route?.polyline ?? []);
    },
  });

  const smartDestinationLabel =
    rideDraft.destination?.title ||
    rideDraft.destination?.subtitle ||
    destination;

  const tapHaptic = useCallback(async () => {
    try {
      await Haptics.selectionAsync();
    } catch {}
  }, []);

  const mediumHaptic = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  }, []);

  const successHaptic = useCallback(async () => {
    try {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    } catch {}
  }, []);

  const handleOpenProPaywall = useCallback(
    async (source: "smart_route" | "leave_alert" | "delay_alert" | "cta") => {
      await mediumHaptic();
      openProPaywall(source);
    },
    [mediumHaptic, openProPaywall]
  );

  const handleCloseAllPaywalls = useCallback(async () => {
    await tapHaptic();
    closeAllPaywalls();
  }, [tapHaptic, closeAllPaywalls]);

  const runSmartRoute = useCallback(async () => {
    try {
      await handleSmartRoute();
    } catch (error: any) {
      if (error?.message === "MISSING_USER_LOCATION") {
        Alert.alert("Trūksta lokacijos", "Leisk lokacijos prieigą.");
        return;
      }

      if (error?.message === "MISSING_DESTINATION") {
        Alert.alert("Įvesk vietą", "Pirmiausia pasirink kelionės tikslą.");
        return;
      }

      if (error?.message === "DESTINATION_NOT_FOUND") {
        Alert.alert("Nepavyko rasti vietos", "Patikrink įvestą adresą.");
        return;
      }

      Alert.alert("Klaida", "Nepavyko sugeneruoti Smart Route.");
    }
  }, [handleSmartRoute]);

  useUiAnimations({
    selectedMode,
    selectedRecommendationId,
    driverInfo,
    rideStatus,
    smartCardOpacity,
    smartCardTranslateY,
    driverCardOpacity,
    driverCardTranslateY,
    ctaPulse,
    aiHudFloat,
  });

  useHomeBootstrap({
    loadCachedBuses,
    setShowOnboarding,
    setHomeLocation,
    setWorkLocation,
    setInitialDataLoaded,
  });

  useProAccess({
    setIsPro,
  });

  const { requireProOrAlert } = useProGate({
    isPro,
    openPaywall: handleOpenProPaywall,
  });

  const { handleSaveHome, handleSaveWork } = useHomeActions({
    destination: smartDestinationLabel,
    setHomeLocation,
    setWorkLocation,
    tapHaptic,
  });

  const { handleNextOnboardingStep, handleSkipOnboarding } =
    useOnboardingActions({
      onboardingStep,
      onboardingSlidesLength: onboardingSlides.length,
      setOnboardingStep,
      setShowOnboarding,
      tapHaptic,
    });

  const {
    openBottomSheetForBus,
    selectSmartMode,
    selectTaxiMode,
    selectScooterMode,
    selectBusMode,
    selectTrainMode,
    selectAirportMode,
    quickSelectAirport,
    handleTransportResult,
  } = useTransportActions({
    destination: smartDestinationLabel,
    pickupLabel:
      rideDraft.pickup?.title ||
      rideDraft.pickup?.subtitle ||
      "Current location",
    destinationLabel:
      rideDraft.destination?.title ||
      rideDraft.destination?.subtitle ||
      smartDestinationLabel,
    pickupCoordinate: rideDraft.pickup?.coordinate ?? userLocation ?? null,
    destinationCoordinate: rideDraft.destination?.coordinate ?? null,
    eta,
    setDestination,
    setSelectedMode,
    setSelectedBus,
    setAiSuggestion,
    setEta,
    setSelectedRecommendationId,
    animateSheet,
    mediumHaptic,
    tapHaptic,
  });

  const { handlePrimaryAction } = usePrimaryAction({
    selectedMode,
    isPro,
    getFinalMode,
    mediumHaptic,
    runSmartRoute,
    animateSheet,
    handleOpenProPaywall,
    handleTransportResult,
  });

  const floatingAiCopy = getFloatingAiCopy({
    selectedMode,
    selectedBus,
    isPro,
  });

  const formatEtaCountdown = useCallback(
    (seconds: number | null) => {
      if (seconds == null) return etaBadgeText || "—";

      const safeSeconds = Math.max(0, seconds);
      const minutes = Math.floor(safeSeconds / 60);
      const remainingSeconds = safeSeconds % 60;

      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    },
    [etaBadgeText]
  );

  const {
    leaveAlertEnabled: realLeaveAlertEnabled,
    leaveAlertSummary,
    leaveAlertBusy,
    handleLeaveAlertPress,
  } = useLeaveAlert({
    isPro,
    userCoordinate: userLocation,
    pickupCoordinate: rideDraft.pickup?.coordinate ?? userLocation ?? null,
    destinationCoordinate: rideDraft.destination?.coordinate ?? null,
    pickupLabel:
      rideDraft.pickup?.title ||
      rideDraft.pickup?.subtitle ||
      pickupDisplayText,
    destinationLabel:
      rideDraft.destination?.title ||
      rideDraft.destination?.subtitle ||
      destinationDisplayText,
    routeEtaMinutes: eta ?? null,
    liveEtaSeconds,
    selectedBusId: selectedBus?.id ?? null,
    routeId: selectedBus?.number || null,
    onOpenPaywall: () => handleOpenProPaywall("leave_alert"),
  });

  useRideStatusEffects({
    rideStatus,
    etaBadgeText,
    driverInfo,
    mapRef,
    driverCoordinate: mapState.driverCoordinate,
    pickupCoordinate: mapState.pickupCoordinate,
    destinationCoordinate: mapState.destinationCoordinate,
    selectedBus,
    isPro,
    leaveAlertEnabled: realLeaveAlertEnabled,
    notificationsReady,
    leaveNotificationIdRef,
    setLiveEtaSeconds,
    setShowRideSummary,
  });

  const purchasePro = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();

      if (
        offerings.current &&
        offerings.current.availablePackages &&
        offerings.current.availablePackages.length > 0
      ) {
        const purchase = await Purchases.purchasePackage(
          offerings.current.availablePackages[0]
        );

        if (purchase.customerInfo.entitlements.active["pro"]) {
          setIsPro(true);
          setShowPaywall(false);
          setShowProSheet(false);
          setPaywallSource(null);
          await successHaptic();
        }
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        console.log("Purchase error:", e);
      }
    }
  }, [setShowPaywall, setShowProSheet, setPaywallSource, successHaptic]);

  const handleUnlockProDemo = useCallback(async () => {
    setIsPro(true);
    setShowPaywall(false);
    setShowProSheet(false);
    setPaywallSource(null);
    await successHaptic();
    Alert.alert("PRO", "PRO aktyvuotas demo režime.");
  }, [setShowPaywall, setShowProSheet, setPaywallSource, successHaptic]);

  const handleOpenAi = useCallback(() => {
    animateSheet(SHEET_MID_Y);
  }, [animateSheet]);

  const handleBusPress = useCallback(
    (bus: LiveBus) => {
      void openBottomSheetForBus(bus);
    },
    [openBottomSheetForBus]
  );

  const handleQuickHome = useCallback(async () => {
    await tapHaptic();

    if (!homeLocation) return;

    setDestination(homeLocation);
    setSearchField("to");

    setTimeout(() => {
      void updateQuery(homeLocation);
    }, 0);
  }, [homeLocation, tapHaptic, setSearchField, updateQuery]);

  const handleQuickWork = useCallback(async () => {
    await tapHaptic();

    if (!workLocation) return;

    setDestination(workLocation);
    setSearchField("to");

    setTimeout(() => {
      void updateQuery(workLocation);
    }, 0);
  }, [workLocation, tapHaptic, setSearchField, updateQuery]);

  const handleRefreshSmart = useCallback(async () => {
    await tapHaptic();

    if (selectedMode === "smart" && isPro) {
      await runSmartRoute();
    }
  }, [tapHaptic, selectedMode, isPro, runSmartRoute]);

  const handleOpenCtaPaywall = useCallback(async () => {
    await handleOpenProPaywall("cta");
  }, [handleOpenProPaywall]);

  const handleSelectSmartMode = useCallback(async () => {
    await selectSmartMode();

    const allowed = await requireProOrAlert(
      "smart_route",
      "Tik PRO nariams",
      "Smart Route yra Arbebus Pro funkcija."
    );

    if (!allowed) {
      return;
    }

    await runSmartRoute();
    animateSheet(SHEET_OPEN_Y);
  }, [selectSmartMode, requireProOrAlert, runSmartRoute, animateSheet]);

  useEffect(() => {
    initializeRideBooking();
  }, [initializeRideBooking]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStartupReady(true);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    if (!rideDraft.destination?.coordinate) return;
    if (!polylineCoords.length) return;

    const now = Date.now();
    const lastPoint = lastReroutePointRef.current;

    if (!lastPoint) {
      lastReroutePointRef.current = userLocation;
      lastRerouteAtRef.current = now;
      return;
    }

    const movedMeters = getDistanceMeters(lastPoint, userLocation);
    const enoughTimePassed = now - lastRerouteAtRef.current > 12000;

    if (movedMeters < 35 || !enoughTimePassed) {
      return;
    }

    lastReroutePointRef.current = userLocation;
    lastRerouteAtRef.current = now;

    if (
      selectedMode === "smart" ||
      selectedMode === "walk" ||
      selectedMode === "taxi" ||
      selectedMode === "bus" ||
      selectedMode === "train"
    ) {
      void runSmartRoute();
    }
  }, [
    userLocation,
    rideDraft.destination,
    polylineCoords,
    selectedMode,
    runSmartRoute,
  ]);

  if (!initialDataLoaded) {
    return <SafeAreaView style={styles.container} />;
  }

  if (showOnboarding) {
    return (
      <HomeOnboarding
        currentSlide={currentSlide}
        onboardingSlides={onboardingSlides}
        onboardingStep={onboardingStep}
        onNext={handleNextOnboardingStep}
        onSkip={handleSkipOnboarding}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        {startupReady ? (
          <HomeMapLayer
            mapRef={mapRef}
            initialRegion={initialRegion}
            userLocation={userLocation}
            mapState={mapState}
            driverHeading={driverHeading}
            driverRoutePoints={driverRoutePoints}
            polylineCoords={polylineCoords}
            routeCoords={routeCoords}
            rideStatus={rideStatus}
            liveBuses={liveBuses}
            busAnimationsRef={busAnimationsRef}
            bestBusId={bestBusId}
            onBusPress={handleBusPress}
            destinationTitle={
              rideDraft.destination?.title ||
              rideDraft.destination?.subtitle ||
              "Destination"
            }
            destinationSubtitle={rideDraft.destination?.subtitle}
          />
        ) : (
          <View style={styles.container} />
        )}

        <HomeTopHud
          weatherNow={weatherNow}
          tapHaptic={tapHaptic}
          onOpenAi={handleOpenAi}
        />

        <HomeCachedDataBadge visible={false} lastUpdate={lastUpdate} />

        <HomeBackendStatus visible={false} />

        <HomeLoadingOverlay
          visible={isLoadingBuses && liveBuses.length === 0}
          text="Kraunami live autobusai..."
        />

        <HomeEmptyState
          visible={
            !isLoadingBuses &&
            !isBackendSleeping &&
            initialDataLoaded &&
            liveBuses.length === 0
          }
        />

        <HomeBottomSheet
          translateY={translateY}
          panResponder={panResponder}
          sheetContentBottomPadding={sheetContentBottomPadding}
          smartCardOpacity={smartCardOpacity}
          smartCardTranslateY={smartCardTranslateY}
          ctaPulse={ctaPulse}
          selectedMode={selectedMode}
          eta={eta}
          isPro={isPro}
          rideStatus={rideStatus}
          liveEtaSeconds={liveEtaSeconds}
          getFinalMode={getFinalMode}
          formatEtaCountdown={formatEtaCountdown}
          selectedRecommendation={selectedRecommendation}
          recommendations={recommendations}
          selectedRecommendationId={selectedRecommendationId}
          onSelectRecommendation={selectRecommendation}
          homeLocation={homeLocation}
          workLocation={workLocation}
          selectedBus={selectedBus}
          pickupLabel={
            rideDraft.pickup?.title ||
            rideDraft.pickup?.subtitle ||
            pickupDisplayText
          }
          destinationLabel={
            rideDraft.destination?.title ||
            rideDraft.destination?.subtitle ||
            destinationDisplayText
          }
          routeSummaryText={
            (rideDraft.pickup || userLocation) && rideDraft.destination
              ? `${eta ?? 7} min • ${routeSummaryText}`
              : "Pasirink maršrutą"
          }
          onSelectSmart={handleSelectSmartMode}
          onSelectTaxi={selectTaxiMode}
          onSelectScooter={selectScooterMode}
          onSelectBus={selectBusMode}
          onSelectTrain={selectTrainMode}
          onSelectAirport={selectAirportMode}
          onQuickHome={handleQuickHome}
          onQuickWork={handleQuickWork}
          onQuickAirport={quickSelectAirport}
          onSaveHome={handleSaveHome}
          onSaveWork={handleSaveWork}
          onRefresh={handleRefreshSmart}
          onPrimaryAction={handlePrimaryAction}
          onOpenPro={handleOpenCtaPaywall}
          fromQuery={fromQuery}
          toQuery={toQuery}
          activeField={activeField ?? "to"}
          onFocusField={setSearchField}
          onChangeQuery={updateQuery}
          onSwap={swapPlaces}
          onClearField={clearField}
          searchResults={searchResults}
          searchLoading={searchLoading}
          isSearchExpanded={isSearchExpanded}
          onSelectSuggestion={selectSuggestion}
        />

        <HomePaywall
          visible={showPaywall || showProSheet}
          paywallCopy={paywallCopy}
          onPurchase={purchasePro}
          onDemoUnlock={handleUnlockProDemo}
          onClose={handleCloseAllPaywalls}
        />

        {showRideSummary ? null : null}
      </View>
    </SafeAreaView>
  );
}
