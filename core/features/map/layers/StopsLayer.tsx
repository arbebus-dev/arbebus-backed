import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { TransitRouteOption } from "../../transit/models/transitTypes";

type Props = {
  route: TransitRouteOption | null;
};

export default function StopsLayer({ route }: Props) {
  if (!route) return null;

  return (
    <>
      <Marker coordinate={route.originStop.coordinate} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.stopIn}>
          <Text style={styles.text}>IN</Text>
        </View>
      </Marker>

      <Marker coordinate={route.destinationStop.coordinate} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.stopOut}>
          <Text style={styles.text}>OUT</Text>
        </View>
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  stopIn: {
    minWidth: 34,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35F2B4",
    borderWidth: 2,
    borderColor: "white",
  },
  stopOut: {
    minWidth: 40,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFB84D",
    borderWidth: 2,
    borderColor: "white",
  },
  text: {
    color: "#07101F",
    fontSize: 10,
    fontWeight: "900",
  },
});
