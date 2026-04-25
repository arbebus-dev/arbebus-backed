import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import type { TransitStop } from "../../transit/models/transitRoute";

type Props = { destination: TransitStop | null };

export default function DestinationMarkerLayer({ destination }: Props) {
  if (!destination) return null;
  return (
    <Marker coordinate={destination.coordinate} title={destination.title} description={destination.subtitle}>
      <View style={styles.marker}><Ionicons name="flag" color="#06101C" size={18} /></View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  marker: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#6DFF8F", borderWidth: 2, borderColor: "#06101C" },
});
