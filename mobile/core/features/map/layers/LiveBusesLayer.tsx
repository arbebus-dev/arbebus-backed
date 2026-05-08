import { COLORS, T } from "@/core/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
};

type BusMarkerProps = {
  coordinate: Coordinate;
  label: string;
  active: boolean;
  vehicle: boolean;
  heading: number;
  animationMs: number;
  zIndex: number;
};

type VisibleBus = {
  bus: LiveBus;
  coordinate: Coordinate;
  label: string;
  normalizedRoute: string;
  isSelectedVehicle: boolean;
  isSelectedRoute: boolean;
  isImportant: boolean;
};

const MAX_IDLE_BUSES = 90;
const MAX_ROUTE_BUSES = 140;

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
  return (
    cleanRouteNumber(
      bus.number || bus.route || bus.routeId || bus.vehicleLabel || "BUS",
    ) || "BUS"
  );
}

function stableBusKey(bus: LiveBus, label: string) {
  return String(bus.vehicleId || bus.id || bus.vehicleLabel || label);
}

function isInRegion(coordinate: Coordinate, region?: Region | null) {
  if (!region) return true;

  const latPad = Math.max(region.latitudeDelta * 0.55, 0.006);
  const lonPad = Math.max(region.longitudeDelta * 0.55, 0.006);

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
}: {
  active: boolean;
  vehicle: boolean;
  heading: number;
  label: string;
}) {
  return (
    <View
      style={[
        styles.glyph,
        active && styles.glyphActive,
        vehicle && styles.glyphVehicle,
      ]}
    >
      <View
        style={[styles.arrow, { transform: [{ rotate: `${heading}deg` }] }]}
      >
        <MaterialCommunityIcons
          name="navigation-variant"
          size={8}
          color={active ? COLORS.greenDark : COLORS.green}
        />
      </View>

      <MaterialCommunityIcons
        name="bus"
        size={active ? 12 : 11}
        color={active ? COLORS.greenDark : "#FFFFFF"}
      />

      <Text
        style={[styles.label, active && styles.labelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
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
  }: BusMarkerProps) {
    const animatedCoordinate = useRef(
      new AnimatedRegion({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      }),
    ).current;

    const [tracksChanges, setTracksChanges] = useState(true);

    useEffect(() => {
      setTracksChanges(true);

      animatedCoordinate
        .timing({
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          duration: animationMs,
          useNativeDriver: false,
        } as any)
        .start(() => {
          setTimeout(() => setTracksChanges(false), 420);
        });
    }, [
      animatedCoordinate,
      animationMs,
      coordinate.latitude,
      coordinate.longitude,
    ]);

    return (
      <Marker.Animated
        coordinate={animatedCoordinate as any}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={tracksChanges || active}
        zIndex={zIndex}
      >
        <View style={styles.markerWrap}>
          {active ? <View style={styles.glow} /> : null}
          <BusGlyph
            active={active}
            vehicle={vehicle}
            heading={heading}
            label={label}
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
    Math.abs(prev.coordinate.latitude - next.coordinate.latitude) < 0.000008 &&
    Math.abs(prev.coordinate.longitude - next.coordinate.longitude) <
      0.000008 &&
    Math.abs(prev.heading - next.heading) < 4,
);

export default function LiveBusesLayer({
  buses,
  selectedRouteLabel,
  selectedVehicleId,
  visibleRegion,
}: Props) {
  const selectedNumber = cleanRouteNumber(selectedRouteLabel);
  const selectedVehicle = normalizeId(selectedVehicleId);
  const lastUpdateAt = useRef(Date.now());
  const [animationMs, setAnimationMs] = useState(6200);

  useEffect(() => {
    const now = Date.now();
    const diff = now - lastUpdateAt.current;
    lastUpdateAt.current = now;

    if (diff > 800 && diff < 20000) {
      // Animate almost through the full polling interval. Without this, markers
      // move for ~3s, then freeze, then jump on the next GPS packet.
      setAnimationMs(Math.max(2500, Math.min(Math.round(diff * 0.92), 8500)));
    }
  }, [buses]);

  const visibleBuses = useMemo(() => {
    const normalized = (buses || [])
      .map((bus) => {
        const coordinate = coordinateFromBus(bus);
        if (!coordinate) return null;

        const label = busLabel(bus);
        const normalizedRoute = cleanRouteNumber(
          bus.routeId || bus.route || bus.number,
        );
        const ids = [bus.vehicleId, bus.id, bus.vehicleLabel].map(normalizeId);

        const isSelectedVehicle = Boolean(
          selectedVehicle && ids.includes(selectedVehicle),
        );
        const isSelectedRoute = Boolean(
          selectedNumber && normalizedRoute === selectedNumber,
        );
        const isImportant = isSelectedVehicle || isSelectedRoute;

        return {
          bus,
          coordinate,
          label,
          normalizedRoute,
          isSelectedVehicle,
          isSelectedRoute,
          isImportant,
        };
      })
      .filter(Boolean) as VisibleBus[];

    const dedupedByVehicle = new Map<string, VisibleBus>();

    for (const item of normalized) {
      const stableKey = `${stableBusKey(item.bus, item.label)}-${item.normalizedRoute || item.label}`;
      const existing = dedupedByVehicle.get(stableKey);
      if (!existing || item.isImportant) dedupedByVehicle.set(stableKey, item);
    }

    const inViewport = [...dedupedByVehicle.values()].filter(
      (item) => item.isImportant || isInRegion(item.coordinate, visibleRegion),
    );

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

        return (
          regionDistanceScore(a.coordinate, visibleRegion) -
          regionDistanceScore(b.coordinate, visibleRegion)
        );
      })
      .slice(0, max);
  }, [buses, selectedNumber, selectedVehicle, visibleRegion]);

  return (
    <>
      {visibleBuses.map(
        ({ bus, coordinate, label, isSelectedRoute, isSelectedVehicle }) => {
          const heading = Number(bus.heading ?? bus.bearing ?? 0);

          return (
            <BusMarker
              key={`bus-${stableBusKey(bus, label)}-${cleanRouteNumber(bus.routeId || bus.route || label)}`}
              coordinate={coordinate}
              label={label}
              active={isSelectedVehicle || isSelectedRoute}
              vehicle={isSelectedVehicle}
              heading={heading}
              animationMs={animationMs}
              zIndex={isSelectedVehicle ? 5000 : isSelectedRoute ? 2500 : 200}
            />
          );
        },
      )}
    </>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  glow: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(45,212,167,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },

  glyph: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 4,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,13,27,0.94)",
    borderWidth: 1.2,
    borderColor: "rgba(45,212,167,0.82)",
  },

  glyphActive: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.green,
    borderColor: "#FFFFFF",
  },

  glyphVehicle: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
  },

  arrow: {
    position: "absolute",
    top: -6,
    alignSelf: "center",
  },

  label: {
    color: "#FFFFFF",
    fontSize: T.tiny,
    fontWeight: "900",
    marginTop: -2,
    maxWidth: 28,
  },

  labelActive: {
    color: COLORS.greenDark,
    fontSize: T.tiny,
  },
});
