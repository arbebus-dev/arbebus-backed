import { Ionicons } from "@expo/vector-icons";
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
      <Marker coordinate={route.originStop.coordinate} anchor={{ x: 0.5, y: 0.95 }}>
        <View style={styles.pinWrap}>
          <View style={styles.stopIn}>
            <Ionicons name="bus" size={15} color="#06111F" />
            <Text style={styles.text}>ĮLIPK</Text>
          </View>
          <View style={styles.pinDotIn} />
        </View>
      </Marker>

      <Marker coordinate={route.destinationStop.coordinate} anchor={{ x: 0.5, y: 0.95 }}>
        <View style={styles.pinWrap}>
          <View style={styles.stopOut}>
            <Ionicons name="flag" size={14} color="#06111F" />
            <Text style={styles.text}>IŠLIPK</Text>
          </View>
          <View style={styles.pinDotOut} />
        </View>
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  stopIn: {
    minWidth: 74,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#35F2B4",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#35F2B4",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  stopOut: {
    minWidth: 78,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFB84D",
    borderWidth: 2,
    borderColor: "white",
    shadowColor: "#FFB84D",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  pinDotIn: {
    marginTop: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#35F2B4",
    borderWidth: 2,
    borderColor: "white",
  },
  pinDotOut: {
    marginTop: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFB84D",
    borderWidth: 2,
    borderColor: "white",
  },
  text: {
    color: "#06111F",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
});