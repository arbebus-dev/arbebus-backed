import { Ionicons } from "@expo/vector-icons";
import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";

import { useLiveBuses } from "../transit/hooks/useLiveBuses";
import { useTransitPlanner } from "../transit/hooks/useTransitPlanner";
import { useUserLocation } from "../transit/hooks/useUserLocation";
import FerryScreen from "../ferries/FerryScreen";
import type { FerryTerminal, LiveFerry } from "../ferries/types";
import { fetchLiveFerries } from "../ferries/services/ferryApi";
import type { PlaceSearchResult, TransitRouteOption } from "../transit/models/transitTypes";
import {
  fetchPlaceDetails,
  fetchStationAccess,
  fetchTransitRouteShape,
  type TransitScheduleRoute,
  reverseGeocodePlace,
  searchPlaces,
  type StationAccessPoint,
} from "../transit/services/transitApi";

import JourneySheet from "./JourneySheet";
import DestinationMarkerLayer from "./layers/DestinationMarkerLayer";
import FerryMarkersLayer from "./layers/FerryMarkersLayer";
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

function placeFromMapData(input: AnyRecord | null | undefined): PlaceSearchResult | null {
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
  const { theme } = useAppPreferences();
  const mapRef = useRef<MapView | null>(null);
  const lastPoiClickAt = useRef(0);

  const { userLocation, refreshLocation, isLocating } = useUserLocation();
  const { buses } = useLiveBuses();
  const planner = useTransitPlanner(userLocation);

  const selectedRoute = planner.selectedRoute as TransitRouteOption | null;
  const selectedDestination = planner.selectedDestination as PlaceSearchResult | null;

  const [stationAccessPoints, setStationAccessPoints] = useState<
    StationAccessPoint[]
  >([]);
  const [selectedMapPlace, setSelectedMapPlace] = useState<PlaceSearchResult | null>(
    null,
  );
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  const [ferryScreenVisible, setFerryScreenVisible] = useState(false);
  const [selectedFerryTerminalId, setSelectedFerryTerminalId] = useState<string | null>(null);
  const [liveFerries, setLiveFerries] = useState<LiveFerry[]>([]);
  const [focusedScheduleRoute, setFocusedScheduleRoute] = useState<TransitRouteOption | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchLiveFerries()
        .then((items) => {
          if (!cancelled) setLiveFerries(items);
        })
        .catch(() => {
          if (!cancelled) setLiveFerries([]);
        });
    };

    load();
    const timer = setInterval(load, 20000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

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

  const selectedRouteFocusKey = useMemo(() => {
    if (!selectedRoute) return null;
    return String(
      selectedRoute.id ||
        (selectedRoute as AnyRecord).signature ||
        selectedRoute.routeId ||
        selectedRoute.routeLabel ||
        selectedRoute.title ||
        "route",
    );
  }, [selectedRoute]);

  useEffect(() => {
    if (!selectedRouteFocusKey || focusCoords.length < 2 || !mapRef.current) return;

    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(focusCoords, {
        animated: true,
        edgePadding: { top: 110, right: 54, bottom: 360, left: 54 },
      });
    }, 420);

    return () => clearTimeout(timer);
  }, [focusCoords, selectedRouteFocusKey]);

  useEffect(() => {
    if (!activeCameraTarget || planner.flowState !== "onboard" || !mapRef.current) return;

    mapRef.current.animateCamera(
      {
        center: activeCameraTarget,
        zoom: 15.8,
      },
      { duration: 900 },
    );
  }, [activeCameraTarget, planner.flowState]);

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
            const nearbyByName = await searchPlaces(title, userLocation ?? undefined);
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


  const handleSelectFerryTerminal = useCallback((terminal: FerryTerminal) => {
    const coordinate = { latitude: terminal.latitude, longitude: terminal.longitude };

    setSelectedFerryTerminalId(terminal.id);
    setSelectedMapPlace({
      id: terminal.id,
      title: terminal.name,
      subtitle: terminal.address || "Keltų terminalas",
      type: "ferry",
      latitude: terminal.latitude,
      longitude: terminal.longitude,
      coordinate,
      source: "arbebus_ferries",
    } as PlaceSearchResult);

    mapRef.current?.animateCamera(
      { center: coordinate, zoom: 15.4, pitch: 0 },
      { duration: 520 },
    );
  }, []);

  const handleSelectLiveFerry = useCallback((ferry: LiveFerry) => {
    const coordinate = {
      latitude: Number(ferry.latitude ?? ferry.coordinate?.latitude),
      longitude: Number(ferry.longitude ?? ferry.coordinate?.longitude),
    };

    if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
      return;
    }

    setSelectedFerryTerminalId(null);
    setSelectedMapPlace({
      id: ferry.id,
      title: ferry.title || ferry.pierName || "Keltas",
      subtitle: `${ferry.pierName || ferry.ferryLine || "Keltas"} • ${ferry.status === "sailing" ? "plaukia" : "laukia reiso"}`,
      type: "ferry",
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      coordinate,
      source: "arbebus_ferry_live",
    } as PlaceSearchResult);

    mapRef.current?.animateCamera(
      { center: coordinate, zoom: ferry.status === "sailing" ? 14.2 : 15.4, pitch: 0 },
      { duration: 520 },
    );
  }, []);

  const handleMapPress = (event: any) => {
    if (Date.now() - lastPoiClickAt.current < 650) return;

    const coordinate = event?.nativeEvent?.coordinate;

    setSelectedFerryTerminalId(null);

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


  const handleOpenBusRoute = useCallback(async (route: TransitScheduleRoute) => {
    Keyboard.dismiss();
    setSelectedMapPlace(null);

    try {
      const payload = await fetchTransitRouteShape(route.routeId);
      const stops = (payload.stops || []).map((stop: AnyRecord, index: number) => ({
        ...stop,
        id: String(stop.id ?? stop.stopId ?? `${route.routeId}-${index}`),
        stopId: String(stop.stopId ?? stop.id ?? `${route.routeId}-${index}`),
        title: String(stop.title ?? stop.name ?? stop.stopName ?? "Stotelė"),
        name: String(stop.name ?? stop.title ?? stop.stopName ?? "Stotelė"),
        latitude: Number(stop.latitude ?? stop.coordinate?.latitude),
        longitude: Number(stop.longitude ?? stop.coordinate?.longitude),
        coordinate: {
          latitude: Number(stop.latitude ?? stop.coordinate?.latitude),
          longitude: Number(stop.longitude ?? stop.coordinate?.longitude),
        },
      })).filter((stop: AnyRecord) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude));

      const firstStop = stops[0] || null;
      const lastStop = stops[stops.length - 1] || null;
      const line = validPoints(payload.polyline || payload.points || []);

      const routeOption = {
        id: `schedule-${route.routeId}`,
        title: `${route.shortName} Autobusas`,
        subtitle: route.subtitle || route.longName || "Visas maršrutas",
        mode: "bus_schedule",
        routeId: String(route.routeId),
        shapeId: payload.shapeId || null,
        routeLabel: route.shortName || String(route.routeId),
        routeNumbers: [route.shortName || String(route.routeId)],
        totalMinutes: 0,
        totalDurationMinutes: 0,
        walkingMinutes: 0,
        totalWalkMinutes: 0,
        transfers: 0,
        transfersCount: 0,
        stopCount: stops.length,
        boardStopName: firstStop?.title || route.from || "Pradžia",
        alightStopName: lastStop?.title || route.to || "Pabaiga",
        originStop: firstStop,
        destinationStop: lastStop,
        previewPoints: line,
        polyline: line,
        steps: [
          {
            id: `schedule-step-${route.routeId}`,
            type: "bus",
            mode: "bus",
            title: `${route.shortName} Autobusas`,
            subtitle: route.subtitle || route.longName || "Visos stotelės",
            routeId: String(route.routeId),
            routeNumber: route.shortName || String(route.routeId),
            routeLabel: route.shortName || String(route.routeId),
            stopCount: stops.length,
            stops,
            rideStops: stops,
            routeStops: stops,
            polyline: line,
          },
        ],
        journeySteps: [
          {
            id: `schedule-step-${route.routeId}`,
            type: "bus",
            mode: "bus",
            title: `${route.shortName} Autobusas`,
            subtitle: route.subtitle || route.longName || "Visos stotelės",
            routeId: String(route.routeId),
            routeNumber: route.shortName || String(route.routeId),
            routeLabel: route.shortName || String(route.routeId),
            stopCount: stops.length,
            stops,
            rideStops: stops,
            routeStops: stops,
            polyline: line,
          },
        ],
        headsign: route.to || null,
        summary: { scheduleOnly: true, route },
      } as TransitRouteOption;

      setFocusedScheduleRoute(routeOption);

      if (line.length >= 2) {
        mapRef.current?.fitToCoordinates(line, {
          animated: true,
          edgePadding: { top: 100, right: 54, bottom: 360, left: 54 },
        });
      }
    } catch {
      setFocusedScheduleRoute(null);
    }
  }, []);

  const mapRoute = focusedScheduleRoute || selectedRoute;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <MapCanvas
        ref={mapRef}
        onPress={handleMapPress}
        onPoiClick={handlePoiClick}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        <UserLocationLayer coordinate={userLocation} />

        <RoutePolylineLayer
          route={mapRoute}
          flowState={planner.flowState}
          currentStepIndex={planner.currentStepIndex}
        />

        <WalkingPolylineLayer
          route={mapRoute}
          userLocation={userLocation}
        />

        <StopsLayer route={mapRoute} flowState={planner.flowState} />

        <StationAccessLayer
          accessPoints={stationAccessPoints}
          selectedStopId={selectedRoute?.originStop?.id || null}
        />

        <FerryMarkersLayer
          selectedTerminalId={selectedFerryTerminalId}
          selectedRoute={mapRoute}
          liveFerries={liveFerries}
          onSelectTerminal={handleSelectFerryTerminal}
          onSelectLiveFerry={handleSelectLiveFerry}
        />

        <LiveBusesLayer
          buses={buses}
          selectedRouteLabel={
            focusedScheduleRoute?.routeNumbers?.[0] ||
            focusedScheduleRoute?.routeLabel ||
            selectedRouteNumber ||
            selectedRouteLabel
          }
          selectedVehicleId={selectedVehicleId}
          visibleRegion={visibleRegion}
          focusOnSelectedRoute={Boolean(mapRoute)}
        />

        {selectedMapPlace?.coordinate ? (
          <Marker
            coordinate={selectedMapPlace.coordinate}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={[styles.mapTapMarker, { backgroundColor: theme.accentSoft, borderColor: theme.backgroundElevated, shadowColor: theme.accent }]}>
              <View style={[styles.mapTapMarkerInner, { backgroundColor: theme.accent }]} />
            </View>
          </Marker>
        ) : null}

        <DestinationMarkerLayer destination={selectedDestination} />
      </MapCanvas>

      <Pressable
        style={[styles.recenterButton, { backgroundColor: theme.isLight ? "rgba(255,255,255,0.94)" : theme.surfaceStrong, borderColor: theme.borderStrong }]}
        onPress={recenterToUser}
        hitSlop={12}
      >
        <Ionicons
          name={isLocating ? "sync" : "locate"}
          size={22}
          color={theme.isLight ? "#147CFF" : theme.accent}
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
        selectedRoute={mapRoute}
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
          setFocusedScheduleRoute(null);
          void planner.runSearch(text);
        }}
        onSubmitSearch={() => {
          setFocusedScheduleRoute(null);
          void planner.runSearch();
        }}
        onSelectDestination={(item) => {
          Keyboard.dismiss();
          setFocusedScheduleRoute(null);
          setSelectedMapPlace(null);
          void planner.selectDestination(item);
        }}
        onSelectOrigin={(item) => {
          Keyboard.dismiss();
          setSelectedMapPlace(null);
          setFocusedScheduleRoute(null);
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
        onChooseRoute={(route) => { setFocusedScheduleRoute(null); planner.chooseRoute(route); }}
        onStartJourney={planner.startJourney}
        onNextStep={planner.nextStep}
        onBackToRoutes={() => { setFocusedScheduleRoute(null); planner.backToRoutesList(); }}
        onBackToSearch={() => { setFocusedScheduleRoute(null); planner.backToSearch(); }}
        onReset={() => { setFocusedScheduleRoute(null); planner.resetPlanner(); }}
        onOpenFerries={() => setFerryScreenVisible(true)}
        onOpenBusRoute={handleOpenBusRoute}
      />

      <FerryScreen
        visible={ferryScreenVisible}
        onClose={() => setFerryScreenVisible(false)}
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
