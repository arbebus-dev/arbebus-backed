import React from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import type { TransitStop } from "../../transit/models/transitRoute";

type Props = { stops: TransitStop[]; selectedStop?: TransitStop | null };

export default function StopsLayer({ stops, selectedStop }: Props) {
  const allStops = selectedStop ? [selectedStop, ...stops.filter((stop) => stop.id !== selectedStop.id)] : stops;
  return (
    <>
      {allStops.map((stop) => {
        const selected = selectedStop?.id === stop.id;
        return (
          <Marker key={stop.id} coordinate={stop.coordinate} title={stop.title} description={stop.subtitle} tracksViewChanges={false}>
            <View style={[styles.stop, selected && styles.selectedStop]}>
              <View style={[styles.inner, selected && styles.selectedInner]} />
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  stop: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(105,225,255,0.22)", borderWidth: 1, borderColor: "#69E1FF" },
  selectedStop: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(105,255,150,0.26)", borderColor: "#6DFF8F" },
  inner: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#69E1FF" },
  selectedInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#6DFF8F" },
});
