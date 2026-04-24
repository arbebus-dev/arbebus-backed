import React, { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView from "react-native-maps";

import { useRideBooking } from "../rideBooking/hooks/useRideBooking";
import { useSmartRoute } from "../../../hooks/useSmartRoute";
import { useLiveBuses } from "../../../hooks/useLiveBuses";
import { useWeather } from "../../../hooks/useWeather";
import type { TravelMode } from "../../../types/home";
import { useMapViewport } from "./hooks/useMapViewport";
import { useMapScreenController } from "./hooks/useMapScreenController";
import MapCanvas from "./layers/MapCanvas";
import TransitMarkersLayer from "./layers/TransitMarkersLayer";
import ActiveTripLayer from "./layers/ActiveTripLayer";
import TopSearchBar from "./ui/TopSearchBar";
import FloatingControls from "./ui/FloatingControls";
import JourneySheet from "./ui/JourneySheet";

export default function MapScreenShell() {
  const mapRef = useRef<MapView | null>(null);
  const [selectedMode, setSelectedMode] = useState<TravelMode>("smart");

  const rideBooking = useRideBooking();
  const { userLocation, requestLocation } = useWeather();

  const { liveBuses } = useLiveBuses({
    initialDataLoaded: true,
    isPro: false,
    delayAlertsEnabled: false,
    notificationsReady: false,
    selectedBus: null,
  });

  const smartRoute = useSmartRoute({
    selectedMode,
    liveBuses,
    selectedBus: null,
    isPro: false,
    pickup: rideBooking.rideDraft.pickup,
    destinationPlace: rideBooking.rideDraft.destination,
    setExternalRoute: rideBooking.setExternalRoute,
  });

  const controller = useMapScreenController({
    useRideBookingResult: rideBooking,
    userLocation: userLocation ?? null,
    handleSmartRoute: smartRoute.handleSmartRoute,
    selectedMode,
    transitPlan: smartRoute.transitPlan,
  });

  const rideUi = controller.rideUi;
  const { initialRegion } = useMapViewport({
    mapRef,
    mapState: rideBooking.mapState,
    routeCoords: smartRoute.routeCoords,
    transitPlan: smartRoute.transitPlan,
    rideUiStatus: rideUi.status,
  });

  const onLocate = useCallback(async () => {
    const resolvedLocation =
      userLocation ||
      rideBooking.mapState.userCoordinate ||
      rideBooking.mapState.pickupCoordinate ||
      (await requestLocation());

    if (!resolvedLocation) {
      Alert.alert(
        "Lokacija nepasiekiama",
        "Leisk lokacijos prieigą, kad Arbebus galėtų parodyti tavo vietą žemėlapyje."
      );
      return;
    }

    if (!mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        ...resolvedLocation,
        latitudeDelta: 0.022,
        longitudeDelta: 0.022,
      },
      500
    );
  }, [rideBooking.mapState.pickupCoordinate, rideBooking.mapState.userCoordinate, requestLocation, userLocation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F6FB" }} edges={["top"]}>
      <StatusBar style="dark" />

      <MapCanvas mapRef={mapRef} initialRegion={initialRegion} userLocation={userLocation || rideBooking.mapState.userCoordinate}>
        <TransitMarkersLayer
          liveBuses={liveBuses}
          bestBusId={smartRoute.bestBusId}
          activeTrip={Boolean(smartRoute.transitPlan)}
          onBusPress={() => setSelectedMode("bus")}
        />

        <ActiveTripLayer
          transitPlan={smartRoute.transitPlan}
          fallbackRoute={smartRoute.routeCoords}
          pickupCoordinate={rideBooking.mapState.pickupCoordinate}
          destinationCoordinate={rideBooking.mapState.destinationCoordinate}
        />
      </MapCanvas>

      <TopSearchBar
        fromQuery={rideBooking.fromQuery}
        toQuery={rideBooking.toQuery}
        activeField={rideBooking.activeField}
        onFocusField={rideBooking.setSearchField}
        onChangeQuery={rideBooking.updateQuery}
        onSwap={rideBooking.swapPlaces}
        onClearField={rideBooking.clearField}
      />

      <FloatingControls selectedMode={selectedMode} onSelectMode={setSelectedMode} onLocate={onLocate} />

      <JourneySheet
        rideUiStatus={rideUi.status}
        ctaLabel={rideUi.ctaLabel}
        favorites={controller.favorites}
        onPressFavorite={controller.onPressFavorite}
        searchLoading={rideBooking.searchLoading}
        searchResults={rideBooking.searchResults as any}
        onSelectSuggestion={rideBooking.selectSuggestion}
        recommendations={smartRoute.recommendations}
        selectedRecommendationId={smartRoute.selectedRecommendationId}
        selectedRecommendation={smartRoute.selectedRecommendation}
        transitPlan={smartRoute.transitPlan}
        onSelectRecommendation={smartRoute.selectRecommendation}
        onSaveFavorite={controller.onSaveFavorite}
      />
    </SafeAreaView>
  );
}
