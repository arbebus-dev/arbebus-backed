import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { useLiveBuses } from "../transit/hooks/useLiveBuses";
import { useTransitPlanner } from "../transit/hooks/useTransitPlanner";
import { useUserLocation } from "../transit/hooks/useUserLocation";
import {
  fetchStationAccess,
  reverseGeocodePlace,
  type StationAccessPoint,
} from "../transit/services/transitApi";

import JourneySheet from "./JourneySheet";
import DestinationMarkerLayer from "./layers/DestinationMarkerLayer";
import LiveBusesLayer from "./layers/LiveBusesLayer";
import RoutePolylineLayer from "./layers/RoutePolylineLayer";
import StopsLayer from "./layers/StopsLayer";
import StationAccessLayer from "./layers/StationAccessLayer";
import UserLocationLayer from "./layers/UserLocationLayer";
import WalkingPolylineLayer from "./layers/WalkingPolylineLayer";
import MapCanvas from "./MapCanvas";

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

function normalizeId(value: any) {
  return String(value ?? "").trim();
}

function normalizeRouteNumber(value: any) {
  return String(value ?? "")
    .trim()
    .split("•")[0]
    .split(" ")[0]
    .replace(/^0+/, "")
    .toUpperCase();
}

function normalizeVehiclePoint(vehicle: any): MapPoint | null {
  const latitude = Number(vehicle?.latitude ?? vehicle?.coordinate?.latitude);
  const longitude = Number(vehicle?.longitude ?? vehicle?.coordinate?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

function distanceMeters(a: MapPoint, b: MapPoint) {
  const dx = (a.latitude - b.latitude) * 111320;
  const dy =
    (a.longitude - b.longitude) *
    40075000 *
    Math.cos((a.latitude * Math.PI) / 180) /
    360;

  return Math.sqrt(dx * dx + dy * dy);
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
  const lastCameraTarget = useRef<MapPoint | null>(null);

  const { userLocation } = useUserLocation();
  const { buses } = useLiveBuses();
  const planner = useTransitPlanner(userLocation);

  const selectedRoute = planner.selectedRoute;
  const selectedDestination = planner.selectedDestination;
  const [stationAccessPoints, setStationAccessPoints] = useState<StationAccessPoint[]>([]);
  const [selectedMapPlace, setSelectedMapPlace] = useState<any | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const stopId =
      selectedRoute?.originStop?.id ||
      selectedRoute?.originStop?.stopId ||
      selectedRoute?.destinationStop?.id ||
      selectedRoute?.destinationStop?.stopId ||
      null;

    if (!stopId) {
      setStationAccessPoints([]);
      return;
    }

    fetchStationAccess(stopId)
      .then((items) => {
        if (!cancelled) setStationAccessPoints(items);
      })
      .catch(() => {
        if (!cancelled) setStationAccessPoints([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRoute?.originStop?.id, selectedRoute?.originStop?.stopId, selectedRoute?.destinationStop?.id, selectedRoute?.destinationStop?.stopId]);

  const selectedRouteLabel = selectedRoute?.routeLabel || null;

  const selectedRouteNumber = useMemo(() => {
    return normalizeRouteNumber(
      selectedRoute?.routeNumbers?.[0] ??
        selectedRoute?.routeId ??
        selectedRoute?.routeLabel
    );
  }, [selectedRoute]);

  const selectedLiveBus = useMemo(() => {
    if (!selectedRoute) return null;

    const liveVehicle = selectedRoute.liveVehicle;
    const liveVehicleId = normalizeId(
      liveVehicle?.vehicleId || liveVehicle?.id || liveVehicle?.vehicleLabel
    );
    const liveVehiclePoint = normalizeVehiclePoint(liveVehicle);

    if (liveVehicleId) {
      const exact = buses.find((bus) => {
        const ids = [bus.vehicleId, bus.id, bus.vehicleLabel].map(normalizeId);
        return ids.includes(liveVehicleId);
      });

      if (exact) return exact;
    }

    if (liveVehiclePoint) {
      const closestByPoint = buses
        .map((bus) => {
          const point = normalizeVehiclePoint(bus);
          if (!point) return null;
          return { bus, distance: distanceMeters(point, liveVehiclePoint) };
        })
        .filter(Boolean) as Array<{
        bus: (typeof buses)[number];
        distance: number;
      }>;

      closestByPoint.sort((a, b) => a.distance - b.distance);

      if (closestByPoint[0] && closestByPoint[0].distance <= 120) {
        return closestByPoint[0].bus;
      }
    }

    if (!selectedRouteNumber) return null;

    const originPoint = selectedRoute.originStop?.coordinate;

    const candidates = buses
      .filter((bus) => {
        const number = normalizeRouteNumber(bus.routeId || bus.route || bus.number);
        return number === selectedRouteNumber;
      })
      .map((bus) => {
        const point = normalizeVehiclePoint(bus);
        const distance =
          point && originPoint
            ? distanceMeters(point, originPoint)
            : Number.POSITIVE_INFINITY;
        const delay = Number(bus.delaySeconds || 0);
        const speed = Number(bus.speedKph || 0);
        const score = distance + Math.max(0, delay) * 0.2 - Math.min(speed, 60) * 3;

        return { bus, score };
      })
      .sort((a, b) => a.score - b.score);

    return candidates[0]?.bus ?? null;
  }, [buses, selectedRoute, selectedRouteNumber]);

  const selectedVehicleId =
    selectedLiveBus?.vehicleId ||
    selectedLiveBus?.id ||
    selectedLiveBus?.vehicleLabel ||
    selectedRoute?.liveVehicle?.vehicleId ||
    selectedRoute?.liveVehicle?.id ||
    selectedRoute?.liveVehicle?.vehicleLabel ||
    null;

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
    // PRO FIX: do not auto zoom out after route selection.
    // User keeps full manual control over map zoom/pan like Apple Maps.
    // Route fitting can be re-enabled later only from an explicit user button.
    return;
  }, [focusCoords, planner.flowState, selectedRoute]);

  useEffect(() => {
    // PRO FIX: automatic follow camera is disabled by default.
    // This prevents unwanted zoom-out/zoom-in while the user explores the map.
    // Keep manual gestures stable during TestFlight QA.
    return;
  }, [activeCameraTarget, planner.flowState, selectedLiveBus]);


  const handleMapPress = async (event: any) => {
    Keyboard.dismiss();

    const coordinate = event?.nativeEvent?.coordinate;
    const latitude = Number(coordinate?.latitude);
    const longitude = Number(coordinate?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const provisional = {
      id: `map-${latitude.toFixed(6)}-${longitude.toFixed(6)}`,
      type: "address",
      title: "Pasirinkta vieta",
      subtitle: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      latitude,
      longitude,
      coordinate: { latitude, longitude },
      source: "map_tap",
    };

    setSelectedMapPlace(provisional);
    setIsReverseGeocoding(true);

    try {
      const place = await reverseGeocodePlace({ latitude, longitude });
      setSelectedMapPlace({ ...provisional, ...place, coordinate: place.coordinate || provisional.coordinate });
    } catch {
      setSelectedMapPlace(provisional);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  return (
    <View style={styles.screen}>
      <MapCanvas ref={mapRef} onPress={handleMapPress}>
        <UserLocationLayer coordinate={userLocation} />

        <RoutePolylineLayer
          route={selectedRoute}
          flowState={planner.flowState}
          currentStepIndex={planner.currentStepIndex}
        />

        <WalkingPolylineLayer route={selectedRoute} userLocation={userLocation} />

        <StopsLayer route={selectedRoute} flowState={planner.flowState} />

        <StationAccessLayer accessPoints={stationAccessPoints} selectedStopId={selectedRoute?.originStop?.id || null} />

        <LiveBusesLayer
          buses={buses}
          selectedRouteLabel={selectedRouteLabel}
          selectedVehicleId={selectedVehicleId}
        />

        {selectedMapPlace?.coordinate ? (
          <Marker
            coordinate={selectedMapPlace.coordinate}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={styles.mapTapMarker}>
              <View style={styles.mapTapMarkerInner} />
            </View>
          </Marker>
        ) : null}

        <DestinationMarkerLayer destination={selectedDestination} />
      </MapCanvas>

      <JourneySheet
        flowState={planner.flowState}
        liveBusCount={buses.length}
        query={planner.query}
        searchResults={planner.searchResults}
        isSearching={planner.isSearching}
        isPlanning={planner.isPlanning}
        routeOptions={planner.routeOptions}
        selectedRoute={selectedRoute}
        selectedOrigin={planner.selectedOrigin}
        selectedDestination={planner.selectedDestination}
        selectedMapPlace={selectedMapPlace}
        isReverseGeocoding={isReverseGeocoding}
        error={planner.error}
        isOffline={planner.isOffline}
        offlineMessage={planner.offlineMessage}
        isRerouting={planner.isRerouting}
        reroutingMessage={planner.reroutingMessage}
        onChangeQuery={(text) => {
          planner.setQuery(text);
          if (text.trim().length >= 2) {
            void planner.runSearch(text);
          }
        }}
        onSubmitSearch={() => {
          void planner.runSearch();
        }}
        onSelectDestination={(item) => {
          Keyboard.dismiss();
          setSelectedMapPlace(null);
          void planner.selectDestination(item);
        }}
        onSelectOrigin={(item) => {
          Keyboard.dismiss();
          setSelectedMapPlace(null);
          planner.selectOrigin(item);
        }}
        onClearOrigin={planner.clearOrigin}
        onClearMapPlace={() => setSelectedMapPlace(null)}
        onUseMapPlaceAsOrigin={(place) => {
          Keyboard.dismiss();
          planner.selectOrigin(place);
          setSelectedMapPlace(null);
        }}
        onUseMapPlaceAsDestination={(place) => {
          Keyboard.dismiss();
          setSelectedMapPlace(null);
          void planner.selectDestination(place);
        }}
        onChooseRoute={planner.chooseRoute}
        onStartJourney={planner.startJourney}
        onNextStep={planner.nextStep}
        onBackToRoutes={planner.backToRoutesList}
        onBackToSearch={planner.backToSearch}
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
  mapTapMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(52,245,179,0.25)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.92)",
  },
  mapTapMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#34F5B3",
  },
});