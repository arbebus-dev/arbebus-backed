import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

export default function TopSearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView intensity={55} tint="light" style={styles.card}>
        <Ionicons name="search" size={20} color="#334155" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder="Kur važiuoji?"
          placeholderTextColor="#64748B"
          returnKeyType="search"
          style={styles.input}
        />
        {value.length > 0 ? (
          <Pressable onPress={onClear} hitSlop={12}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </Pressable>
        ) : null}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, top: 58, zIndex: 20 },
  card: {
    height: 56,
    borderRadius: 22,
    overflow: "hidden",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },
  input: { flex: 1, color: "#0F172A", fontSize: 16, fontWeight: "700" },
});
