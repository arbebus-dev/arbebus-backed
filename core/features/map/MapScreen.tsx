import React, { useEffect, useMemo, useRef } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import { useLiveBuses } from "../transit/hooks/useLiveBuses";
import { useTransitPlanner } from "../transit/hooks/useTransitPlanner";
import { useUserLocation } from "../transit/hooks/useUserLocation";
import JourneySheet from "./JourneySheet";
import DestinationMarkerLayer from "./layers/DestinationMarkerLayer";
import LiveBusesLayer from "./layers/LiveBusesLayer";
import RoutePolylineLayer from "./layers/RoutePolylineLayer";
import StopsLayer from "./layers/StopsLayer";
import UserLocationLayer from "./layers/UserLocationLayer";
import WalkingPolylineLayer from "./layers/WalkingPolylineLayer";
import MapCanvas from "./MapCanvas";
import SearchResultsSheet from "./SearchResultsSheet";
import TopSearchBar from "./TopSearchBar";



export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const { userLocation } = useUserLocation();
  const { buses } = useLiveBuses();
  const planner = useTransitPlanner(userLocation);

  const searchVisible = planner.flowState === "searching";
  const selectedRouteLabel = planner.selectedRoute?.routeLabel || null;

  const focusCoords = useMemo(() => {
    const coords: Array<{ latitude: number; longitude: number }> = [];
    if (userLocation) coords.push(userLocation);
    if (planner.selectedDestination) coords.push(planner.selectedDestination.coordinate);
    if (planner.selectedRoute?.previewPoints?.length) coords.push(...planner.selectedRoute.previewPoints);
    return coords;
  }, [planner.selectedDestination, planner.selectedRoute, userLocation]);

  useEffect(() => {
    if (focusCoords.length < 2 || !mapRef.current) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(focusCoords, {
        edgePadding: { top: 150, right: 60, bottom: 320, left: 60 },
        animated: true,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [focusCoords]);

  return (
    <View style={styles.screen}>
      <MapCanvas ref={mapRef} onPress={() => Keyboard.dismiss()}>
        <UserLocationLayer coordinate={userLocation} />
        <LiveBusesLayer
          buses={buses}
          selectedRouteLabel={selectedRouteLabel}
        />
        <DestinationMarkerLayer destination={planner.selectedDestination} />
        <WalkingPolylineLayer route={planner.selectedRoute} userLocation={userLocation} />
        <RoutePolylineLayer route={planner.selectedRoute} />
        <StopsLayer route={planner.selectedRoute} />
      </MapCanvas>

      <TopSearchBar
        value={planner.query}
        isSearching={planner.isSearching}
        onChangeText={(text) => {
          planner.setQuery(text);
          if (text.trim().length >= 2) void planner.runSearch(text);
        }}
        onSubmit={() => planner.runSearch()}
        onClear={planner.resetPlanner}
      />

      <SearchResultsSheet
        visible={searchVisible}
        results={planner.searchResults}
        isLoading={planner.isSearching}
        error={planner.flowState === "searching" ? planner.error : null}
        onSelect={(item) => {
          Keyboard.dismiss();
          void planner.selectDestination(item);
        }}
      />

      <JourneySheet
        flowState={planner.flowState}
        liveBusCount={buses.length}
        routeOptions={planner.routeOptions}
        selectedRoute={planner.selectedRoute}
        error={planner.flowState !== "searching" ? planner.error : null}
        onChooseRoute={planner.chooseRoute}
        onStartJourney={planner.startJourney}
        onNextStep={planner.nextStep}
        onReset={planner.resetPlanner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#05070D" },
});
