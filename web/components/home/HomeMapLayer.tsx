import React from "react";
import MapView, { Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { DriverMarker } from "../../core/features/rideBooking/components/DriverMarker";
import styles from "../../styles";
import { LiveBus } from "../../types/home";
import AppMarker from "../map/AppMarker";

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
}: Props) {
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
      {polylineCoords.length > 0 ? (
        <Polyline
          coordinates={polylineCoords}
          strokeWidth={4}
          strokeColor="#4D8DFF"
        />
      ) : null}

      {liveBuses.map((bus) => {
        const isBest = bus.id === bestBusId;

        return (
          <AppMarker
            key={bus.id}
            coordinate={bus.coordinate}
            source={isBest ? busBestImg : busImg}
            rotation={bus.heading ?? bus.bearing ?? 0}
            label={bus.number}
            isBest={isBest}
            onPress={() => onBusPress(bus)}
          />
        );
      })}

      {mapState.driverCoordinate ? (
        <DriverMarker
          coordinate={mapState.driverCoordinate}
          heading={driverHeading}
        />
      ) : null}
    </MapView>
  );
}