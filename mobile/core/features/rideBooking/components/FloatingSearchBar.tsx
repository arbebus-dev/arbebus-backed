import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
};

export default function FloatingSearchBar({ value, placeholder, onChangeText, onSubmit }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={17} color="rgba(255,255,255,0.64)" />
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.54)"
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        autoCorrect={false}
        autoCapitalize="words"
        keyboardType="default"
        returnKeyType="search"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 50, borderRadius: 25, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(3,7,18,0.88)" },
  input: { flex: 1, color: "#FFFFFF", fontSize: 15, fontWeight: "800", paddingVertical: 0 },
});
