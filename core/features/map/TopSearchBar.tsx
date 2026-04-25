import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

type Props = {
  value: string;
  isSearching?: boolean;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
};

export default function TopSearchBar({
  value,
  isSearching,
  onChangeText,
  onSubmit,
  onClear,
}: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#AEB7D8" />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder="Kur važiuojam?"
          placeholderTextColor="#7F8AB0"
          returnKeyType="search"
          autoCorrect={false}
          style={styles.input}
        />

        {isSearching ? <ActivityIndicator size="small" /> : null}

        {value.trim().length > 0 ? (
          <Pressable onPress={onClear} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color="#AEB7D8" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 58,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  searchBox: {
    minHeight: 54,
    borderRadius: 22,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(8, 13, 27, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  input: {
    flex: 1,
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 12,
  },
});
