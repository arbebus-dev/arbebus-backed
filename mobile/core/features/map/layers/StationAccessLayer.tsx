import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { StationAccessPoint } from "../../transit/services/transitApi";

type Props = {
  accessPoints: StationAccessPoint[];
  selectedStopId?: string | null;
};

export default function StationAccessLayer({ accessPoints }: Props) {
  if (!accessPoints?.length) return null;

  return (
    <>
      {accessPoints.map((point) => (
        <Marker
          key={point.id}
          coordinate={point.coordinate}
          anchor={{ x: 0.5, y: 0.95 }}
          tracksViewChanges={false}
          zIndex={1350}
        >
          <View style={styles.wrap}>
            <View style={styles.glow} />
            <View style={styles.marker}>
              <Ionicons
                name={point.type === "exit" ? "exit-outline" : "enter-outline"}
                size={14}
                color="#06111F"
              />
              <Text style={styles.code}>{point.code || "A"}</Text>
            </View>
            <View style={styles.label}>
              <Text style={styles.labelText} numberOfLines={1}>{point.title}</Text>
            </View>
          </View>
        </Marker>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
  },
  marker: {
    minWidth: 40,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#35F2B4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  code: {
    color: "#06111F",
    fontWeight: "900",
    fontSize: 12,
  },
  label: {
    marginTop: 4,
    maxWidth: 132,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(5,7,13,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  labelText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});
