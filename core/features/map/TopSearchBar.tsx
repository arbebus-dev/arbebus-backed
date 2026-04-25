import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TransitFlowState } from "../transit/models/transitFlowState";

type Props = {
  query: string;
  flowState: TransitFlowState;
  isSearching: boolean;
  onChangeQuery: (value: string) => void;
  onClear: () => void;
};

export default function TopSearchBar({ query, flowState, isSearching, onChangeQuery, onClear }: Props) {
  const isActive = flowState === "searching" || query.length > 0;

  return (
    <View style={[styles.container, isActive && styles.containerActive]}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name="search" size={18} color="#69E1FF" />
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.label}>Arbebus v1</Text>
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Kur važiuojame? Įvesk stotelę arba vietą"
            placeholderTextColor="#7D86A3"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
        </View>

        {isSearching ? (
          <ActivityIndicator color="#69E1FF" />
        ) : query.length > 0 ? (
          <Pressable onPress={onClear} hitSlop={12} style={styles.clearButton}>
            <Ionicons name="close" size={18} color="#05070D" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 54,
    left: 16,
    right: 16,
    borderRadius: 25,
    backgroundColor: "rgba(6, 10, 20, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  containerActive: {
    borderColor: "rgba(105,225,255,0.42)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(105,225,255,0.14)",
  },
  inputWrap: { flex: 1 },
  label: { color: "#8E96B2", fontSize: 11, fontWeight: "900", marginBottom: 1 },
  input: { color: "#FFFFFF", fontSize: 15, fontWeight: "900", padding: 0 },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.68)",
  },
});
