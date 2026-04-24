import React from "react";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { StyleSheet, View } from "react-native";

type Coordinate = { latitude: number; longitude: number };

const APPLE_LIKE_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f7fb" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5b6473" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#d8dee9" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eef2f7" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e6f3e8" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#d9e1ea" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#cfd8e3" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#dfe7f2" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe8ff" }] },
];

function UserMarker({ coordinate }: { coordinate: Coordinate }) {
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View style={styles.userOuterRing}>
        <View style={styles.userPulseRing} />
        <View style={styles.userInnerDot} />
      </View>
    </Marker>
  );
}

export default function MapCanvas({
  mapRef,
  initialRegion,
  userLocation,
  children,
}: {
  mapRef: React.RefObject<MapView | null>;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  userLocation?: Coordinate | null;
  children?: React.ReactNode;
}) {
  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      customMapStyle={APPLE_LIKE_MAP_STYLE as any}
      showsCompass={false}
      showsMyLocationButton={false}
      showsUserLocation={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      pitchEnabled
      rotateEnabled
    >
      {children}
      {userLocation ? <UserMarker coordinate={userLocation} /> : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  userOuterRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  userPulseRing: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(23, 119, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(23, 119, 255, 0.28)",
  },
  userInnerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1677FF",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
