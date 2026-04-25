import React, { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { PROVIDER_DEFAULT, Region } from "react-native-maps";

const KLAIPEDA_REGION: Region = {
  latitude: 55.7033,
  longitude: 21.1443,
  latitudeDelta: 0.075,
  longitudeDelta: 0.075,
};

type Props = {
  children?: React.ReactNode;
  initialRegion?: Region;
};

const MapCanvas = forwardRef<MapView, Props>(({ children, initialRegion = KLAIPEDA_REGION }, ref) => {
  return (
    <View style={styles.container}>
      <MapView
        ref={ref}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsBuildings
        showsTraffic={false}
        mapType="standard"
      >
        {children}
      </MapView>
    </View>
  );
});

MapCanvas.displayName = "MapCanvas";

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#05070D",
  },
});

export default MapCanvas;
