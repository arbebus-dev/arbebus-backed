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

type MapPoint = {
  latitude: number;
  longitude: number;
};

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

function validPoints(points?: MapPoint[]) {
  return (points || []).filter(
    (point) =>
      point &&
      Number.isFinite(Number(point.latitude)) &&
      Number.isFinite(Number(point.longitude))
  );
}

function normalizeVehiclePoint(vehicle: any): MapPoint | null {
  const latitude = Number(vehicle?.latitude ?? vehicle?.coordinate?.latitude);
  const longitude = Number(vehicle?.longitude ?? vehicle?.coordinate?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

function cameraForFlow(flowState: string) {
  switch (flowState) {
    case "walking_to_stop":
      return { zoom: 17.1, pitch: 50 };
    case "waiting_bus":
      return { zoom: 16.6, pitch: 45 };
    case "onboard":
      return { zoom: 15.8, pitch: 52 };
    case "transfer":
      return { zoom: 16.5, pitch: 48 };
    case "arriving":
      return { zoom: 17.2, pitch: 50 };
    default:
      return { zoom: 16.2, pitch: 45 };
  }
}

function averagePoint(points: MapPoint[]): MapPoint | null {
  const valid = validPoints(points);
  if (!valid.length) return null;

  const sum = valid.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: sum.latitude / valid.length,
    longitude: sum.longitude / valid.length,
  };
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

  const selectedLiveBus = useMemo(() => {
    if (!selectedVehicleId) return null;

    return (
      buses.find((bus) => {
        const busVehicleId = bus.vehicleId || bus.id;
        return String(busVehicleId) === String(selectedVehicleId);
      }) || null
    );
  }, [buses, selectedVehicleId]);

  const selectedVehicleCoordinate = useMemo(() => {
    return normalizeVehiclePoint(selectedLiveBus) ?? normalizeVehiclePoint(selectedRoute?.liveVehicle);
  }, [selectedLiveBus, selectedRoute]);

  const activeCameraTarget = useMemo(() => {
    if (!selectedRoute) return userLocation;

    if (planner.flowState === "onboard" && selectedVehicleCoordinate) {
      return selectedVehicleCoordinate;
    }

    if (planner.flowState === "waiting_bus") {
      return selectedRoute.originStop?.coordinate ?? userLocation;
    }

    if (planner.flowState === "arriving") {
      return selectedRoute.destinationStop?.coordinate ?? userLocation;
    }

    if (planner.flowState === "transfer") {
      const steps = selectedRoute.journeySteps || selectedRoute.steps || [];
      const current = steps[planner.currentStepIndex];
      const point = averagePoint(current?.polyline || []);
      return point ?? userLocation;
    }

    return userLocation;
  }, [
    planner.currentStepIndex,
    planner.flowState,
    selectedRoute,
    selectedVehicleCoordinate,
    userLocation,
  ]);

  const focusCoords = useMemo(() => {
    const coords: MapPoint[] = [];

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
    if (!mapRef.current) return;
    if (!isActiveTrip(planner.flowState)) return;
    if (!activeCameraTarget) return;

    const now = Date.now();
    if (now - lastFollowAt.current < 2200) return;
    lastFollowAt.current = now;

    const camera = cameraForFlow(planner.flowState);

    mapRef.current.animateCamera(
      {
        center: activeCameraTarget,
        zoom: camera.zoom,
        pitch: camera.pitch,
        heading: 0,
      },
      { duration: 850 }
    );
  }, [activeCameraTarget, planner.flowState]);

  return (
    <View style={styles.screen}>
      <MapCanvas ref={mapRef} onPress={() => Keyboard.dismiss()}>
        <UserLocationLayer coordinate={userLocation} />

        <RoutePolylineLayer
          route={selectedRoute}
          flowState={planner.flowState}
          currentStepIndex={planner.currentStepIndex}
        />

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