import React from "react";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { DriverMarker } from "../../core/features/rideBooking/components/DriverMarker";
import styles from "../../styles";
import { LiveBus } from "../../types/home";
import AppMarker from "../map/AppMarker";
import RoutePointMarker from "../map/RoutePointMarker";

const busImg = require("../../assets/markers/bus.png");
const busBestImg = require("../../assets/markers/bus-best.png");

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Props = {
  mapRef: any;
  initialRegion: any;
  userLocation: Coordinate | null;
  mapState: any;
  driverHeading: number;
  driverRoutePoints: Coordinate[];
  polylineCoords: Coordinate[];
  routeCoords: Coordinate[];
  rideStatus: string;
  liveBuses: LiveBus[];
  busAnimationsRef: any;
  bestBusId: string | null;
  onBusPress: (bus: LiveBus) => void;
  pickupTitle?: string;
  pickupSubtitle?: string;
  destinationTitle?: string;
  destinationSubtitle?: string;
};

export default function HomeMapLayer({
  mapRef,
  initialRegion,
  userLocation,
  mapState,
  driverHeading,
  driverRoutePoints,
  polylineCoords,
  routeCoords,
  rideStatus,
  liveBuses,
  busAnimationsRef,
  bestBusId,
  onBusPress,
  pickupTitle,
  pickupSubtitle,
  destinationTitle,
  destinationSubtitle,
}: Props) {
  const routeToRender = polylineCoords.length > 1 ? polylineCoords : routeCoords;

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={styles.map}
      initialRegion={initialRegion}
      showsCompass={false}
      showsMyLocationButton={false}
      showsUserLocation={true}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
    >
      {routeToRender.length > 1 ? (
        <>
          <Polyline coordinates={routeToRender} strokeWidth={8} strokeColor="rgba(77, 141, 255, 0.18)" />
          <Polyline coordinates={routeToRender} strokeWidth={4} strokeColor="#4D8DFF" />
        </>
      ) : null}

      {driverRoutePoints.length > 1 &&
      (rideStatus === "driver_arriving" ||
        rideStatus === "driver_arrived" ||
        rideStatus === "ride_started") ? (
        <Polyline
          coordinates={driverRoutePoints}
          strokeWidth={3}
          strokeColor="rgba(255,255,255,0.55)"
          lineDashPattern={[8, 8]}
        />
      ) : null}

      {mapState.pickupCoordinate ? (
        <RoutePointMarker
          coordinate={mapState.pickupCoordinate}
          type="pickup"
          title={pickupTitle || "Pickup"}
          subtitle={pickupSubtitle}
        />
      ) : null}

      {mapState.destinationCoordinate ? (
        <RoutePointMarker
          coordinate={mapState.destinationCoordinate}
          type="destination"
          title={destinationTitle || "Destination"}
          subtitle={destinationSubtitle}
        />
      ) : null}

      {liveBuses.map((bus) => {
        const isBest = bus.id === bestBusId;
        const animatedEntry = busAnimationsRef?.current?.[bus.id];
        const animatedCoordinate = animatedEntry?.coordinate;
        const coordinate =
          animatedCoordinate &&
          typeof animatedCoordinate.latitude === "number" &&
          typeof animatedCoordinate.longitude === "number"
            ? animatedCoordinate
            : bus.coordinate;

        return (
          <AppMarker
            key={bus.id}
            coordinate={coordinate}
            source={isBest ? busBestImg : busImg}
            rotation={bus.heading ?? bus.bearing ?? animatedEntry?.rotation ?? 0}
            label={(bus as any).route || bus.number || (bus as any).vehicleLabel || "?"}
            isBest={isBest}
            onPress={() => onBusPress(bus)}
          />
        );
      })}

      {mapState.driverCoordinate ? (
        <DriverMarker coordinate={mapState.driverCoordinate} heading={driverHeading} />
      ) : null}
    </MapView>
  );
}
