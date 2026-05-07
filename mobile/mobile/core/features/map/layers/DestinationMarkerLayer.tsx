import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import type { PlaceSearchResult } from "../../transit/models/transitTypes";

type Props = { destination: PlaceSearchResult | null };

export default function DestinationMarkerLayer({ destination }: Props) {
  if (!destination) return null;
  return (
    <Marker
      coordinate={destination.coordinate}
      anchor={{ x: 0.5, y: 0.88 }}
      tracksViewChanges={false}
      zIndex={340}
    >
      <View style={styles.pin}>
        <Ionicons name="flag" size={13} color="#07101F" />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFB84D",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.96)",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
  },
});
