import React from "react";
import { Animated, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { Coordinate } from "../models";

type Props = {
  coordinate: Coordinate | null;
  heading?: number;
};

export function DriverMarker({ coordinate, heading = 0 }: Props) {
  if (!coordinate) return null;

  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }}>
      <Animated.View
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: [{ rotate: `${heading}deg` }],
        }}
      >
        <View
          style={{
            backgroundColor: "#2563EB",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }}
        >
          <Text style={{ fontSize: 18 }}>🚕</Text>
        </View>
      </Animated.View>
    </Marker>
  );
}