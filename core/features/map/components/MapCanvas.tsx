import React from "react";
import { StyleSheet } from "react-native";
import MapView, { PROVIDER_DEFAULT, type Region } from "react-native-maps";
import type { Coordinate } from "../../transit/models/transitRoute";

const KLAIPEDA_REGION: Region = {
  latitude: 55.7033,
  longitude: 21.1443,
  latitudeDelta: 0.055,
  longitudeDelta: 0.055,
};

export default function MapCanvas({
  mapRef,
  userLocation,
  children,
}: {
  mapRef: React.RefObject<MapView | null>;
  userLocation: Coordinate | null;
  children: React.ReactNode;
}) {
  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      initialRegion={userLocation ? { ...userLocation, latitudeDelta: 0.035, longitudeDelta: 0.035 } : KLAIPEDA_REGION}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      rotateEnabled
      pitchEnabled
      mapPadding={{ top: 130, right: 16, bottom: 280, left: 16 }}
    >
      {children}
    </MapView>
  );
}
