import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { LiveBus } from "../../transit/models/transitRoute";

type Props = { buses: LiveBus[] };

export default function LiveBusesLayer({ buses }: Props) {
  return (
    <>
      {buses.map((bus) => (
        <Marker key={bus.id} coordinate={bus.coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.marker}>
            <Text style={styles.text}>{bus.routeNumber}</Text>
          </View>
        </Marker>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  marker: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 7,
    borderRadius: 17,
    backgroundColor: "#69E1FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#06101C",
  },
  text: { color: "#06101C", fontSize: 12, fontWeight: "900" },
});
