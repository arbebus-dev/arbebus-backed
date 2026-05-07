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
      {accessPoints.map((point) => {
        const isExit = point.type === "exit";

        return (
          <Marker
            key={point.id}
            coordinate={point.coordinate}
            anchor={{ x: 0.5, y: 0.9 }}
            tracksViewChanges={false}
            zIndex={360}
          >
            <View style={styles.wrap}>
              <View style={[styles.marker, isExit && styles.exitMarker]}>
                <Ionicons
                  name={isExit ? "exit-outline" : "enter-outline"}
                  size={12}
                  color="#07101F"
                />
              </View>
              <View style={styles.label}>
                <Text style={styles.labelText} numberOfLines={1}>{point.title}</Text>
              </View>
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 2,
    borderColor: "#35F2B4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  exitMarker: {
    borderColor: "#FFB84D",
  },
  label: {
    marginTop: 3,
    maxWidth: 116,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(5,7,13,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  labelText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
});
