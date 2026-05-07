import React, { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { type Region } from "react-native-maps";

const INITIAL_REGION: Region = {
  latitude: 55.7033,
  longitude: 21.1443,
  latitudeDelta: 0.075,
  longitudeDelta: 0.075,
};

type Props = {
  children?: React.ReactNode;
  onPress?: any;
  onPoiClick?: any;
  onRegionChangeComplete?: (region: Region) => void;
};

const MapCanvas = forwardRef<MapView, Props>(
  ({ children, onPress, onPoiClick, onRegionChangeComplete }, ref) => {
    return (
      <View style={styles.container}>
        <MapView
          ref={ref}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          onPress={onPress}
          onPoiClick={onPoiClick}
          onRegionChangeComplete={onRegionChangeComplete}
          moveOnMarkerPress={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsBuildings
          showsPointsOfInterest
          showsIndoors
          rotateEnabled
          pitchEnabled
        >
          {children}
        </MapView>
      </View>
    );
  },
);

MapCanvas.displayName = "MapCanvas";

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});

export default MapCanvas;
