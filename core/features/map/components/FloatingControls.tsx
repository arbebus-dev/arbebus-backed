import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function FloatingControls({ onLocate, onRefresh }: { onLocate: () => void; onRefresh?: () => void }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView intensity={55} tint="light" style={styles.card}>
        <Pressable onPress={onLocate} style={styles.button}>
          <Ionicons name="navigate" size={18} color="#0F172A" />
          <Text style={styles.text}>Mano vieta</Text>
        </Pressable>
        {onRefresh ? (
          <Pressable onPress={onRefresh} style={styles.iconButton}>
            <Ionicons name="refresh" size={18} color="#0F172A" />
          </Pressable>
        ) : null}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16, top: 126, zIndex: 25 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    overflow: "hidden",
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
  },
  button: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, height: 38 },
  iconButton: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(241,245,249,0.85)" },
  text: { color: "#0F172A", fontSize: 12, fontWeight: "900" },
});
