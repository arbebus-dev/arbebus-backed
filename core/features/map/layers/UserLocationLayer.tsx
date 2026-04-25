import React from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import type { Coordinate } from "../../transit/models/transitRoute";

type Props = { coordinate: Coordinate | null };

export default function UserLocationLayer({ coordinate }: Props) {
  if (!coordinate) return null;
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View style={styles.outer}><View style={styles.inner} /></View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  outer: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(105,225,255,0.22)", borderWidth: 1, borderColor: "#69E1FF" },
  inner: { width: 13, height: 13, borderRadius: 7, backgroundColor: "#69E1FF", borderWidth: 2, borderColor: "#FFFFFF" },
});
