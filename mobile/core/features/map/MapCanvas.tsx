import Constants from "expo-constants";
import React, { forwardRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, {
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";

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
};

function shouldUseGoogleProvider() {
  if (Platform.OS === "web") return false;

  const expoConfig: any = Constants.expoConfig || {};
  const iosKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ||
    process.env.GOOGLE_MAPS_IOS_API_KEY ||
    expoConfig?.ios?.config?.googleMapsApiKey ||
    expoConfig?.extra?.googleMapsProviderEnabled;

  return Boolean(iosKey);
}

const MapCanvas = forwardRef<MapView, Props>(
  ({ children, onPress, onPoiClick }, ref) => {
    const useGoogleProvider = shouldUseGoogleProvider();

    return (
      <View style={styles.container}>
        <MapView
          ref={ref}
          provider={useGoogleProvider ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          onPress={onPress}
          {...({ onPoiClick } as any)}
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
