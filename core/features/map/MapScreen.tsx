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

function isRouteFlow(flowState: string) {
  return [
    "routes_loading",
    "route_options",
    "route_selected",
    "walking_to_stop",
    "waiting_bus",
    "onboard",
    "transfer",
    "arriving",
    "completed",
  ].includes(flowState);
}

function isActiveTrip(flowState: string) {
  return [
    "walking_to_stop",
    "waiting_bus",
    "onboard",
    "transfer",
    "arriving",
  ].includes(flowState);
}

function validPoints(points?: Array<{ latitude: number; longitude: number }>) {
  return (points || []).filter(
    (point) =>
      point &&
      Number.isFinite(Number(point.latitude)) &&
      Number.isFinite(Number(point.longitude))
  );
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const lastFollowAt = useRef(0);

  const { userLocation } = useUserLocation();
  const { buses } = useLiveBuses();
  const planner = useTransitPlanner(userLocation);

  const selectedRoute = planner.selectedRoute;
  const selectedDestination = planner.selectedDestination;

  const searchVisible =
    planner.flowState === "searching" &&
    !selectedRoute &&
    !isRouteFlow(planner.flowState);

  const selectedRouteLabel = selectedRoute?.routeLabel || null;

  const selectedVehicleId =
    selectedRoute?.liveVehicle?.vehicleId ||
    selectedRoute?.liveVehicle?.id ||
    null;

  const focusCoords = useMemo(() => {
    const coords: Array<{ latitude: number; longitude: number }> = [];

    const routeLine = validPoints(selectedRoute?.polyline);
    const routePreview = validPoints(selectedRoute?.previewPoints);

    if (routeLine.length >= 2) {
      coords.push(...routeLine);
    } else if (routePreview.length >= 2) {
      coords.push(...routePreview);
    } else {
      if (userLocation) coords.push(userLocation);
      if (selectedDestination?.coordinate) coords.push(selectedDestination.coordinate);
    }

    return validPoints(coords);
  }, [selectedDestination, selectedRoute, userLocation]);

  useEffect(() => {
    if (!mapRef.current || focusCoords.length < 2) return;
    if (isActiveTrip(planner.flowState)) return;

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(focusCoords, {
        edgePadding: {
          top: 150,
          right: 55,
          bottom: selectedRoute ? 430 : 320,
          left: 55,
        },
        animated: true,
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [focusCoords, planner.flowState, selectedRoute]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    if (!isActiveTrip(planner.flowState)) return;

    const now = Date.now();
    if (now - lastFollowAt.current < 2500) return;
    lastFollowAt.current = now;

    mapRef.current.animateCamera(
      {
        center: userLocation,
        zoom: planner.flowState === "onboard" ? 15.5 : 16.3,
        pitch: 45,
        heading: 0,
      },
      { duration: 850 }
    );
  }, [planner.flowState, userLocation]);

  return (
    <View style={styles.screen}>
      <MapCanvas ref={mapRef} onPress={() => Keyboard.dismiss()}>
        <UserLocationLayer coordinate={userLocation} />

        <RoutePolylineLayer route={selectedRoute} />

        <WalkingPolylineLayer route={selectedRoute} userLocation={userLocation} />

        <StopsLayer route={selectedRoute} />

        <LiveBusesLayer
          buses={buses}
          selectedRouteLabel={selectedRouteLabel}
          selectedVehicleId={selectedVehicleId}
        />

        <DestinationMarkerLayer destination={selectedDestination} />
      </MapCanvas>

      <TopSearchBar
        value={planner.query}
        isSearching={planner.isSearching}
        onChangeText={(text) => {
          planner.setQuery(text);

          if (text.trim().length >= 2) {
            void planner.runSearch(text);
          }
        }}
        onSubmit={() => {
          void planner.runSearch();
        }}
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
        selectedRoute={selectedRoute}
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
  screen: {
    flex: 1,
    backgroundColor: "#05070D",
  },
});