import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  number: string;
};

export default function BusMarker({ number }: Props) {
  return (
    <View style={styles.container}>
      
      {/* Glow */}
      <View style={styles.glow} />

      {/* Marker */}
      <View style={styles.marker}>
        <Text style={styles.number}>{number}</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },

  glow: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,180,255,0.25)",
  },

  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0A1F4F",
    borderWidth: 2,
    borderColor: "#3FD0FF",
    alignItems: "center",
    justifyContent: "center",
  },

  number: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});