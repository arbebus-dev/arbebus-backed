import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { COLORS, T } from "@/core/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { AnimatedRegion, Marker, type Region } from "react-native-maps";
import { cleanRouteNumber } from "../../transit/models/journeyStateMachine";
import type { LiveBus } from "../../transit/models/transitTypes";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  buses: LiveBus[];
  selectedRouteLabel?: string | null;
  selectedVehicleId?: string | null;
  visibleRegion?: Region | null;
  focusOnSelectedRoute?: boolean;
};

type BusMarkerProps = {
  coordinate: Coordinate;
  label: string;
  active: boolean;
  vehicle: boolean;
  heading: number;
  animationMs: number;
  zIndex: number;
  stale: boolean;
};

type VisibleBus = {
  bus: LiveBus;
  coordinate: Coordinate;
  label: string;
  normalizedRoute: string;
  isSelectedVehicle: boolean;
  isSelectedRoute: boolean;
  isImportant: boolean;
  stale: boolean;
};

const MAX_IDLE_BUSES = 90;
const MAX_ROUTE_BUSES = 140;
const MIN_ANIMATION_MS = 6500;
const MAX_ANIMATION_MS = 12000;
const MAX_ANIMATED_JUMP_METERS = 450;

function distanceMeters(a: Coordinate, b: Coordinate) {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function previousCoordinateFromBus(bus: LiveBus): Coordinate | null {
  const latitude = Number(
    (bus as any).previousLatitude ?? (bus as any).previousCoordinate?.latitude,
  );
  const longitude = Number(
    (bus as any).previousLongitude ??
      (bus as any).previousCoordinate?.longitude,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function animationDurationForBus(bus: LiveBus, fallbackMs: number) {
  if ((bus as any).stale || (bus as any).filteredJump) return 0;

  const current = coordinateFromBus(bus);
  const previous = previousCoordinateFromBus(bus);
  const backendJump = Number((bus as any).jumpMeters);
  const jumpMeters =
    Number.isFinite(backendJump) && backendJump > 0
      ? backendJump
      : current && previous
        ? distanceMeters(previous, current)
        : 0;

  if (jumpMeters > MAX_ANIMATED_JUMP_METERS) return 0;

  const staleSeconds = Number((bus as any).staleSeconds);
  const predictedSeconds = Number((bus as any).predictedSeconds);
  const seconds = Number.isFinite(staleSeconds) && staleSeconds > 0
    ? staleSeconds
    : Number.isFinite(predictedSeconds) && predictedSeconds > 0
      ? predictedSeconds + 4
      : fallbackMs / 1000;

  return Math.max(
    MIN_ANIMATION_MS,
    Math.min(Math.round(seconds * 1000), MAX_ANIMATION_MS),
  );
}

function normalizeId(value?: string | null) {
  return String(value ?? "").trim();
}

function coordinateFromBus(bus: any): Coordinate | null {
  const latitude = Number(
    bus?.latitude ?? bus?.lat ?? bus?.coordinate?.latitude,
  );
  const longitude = Number(
    bus?.longitude ?? bus?.lon ?? bus?.lng ?? bus?.coordinate?.longitude,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

function busLabel(bus: LiveBus) {
  const raw = bus as any;
  return (
    cleanRouteNumber(
      raw.routeShortName ||
        raw.route_short_name ||
        raw.routeNumber ||
        raw.route_number ||
        raw.routeLabel ||
        raw.route_label ||
        raw.number ||
        raw.line ||
        raw.route ||
        raw.routeId ||
        raw.route_id ||
        raw.vehicleLabel ||
        "BUS",
    ) || "BUS"
  );
}

function stableBusKey(bus: LiveBus, label: string) {
  return String(
    bus.vehicleId ||
      bus.id ||
      bus.vehicleLabel ||
      `${bus.routeId || bus.route || label}-${label}`,
  );
}

function isInRegion(coordinate: Coordinate, region?: Region | null) {
  if (!region) return true;

  const latPad = Math.max(region.latitudeDelta * 0.58, 0.006);
  const lonPad = Math.max(region.longitudeDelta * 0.58, 0.006);

  return (
    coordinate.latitude >= region.latitude - latPad &&
    coordinate.latitude <= region.latitude + latPad &&
    coordinate.longitude >= region.longitude - lonPad &&
    coordinate.longitude <= region.longitude + lonPad
  );
}

function regionDistanceScore(coordinate: Coordinate, region?: Region | null) {
  if (!region) return 0;

  const latScore =
    Math.abs(coordinate.latitude - region.latitude) /
    Math.max(region.latitudeDelta, 0.001);

  const lonScore =
    Math.abs(coordinate.longitude - region.longitude) /
    Math.max(region.longitudeDelta, 0.001);

  return latScore + lonScore;
}

function BusGlyph({
  active,
  vehicle,
  heading,
  label,
  stale,
}: {
  active: boolean;
  vehicle: boolean;
  heading: number;
  label: string;
  stale: boolean;
}) {
  const { theme } = useAppPreferences();
  const opacity = stale ? 0.42 : 1;

  return (
    <Animated.View
      style={[
        styles.glyph,
        { backgroundColor: theme.surface, borderColor: theme.accent },
        active && [styles.glyphActive, { backgroundColor: theme.accent, borderColor: theme.backgroundElevated }],
        vehicle && styles.glyphVehicle,
        { opacity },
      ]}
    >
      <View
        style={[styles.arrow, { transform: [{ rotate: `${heading}deg` }] }]}
      >
        <MaterialCommunityIcons
          name="navigation-variant"
          size={8}
          color={active ? theme.accentText : theme.accent}
        />
      </View>

      <MaterialCommunityIcons
        name="bus"
        size={active ? 12 : 11}
        color={active ? theme.accentText : theme.text}
      />

      <Text
        style={[styles.label, { color: theme.text }, active && [styles.labelActive, { color: theme.accentText }]]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

const BusMarker = memo(
  function BusMarker({
    coordinate,
    label,
    active,
    vehicle,
    heading,
    animationMs,
    zIndex,
    stale,
  }: BusMarkerProps) {
    const { theme } = useAppPreferences();
    const animatedCoordinate = useRef(
      new AnimatedRegion({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      }),
    ).current;

    const [tracksChanges, setTracksChanges] = useState(true);
    const headingRef = useRef(Number.isFinite(heading) ? heading : 0);
    const [displayHeading, setDisplayHeading] = useState(headingRef.current);

    useEffect(() => {
      setTracksChanges(true);

      animatedCoordinate
        .timing({
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          duration: Math.max(0, animationMs),
          useNativeDriver: false,
        } as any)
        .start(() => {
          setTimeout(() => setTracksChanges(false), animationMs <= 0 ? 120 : 520);
        });
    }, [
      animatedCoordinate,
      animationMs,
      coordinate.latitude,
      coordinate.longitude,
    ]);

    useEffect(() => {
      const next = Number.isFinite(heading) ? heading : headingRef.current;
      const previous = headingRef.current;
      let delta = ((next - previous + 540) % 360) - 180;
      const maxStep = 35;

      if (delta > maxStep) delta = maxStep;
      if (delta < -maxStep) delta = -maxStep;

      const smoothed = Math.round((previous + delta + 360) % 360);
      headingRef.current = smoothed;
      setDisplayHeading(smoothed);
    }, [heading]);

    return (
      <Marker.Animated
        coordinate={animatedCoordinate as any}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksChanges || active}
        zIndex={zIndex}
      >
        <View style={styles.markerWrap}>
          {active && !stale ? <View style={styles.glow} /> : null}
          <BusGlyph
            active={active}
            vehicle={vehicle}
            heading={displayHeading}
            label={label}
            stale={stale}
          />
        </View>
      </Marker.Animated>
    );
  },
  (prev, next) =>
    prev.label === next.label &&
    prev.active === next.active &&
    prev.vehicle === next.vehicle &&
    prev.zIndex === next.zIndex &&
    prev.stale === next.stale &&
    Math.abs(prev.animationMs - next.animationMs) < 250 &&
    Math.abs(prev.coordinate.latitude - next.coordinate.latitude) < 0.000006 &&
    Math.abs(prev.coordinate.longitude - next.coordinate.longitude) < 0.000006 &&
    Math.abs(prev.heading - next.heading) < 3,
);

export default function LiveBusesLayer({
  buses,
  selectedRouteLabel,
  selectedVehicleId,
  visibleRegion,
  focusOnSelectedRoute = false,
}: Props) {
  const selectedNumber = cleanRouteNumber(selectedRouteLabel);
  const selectedVehicle = normalizeId(selectedVehicleId);
  const lastUpdateAt = useRef(Date.now());
  const [animationMs, setAnimationMs] = useState(8500);

  useEffect(() => {
    const now = Date.now();
    const diff = now - lastUpdateAt.current;
    lastUpdateAt.current = now;

    if (diff > 800 && diff < 25000) {
      // Trafi-like: marker keeps moving almost until the next GPS packet arrives.
      setAnimationMs(
        Math.max(MIN_ANIMATION_MS, Math.min(Math.round(diff * 1.05), MAX_ANIMATION_MS)),
      );
    }
  }, [buses]);

  const visibleBuses = useMemo(() => {
    const normalized = (buses || [])
      .map((bus) => {
        const coordinate = coordinateFromBus(bus);
        if (!coordinate) return null;

        const label = busLabel(bus);
        const rawBus = bus as any;
        const normalizedRoute = cleanRouteNumber(
          rawBus.routeShortName ||
            rawBus.route_short_name ||
            rawBus.routeNumber ||
            rawBus.route_number ||
            rawBus.routeLabel ||
            rawBus.route_label ||
            rawBus.number ||
            rawBus.line ||
            rawBus.route ||
            rawBus.routeId ||
            rawBus.route_id ||
            label,
        );

        const ids = [bus.vehicleId, bus.id, bus.vehicleLabel].map(normalizeId);

        const isSelectedVehicle = Boolean(
          selectedVehicle && ids.includes(selectedVehicle),
        );

        const isSelectedRoute = Boolean(
          selectedNumber && normalizedRoute === selectedNumber,
        );

        const stale = Boolean((bus as any).stale);
        const isImportant = isSelectedVehicle || isSelectedRoute;

        return {
          bus,
          coordinate,
          label,
          normalizedRoute,
          isSelectedVehicle,
          isSelectedRoute,
          isImportant,
          stale,
        };
      })
      .filter(Boolean) as VisibleBus[];

    const dedupedByVehicle = new Map<string, VisibleBus>();

    for (const item of normalized) {
      const stableKey = stableBusKey(item.bus, item.label);
      const existing = dedupedByVehicle.get(stableKey);

      if (!existing) {
        dedupedByVehicle.set(stableKey, item);
        continue;
      }

      if (item.isImportant && !existing.isImportant) {
        dedupedByVehicle.set(stableKey, item);
      }
    }

    const routeFocused = Boolean(focusOnSelectedRoute && (selectedNumber || selectedVehicle));

    const inViewport = [...dedupedByVehicle.values()].filter((item) => {
      if (routeFocused) return item.isImportant;
      return item.isImportant || isInRegion(item.coordinate, visibleRegion);
    });

    const max =
      selectedNumber || selectedVehicle ? MAX_ROUTE_BUSES : MAX_IDLE_BUSES;

    return inViewport
      .sort((a, b) => {
        if (a.isSelectedVehicle !== b.isSelectedVehicle) {
          return a.isSelectedVehicle ? -1 : 1;
        }

        if (a.isSelectedRoute !== b.isSelectedRoute) {
          return a.isSelectedRoute ? -1 : 1;
        }

        if (a.stale !== b.stale) return a.stale ? 1 : -1;

        return (
          regionDistanceScore(a.coordinate, visibleRegion) -
          regionDistanceScore(b.coordinate, visibleRegion)
        );
      })
      .slice(0, max);
  }, [buses, selectedNumber, selectedVehicle, visibleRegion, focusOnSelectedRoute]);

  return (
    <>
      {visibleBuses.map(
        ({ bus, coordinate, label, isSelectedRoute, isSelectedVehicle, stale }) => {
          const heading = Number(bus.heading ?? bus.bearing ?? 0);
          const markerAnimationMs = animationDurationForBus(bus, animationMs);

          return (
            <BusMarker
              key={`bus-${stableBusKey(bus, label)}`}
              coordinate={coordinate}
              label={label}
              active={isSelectedVehicle || isSelectedRoute}
              vehicle={isSelectedVehicle}
              heading={heading}
              animationMs={markerAnimationMs}
              stale={stale}
              zIndex={isSelectedVehicle ? 5000 : isSelectedRoute ? 2500 : stale ? 50 : 200}
            />
          );
        },
      )}
    </>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  glow: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(45,212,167,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },

  glyph: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 3,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,13,27,0.94)",
    borderWidth: 1.2,
    borderColor: "rgba(45,212,167,0.82)",
  },

  glyphActive: {
    minWidth: 27,
    height: 27,
    borderRadius: 13.5,
    backgroundColor: COLORS.green,
    borderColor: "#FFFFFF",
  },

  glyphVehicle: {
    minWidth: 29,
    height: 29,
    borderRadius: 14.5,
  },

  arrow: {
    position: "absolute",
    top: -5,
    alignSelf: "center",
  },

  label: {
    color: "#FFFFFF",
    fontSize: T.tiny,
    fontWeight: "900",
    marginTop: -2,
    maxWidth: 24,
  },

  labelActive: {
    color: COLORS.greenDark,
    fontSize: T.tiny,
  },
});
