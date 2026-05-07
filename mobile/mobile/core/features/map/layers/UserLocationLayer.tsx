import React from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import type { Coordinate } from "../../transit/models/transitTypes";

type Props = {
  coordinate: Coordinate | null;
};

export default function UserLocationLayer({ coordinate }: Props) {
  if (!coordinate) return null;

  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View style={styles.pulse}>
        <View style={styles.outer}>
          <View style={styles.inner} />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pulse: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(77,163,255,0.18)",
  },
  outer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(77,163,255,0.30)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },
  inner: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#4DA3FF",
    borderWidth: 2,
    borderColor: "white",
  },
});
