import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLiveBuses } from "../transit/hooks/useLiveBuses";
import { useTransitPlanner } from "../transit/hooks/useTransitPlanner";
import { useUserLocation } from "../transit/hooks/useUserLocation";
import type { Coordinate } from "../transit/models/transitRoute";
import DestinationMarkerLayer from "./layers/DestinationMarkerLayer";
import LiveBusesLayer from "./layers/LiveBusesLayer";
import RoutePolylineLayer from "./layers/RoutePolylineLayer";
import StopsLayer from "./layers/StopsLayer";
import UserLocationLayer from "./layers/UserLocationLayer";
import WalkingPolylineLayer from "./layers/WalkingPolylineLayer";
import JourneySheet from "./JourneySheet";
import MapCanvas from "./MapCanvas";
import SearchResultsSheet from "./SearchResultsSheet";
import TopSearchBar from "./TopSearchBar";

const KLAIPEDA_REGION: Region = {
  latitude: 55.7033,
  longitude: 21.1443,
  latitudeDelta: 0.075,
  longitudeDelta: 0.075,
};

function regionFromCoordinate(coordinate: Coordinate, delta = 0.03): Region {
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const { location, requestLocation } = useUserLocation();
  const { buses } = useLiveBuses();
  const planner = useTransitPlanner(location);

  const initialRegion = useMemo(() => (location ? regionFromCoordinate(location, 0.04) : KLAIPEDA_REGION), [location]);
  const searchVisible = planner.flowState === "searching";

  useEffect(() => {
    if (!location || !mapRef.current || planner.selectedRoute) return;
    mapRef.current.animateToRegion(regionFromCoordinate(location, 0.04), 500);
  }, [location, planner.selectedRoute]);

  useEffect(() => {
    const coordinates = planner.selectedRoute?.polyline ?? [];
    if (!mapRef.current || coordinates.length < 2) return;

    mapRef.current.fitToCoordinates(coordinates, {
      animated: true,
      edgePadding: { top: 140, right: 52, bottom: 330, left: 52 },
    });
  }, [planner.selectedRoute]);

  useEffect(() => {
    if (!planner.selectedDestination || !mapRef.current || planner.selectedRoute) return;
    mapRef.current.animateToRegion(regionFromCoordinate(planner.selectedDestination.coordinate, 0.025), 500);
  }, [planner.selectedDestination, planner.selectedRoute]);

  const handleLocate = useCallback(async () => {
    const current = location ?? (await requestLocation());
    if (!current || !mapRef.current) return;
    mapRef.current.animateToRegion(regionFromCoordinate(current, 0.035), 500);
  }, [location, requestLocation]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <MapCanvas ref={mapRef} initialRegion={initialRegion}>
        <RoutePolylineLayer route={planner.selectedRoute} />
        <WalkingPolylineLayer step={planner.activeStep} />
        <StopsLayer stops={planner.results} selectedStop={planner.selectedDestination} />
        <DestinationMarkerLayer destination={planner.selectedDestination} />
        <LiveBusesLayer buses={buses} />
        <UserLocationLayer coordinate={location} />
      </MapCanvas>

      <TopSearchBar
        query={planner.query}
        flowState={planner.flowState}
        isSearching={planner.isSearching}
        onChangeQuery={planner.search}
        onClear={planner.clear}
      />

      <Pressable onPress={handleLocate} style={styles.locateButton}>
        <Ionicons name="locate" color="#69E1FF" size={23} />
      </Pressable>

      <View style={styles.busOnlyPill}>
        <Text style={styles.busOnlyText}>BUS ONLY</Text>
      </View>

      <SearchResultsSheet
        visible={searchVisible}
        results={planner.results}
        isSearching={planner.isSearching}
        query={planner.query}
        onSelect={planner.selectDestination}
      />

      {!searchVisible ? (
        <JourneySheet
          flowState={planner.flowState}
          isPlanning={planner.isPlanning}
          error={planner.error}
          selectedDestination={planner.selectedDestination}
          selectedRoute={planner.selectedRoute}
          routes={planner.plan?.routes ?? []}
          selectedRouteId={planner.selectedRouteId}
          activeStep={planner.activeStep}
          liveBusCount={buses.length}
          onSelectRoute={planner.setSelectedRouteId}
          onStartRoute={planner.startRoute}
          onNextStep={planner.nextStep}
          onClear={planner.clear}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#05070D" },
  locateButton: {
    position: "absolute",
    right: 16,
    top: 126,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(6,10,20,0.94)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18,
  },
  busOnlyPill: {
    position: "absolute",
    left: 16,
    top: 126,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 17,
    backgroundColor: "rgba(6,10,20,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  busOnlyText: { color: "#69E1FF", fontWeight: "900", fontSize: 12 },
});
