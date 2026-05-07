import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";

import { useLiveBuses } from "../transit/hooks/useLiveBuses";
import { useTransitPlanner } from "../transit/hooks/useTransitPlanner";
import { useUserLocation } from "../transit/hooks/useUserLocation";
import {
  fetchPlaceDetails,
  fetchStationAccess,
  reverseGeocodePlace,
  searchPlaces,
  type StationAccessPoint,
} from "../transit/services/transitApi";

import JourneySheet from "./JourneySheet";
import DestinationMarkerLayer from "./layers/DestinationMarkerLayer";
import LiveBusesLayer from "./layers/LiveBusesLayer";
import RoutePolylineLayer from "./layers/RoutePolylineLayer";
import StationAccessLayer from "./layers/StationAccessLayer";
import StopsLayer from "./layers/StopsLayer";
import UserLocationLayer from "./layers/UserLocationLayer";
import WalkingPolylineLayer from "./layers/WalkingPolylineLayer";
import MapCanvas from "./MapCanvas";

type MapPoint = {
  latitude: number;
  longitude: number;
};

type AnyRecord = Record<string, any>;

function validPoints(points?: MapPoint[] | null) {
  return (points || []).filter(
    (point) =>
      point &&
      Number.isFinite(Number(point.latitude)) &&
      Number.isFinite(Number(point.longitude)),
  );
}

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeRouteNumber(value: unknown) {
  return String(value ?? "")
    .trim()
    .split("•")[0]
    .split(" ")[0]
    .replace(/^0+/, "")
    .toUpperCase();
}

function normalizeVehiclePoint(vehicle: unknown): MapPoint | null {
  const item = vehicle as AnyRecord | null | undefined;

  const latitude = Number(item?.latitude ?? item?.coordinate?.latitude);
  const longitude = Number(item?.longitude ?? item?.coordinate?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

function distanceMeters(a: MapPoint, b: MapPoint) {
  const dx = (a.latitude - b.latitude) * 111320;
  const dy =
    ((a.longitude - b.longitude) *
      40075000 *
      Math.cos((a.latitude * Math.PI) / 180)) /
    360;

  return Math.sqrt(dx * dx + dy * dy);
}

function averagePoint(points: MapPoint[]): MapPoint | null {
  const valid = validPoints(points);
  if (!valid.length) return null;

  const sum = valid.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: sum.latitude / valid.length,
    longitude: sum.longitude / valid.length,
  };
}

function placeFromMapData(input: AnyRecord | null | undefined) {
  const latitude = Number(input?.latitude ?? input?.coordinate?.latitude);
  const longitude = Number(input?.longitude ?? input?.coordinate?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const placeId =
    input?.placeId ??
    input?.googlePlaceId ??
    (input?.source === "google_places" ? input?.id : undefined);

  return {
    ...input,
    id: String(
      input?.id ??
        placeId ??
        `map-${latitude.toFixed(6)}-${longitude.toFixed(6)}`,
    ),
    placeId: placeId != null ? String(placeId) : undefined,
    googlePlaceId:
      input?.googlePlaceId ?? (placeId != null ? String(placeId) : undefined),
    type: String(input?.type ?? "poi"),
    title: String(input?.title ?? input?.name ?? "Pasirinkta vieta"),
    subtitle: String(
      input?.subtitle ??
        input?.address ??
        `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    ),
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    source: String(input?.source ?? "map_poi"),
  };
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const lastPoiClickAt = useRef(0);

  const { userLocation, refreshLocation, isLocating } = useUserLocation();
  const { buses } = useLiveBuses();
  const planner = useTransitPlanner(userLocation);

  const selectedRoute = planner.selectedRoute as AnyRecord | null;
  const selectedDestination = planner.selectedDestination as AnyRecord | null;

  const [stationAccessPoints, setStationAccessPoints] = useState<
    StationAccessPoint[]
  >([]);
  const [selectedMapPlace, setSelectedMapPlace] = useState<AnyRecord | null>(
    null,
  );
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);

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

    fetchStationAccess(String(stopId))
      .then((items) => {
        if (!cancelled) setStationAccessPoints(items);
      })
      .catch(() => {
        if (!cancelled) setStationAccessPoints([]);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedRoute?.originStop?.id,
    selectedRoute?.originStop?.stopId,
    selectedRoute?.destinationStop?.id,
    selectedRoute?.destinationStop?.stopId,
  ]);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setVisibleRegion((previous) => {
      if (
        previous &&
        Math.abs(previous.latitude - region.latitude) < 0.0007 &&
        Math.abs(previous.longitude - region.longitude) < 0.0007 &&
        Math.abs(previous.latitudeDelta - region.latitudeDelta) < 0.002 &&
        Math.abs(previous.longitudeDelta - region.longitudeDelta) < 0.002
      ) {
        return previous;
      }

      return region;
    });
  }, []);

  const selectedRouteLabel = selectedRoute?.routeLabel || null;

  const selectedRouteNumber = useMemo(() => {
    return normalizeRouteNumber(
      selectedRoute?.routeNumbers?.[0] ??
        selectedRoute?.routeId ??
        selectedRoute?.routeLabel,
    );
  }, [selectedRoute]);

  const selectedLiveBus = useMemo(() => {
    if (!selectedRoute) return null;

    const liveVehicle = selectedRoute.liveVehicle as AnyRecord | null;
    const liveVehicleId = normalizeId(
      liveVehicle?.vehicleId || liveVehicle?.id || liveVehicle?.vehicleLabel,
    );
    const liveVehiclePoint = normalizeVehiclePoint(liveVehicle);

    if (liveVehicleId) {
      const exact = buses.find((rawBus) => {
        const bus = rawBus as AnyRecord;
        const ids = [bus.vehicleId, bus.id, bus.vehicleLabel].map(normalizeId);
        return ids.includes(liveVehicleId);
      });

      if (exact) return exact as AnyRecord;
    }

    if (liveVehiclePoint) {
      const closestByPoint = buses
        .map((rawBus) => {
          const bus = rawBus as AnyRecord;
          const point = normalizeVehiclePoint(bus);
          if (!point) return null;
          return { bus, distance: distanceMeters(point, liveVehiclePoint) };
        })
        .filter(Boolean) as { bus: AnyRecord; distance: number }[];

      closestByPoint.sort((a, b) => a.distance - b.distance);

      if (closestByPoint[0] && closestByPoint[0].distance <= 120) {
        return closestByPoint[0].bus;
      }
    }

    if (!selectedRouteNumber) return null;

    const originPoint = selectedRoute.originStop?.coordinate as
      | MapPoint
      | undefined;

    const candidates = buses
      .filter((rawBus) => {
        const bus = rawBus as AnyRecord;
        const number = normalizeRouteNumber(
          bus.routeId || bus.route || bus.number,
        );
        return number === selectedRouteNumber;
      })
      .map((rawBus) => {
        const bus = rawBus as AnyRecord;
        const point = normalizeVehiclePoint(bus);
        const distance =
          point && originPoint
            ? distanceMeters(point, originPoint)
            : Number.POSITIVE_INFINITY;
        const delay = Number(bus.delaySeconds || 0);
        const speed = Number(bus.speedKph || 0);
        const score =
          distance + Math.max(0, delay) * 0.2 - Math.min(speed, 60) * 3;

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
    return (
      normalizeVehiclePoint(selectedLiveBus) ??
      normalizeVehiclePoint(selectedRoute?.liveVehicle)
    );
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
      if (selectedDestination?.coordinate) {
        coords.push(selectedDestination.coordinate);
      }
    }

    return validPoints(coords);
  }, [selectedDestination, selectedRoute, userLocation]);

  useEffect(() => {
    void focusCoords;
    // PRO FIX: do not auto zoom out after route selection.
    // User keeps full manual control over map zoom/pan like Apple Maps.
  }, [focusCoords, planner.flowState, selectedRoute]);

  useEffect(() => {
    void activeCameraTarget;
    // PRO FIX: automatic follow camera is disabled by default.
    // This prevents unwanted zoom-out/zoom-in while the user explores the map.
  }, [activeCameraTarget, planner.flowState, selectedLiveBus]);

  const showPlacePreview = async (
    rawPlace: AnyRecord,
    shouldReverse = true,
  ) => {
    const provisional = placeFromMapData(rawPlace);
    if (!provisional) return;

    Keyboard.dismiss();
    setSelectedMapPlace(provisional);

    const placeId = provisional.placeId || provisional.googlePlaceId;

    if (!shouldReverse && !placeId) {
      setIsReverseGeocoding(false);
      return;
    }

    setIsReverseGeocoding(true);

    try {
      const place = await Promise.race([
        (async () => {
          if (placeId) return fetchPlaceDetails(placeId);

          const title = String(provisional.title || "").trim();

          if (shouldReverse && title && title !== "Pasirinkta vieta") {
            const nearbyByName = await searchPlaces(title);
            const closest = nearbyByName
              .map((item) => ({
                item,
                distance: item.coordinate
                  ? distanceMeters(provisional.coordinate, item.coordinate)
                  : Number.POSITIVE_INFINITY,
              }))
              .sort((a, b) => a.distance - b.distance)[0];

            if (closest?.item && closest.distance <= 260) {
              const googleId =
                closest.item.placeId || closest.item.googlePlaceId;

              if (googleId) {
                const details = await fetchPlaceDetails(googleId);
                return details || closest.item;
              }

              return closest.item;
            }
          }

          return reverseGeocodePlace(provisional.coordinate);
        })(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2800)),
      ]);

      if (place) {
        setSelectedMapPlace({
          ...provisional,
          ...place,
          title: place.title || provisional.title,
          subtitle: place.subtitle || provisional.subtitle,
          coordinate: place.coordinate || provisional.coordinate,
          latitude: place.latitude ?? provisional.latitude,
          longitude: place.longitude ?? provisional.longitude,
          placeId: place.placeId || place.googlePlaceId || placeId,
          googlePlaceId: place.googlePlaceId || place.placeId || placeId,
        });
      }
    } catch {
      setSelectedMapPlace(provisional);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleMapPress = (event: any) => {
    if (Date.now() - lastPoiClickAt.current < 650) return;

    const coordinate = event?.nativeEvent?.coordinate;

    void showPlacePreview(
      { coordinate, type: "address", source: "map_tap" },
      true,
    );
  };

  const handlePoiClick = (event: any) => {
    lastPoiClickAt.current = Date.now();

    const native = event?.nativeEvent || {};
    const coordinate = native.coordinate ||
      native.position || {
        latitude: native.latitude,
        longitude: native.longitude,
      };

    void showPlacePreview(
      {
        id: native.placeId || native.id,
        placeId: native.placeId || native.id,
        googlePlaceId: native.placeId || native.id,
        title:
          native.name || native.title || native.placeName || "Pasirinkta vieta",
        subtitle: native.address || native.subtitle || "Žemėlapio vieta",
        type: "poi",
        coordinate,
        source: native.placeId || native.id ? "google_places" : "map_poi",
      },
      true,
    );
  };

  const recenterToUser = async () => {
    Keyboard.dismiss();

    await refreshLocation();

    const target = userLocation;
    if (!target) return;

    planner.selectOrigin({
      id: "current-location",
      title: "Mano vieta",
      subtitle: "Dabartinė GPS vieta",
      type: "address",
      latitude: target.latitude,
      longitude: target.longitude,
      coordinate: target,
    } as any);

    void reverseGeocodePlace(target)
      .then((place) => {
        if (!place?.coordinate) return;

        planner.selectOrigin({
          ...place,
          id: place.id || "current-location",
          title: place.title || "Mano vieta",
          subtitle: place.subtitle || "Dabartinė GPS vieta",
          type: place.type || "address",
          latitude: target.latitude,
          longitude: target.longitude,
          coordinate: target,
        } as any);
      })
      .catch(() => undefined);

    mapRef.current?.animateCamera(
      {
        center: target,
        zoom: 16.5,
        pitch: 0,
        heading: 0,
      },
      { duration: 550 },
    );
  };

  return (
    <View style={styles.screen}>
      <MapCanvas
        ref={mapRef}
        onPress={handleMapPress}
        onPoiClick={handlePoiClick}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        <UserLocationLayer coordinate={userLocation} />

        <RoutePolylineLayer
          route={selectedRoute}
          flowState={planner.flowState}
          currentStepIndex={planner.currentStepIndex}
        />

        <WalkingPolylineLayer
          route={selectedRoute}
          userLocation={userLocation}
        />

        <StopsLayer route={selectedRoute} flowState={planner.flowState} />

        <StationAccessLayer
          accessPoints={stationAccessPoints}
          selectedStopId={selectedRoute?.originStop?.id || null}
        />

        <LiveBusesLayer
          buses={buses}
          selectedRouteLabel={selectedRouteLabel}
          selectedVehicleId={selectedVehicleId}
          visibleRegion={visibleRegion}
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

      <Pressable
        style={styles.recenterButton}
        onPress={recenterToUser}
        hitSlop={12}
      >
        <Ionicons
          name={isLocating ? "sync" : "locate"}
          size={22}
          color="#147CFF"
        />
      </Pressable>

      <JourneySheet
        flowState={planner.flowState}
        liveBusCount={buses.length}
        query={planner.query}
        searchResults={planner.searchResults}
        isSearching={planner.isSearching}
        isPlanning={planner.isPlanning}
        routeOptions={planner.routeOptions}
        selectedRoute={selectedRoute}
        currentStepIndex={planner.currentStepIndex}
        travelTimeMode={planner.travelTimeMode}
        travelTimeDate={planner.travelTimeDate}
        onChangeTravelTime={planner.setTravelTime}
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
          void planner.runSearch(text);
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
        onSwapPlaces={planner.swapOriginDestination}
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
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(52,245,179,0.28)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#34F5B3",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  mapTapMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#34F5B3",
  },
  recenterButton: {
    position: "absolute",
    right: 16,
    bottom: 136,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    zIndex: 25,
    elevation: 25,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
});
