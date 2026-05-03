import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { COLORS, LINE_HEIGHT, T } from "@/core/theme/typography";

type Props = {
  value: string;
  isSearching?: boolean;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
};

export default function TopSearchBar({ value, isSearching, onChangeText, onSubmit, onClear }: Props) {
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#AEB7D8" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder="Kur važiuojam? Pvz. Akropolis"
          placeholderTextColor="#7F8AB0"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
          style={styles.input}
        />
        {isSearching ? <ActivityIndicator size="small" color={COLORS.green} /> : null}
        {value.trim().length > 0 ? (
          <Pressable onPress={onClear} hitSlop={12} style={styles.clearButton}>
            <Ionicons name="close-circle" size={19} color="#AEB7D8" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", top: 58, left: 16, right: 16, zIndex: 45, elevation: 45 },
  searchBox: { minHeight: 52, borderRadius: 22, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(8, 13, 27, 0.94)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  input: { flex: 1, color: "white", fontSize: T.body, lineHeight: LINE_HEIGHT.body, fontWeight: "700", paddingVertical: 11 },
  clearButton: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
