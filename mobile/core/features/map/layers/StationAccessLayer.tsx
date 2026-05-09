import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";
import type { StationAccessPoint } from "../../transit/services/transitApi";

type Props = { accessPoints: StationAccessPoint[]; selectedStopId?: string | null };

export default function StationAccessLayer({ accessPoints }: Props) {
  const { theme } = useAppPreferences();
  if (!accessPoints?.length) return null;

  return (
    <>
      {accessPoints.map((point) => {
        const isExit = point.type === "exit";
        return (
          <Marker key={point.id} coordinate={point.coordinate} anchor={{ x: 0.5, y: 0.9 }} tracksViewChanges={false} zIndex={360}>
            <View style={styles.wrap}>
              <View style={[styles.marker, { backgroundColor: theme.backgroundElevated, borderColor: isExit ? "#FFB84D" : theme.accent, shadowColor: theme.shadow }]}> 
                <Ionicons name={isExit ? "exit-outline" : "enter-outline"} size={12} color={theme.text} />
              </View>
              <View style={[styles.label, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
                <Text style={[styles.labelText, { color: theme.text }]} numberOfLines={1}>{point.title}</Text>
              </View>
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  marker: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center", shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  label: { marginTop: 3, maxWidth: 116, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  labelText: { fontSize: 9, fontWeight: "800" },
});
