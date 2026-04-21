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
} from "../../constants/home";
import { useRideBooking } from "../../core/features/rideBooking/hooks/useRideBooking";
import { useBottomSheet } from "../../hooks/useBottomSheet";
import { useHomeActions } from "../../hooks/useHomeActions";
import { useHomeBootstrap } from "../../hooks/useHomeBootstrap";
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
  } = useRideBooking();

  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const leaveNotificationIdRef = useRef<string | null>(null);

  const TAB_BAR_HEIGHT = 72;
  const TAB_BAR_BOTTOM = 10;
  const TAB_BAR_TOTAL_SPACE = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 12;
  const sheetContentBottomPadding = TAB_BAR_TOTAL_SPACE + 140;

  const [showFloatingAiCard] = useState(true);
  const modeTransition = useRef(new Animated.Value(1)).current;

  const [selectedMode, setSelectedMode] = useState<TravelMode>("smart");
  const [selectedBus, setSelectedBus] = useState<LiveBus | null>(null);
  const [destination, setDestination] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [leaveAlertEnabled] = useState(false);
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

  const {
    eta,
    bestBusId,
    routeCoords,
    selectedRecommendationId,
    selectedRecommendation,
    setAiSuggestion,
    setEta,
    setSelectedRecommendationId,
    handleSmartRoute,
    getFinalMode,
  } = useSmartRoute({
    selectedMode,
    liveBuses,
    selectedBus,
    isPro,
    userLocation,
    destination,
    setExternalRoute,
  });

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
        Alert.alert("Įvesk vietą", "Pirmiausia įrašyk adresą arba tikslą.");
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

  useRideStatusEffects({
    rideStatus,
    etaBadgeText,
    driverInfo,
    mapRef,
    driverCoordinate: mapState.driverCoordinate,
    selectedBus,
    isPro,
    leaveAlertEnabled,
    notificationsReady,
    leaveNotificationIdRef,
    setLiveEtaSeconds,
    setShowRideSummary,
  });

  const { requireProOrAlert } = useProGate({
    isPro,
    openPaywall: handleOpenProPaywall,
  });

  const { handleSaveHome, handleSaveWork } = useHomeActions({
    destination,
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
    destination,
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

  const handleOpenMenu = useCallback(() => {
    router.push("/menu");
  }, [router]);

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
    if (homeLocation) setDestination(homeLocation);
  }, [homeLocation, tapHaptic]);

  const handleQuickWork = useCallback(async () => {
    await tapHaptic();
    if (workLocation) setDestination(workLocation);
  }, [workLocation, tapHaptic]);

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
          />
        ) : (
          <View style={styles.container} />
        )}

        <HomeTopHud
          showFloatingAiCard={showFloatingAiCard}
          selectedMode={selectedMode}
          floatingAiCopy={floatingAiCopy}
          smartCardTranslateY={smartCardTranslateY}
          modeTransition={modeTransition}
          weatherNow={weatherNow}
          tapHaptic={tapHaptic}
          onOpenMenu={handleOpenMenu}
          onOpenAi={handleOpenAi}
        />

        <HomeCachedDataBadge
          visible={usedCachedData}
          lastUpdate={lastUpdate}
        />

        <HomeBackendStatus visible={isBackendSleeping} />

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
          homeLocation={homeLocation}
          workLocation={workLocation}
          selectedBus={selectedBus}
          tapHaptic={tapHaptic}
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