import { useAppPreferences } from "@/core/features/account/context/AppPreferencesContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TextInput, View } from "react-native";

type Props = { value: string; placeholder: string; onChangeText: (text: string) => void; onSubmit?: () => void };

export default function FloatingSearchBar({ value, placeholder, onChangeText, onSubmit }: Props) {
  const { theme } = useAppPreferences();
  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
      <Ionicons name="search" size={17} color={theme.dim} />
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={theme.dim}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        autoCorrect={false}
        autoCapitalize="words"
        keyboardType="default"
        returnKeyType="search"
        style={[styles.input, { color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 50, borderRadius: 25, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1 },
  input: { flex: 1, fontSize: 15, fontWeight: "800", paddingVertical: 0 },
});
