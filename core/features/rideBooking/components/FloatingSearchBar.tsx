import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type SearchField = "from" | "to";

type Props = {
  fromQuery: string;
  toQuery: string;
  activeField: SearchField;
  onFocusField: (field: SearchField) => void;
  onChangeQuery: (value: string) => void;
  onSwap: () => void;
  onClearField: (field: SearchField) => void;
};

function SearchInputRow({
  label,
  value,
  placeholder,
  active,
  field,
  onFocusField,
  onChangeQuery,
  onClearField,
  leading,
}: {
  label: string;
  value: string;
  placeholder: string;
  active: boolean;
  field: SearchField;
  onFocusField: (field: SearchField) => void;
  onChangeQuery: (value: string) => void;
  onClearField: (field: SearchField) => void;
  leading: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={() => onFocusField(field)}
      style={[styles.row, active && styles.rowActive]}
    >
      <View style={styles.leadingWrap}>{leading}</View>

      <View style={styles.inputBlock}>
        <Text style={styles.label}>{label}</Text>

        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#7F92B2"
          onFocus={() => onFocusField(field)}
          onChangeText={onChangeQuery}
          style={styles.input}
          selectionColor="#7DD3FC"
        />
      </View>

      {value ? (
        <Pressable
          onPress={() => onClearField(field)}
          style={styles.clearButton}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color="#B3C7E8" />
        </Pressable>
      ) : (
        <View style={styles.clearButtonPlaceholder} />
      )}
    </Pressable>
  );
}

export default function FloatingSearchBar({
  fromQuery,
  toQuery,
  activeField,
  onFocusField,
  onChangeQuery,
  onSwap,
  onClearField,
}: Props) {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.topGlow} />

        <SearchInputRow
          label="Iš kur"
          value={fromQuery}
          placeholder="Current location"
          active={activeField === "from"}
          field="from"
          onFocusField={onFocusField}
          onChangeQuery={onChangeQuery}
          onClearField={onClearField}
          leading={<View style={styles.fromDot} />}
        />

        <View style={styles.middleWrap}>
          <View style={styles.middleLine} />

          <Pressable onPress={onSwap} style={styles.swapButton} hitSlop={10}>
            <MaterialCommunityIcons
              name="swap-vertical"
              size={18}
              color="#EAF2FF"
            />
          </Pressable>
        </View>

        <SearchInputRow
          label="Į kur"
          value={toQuery}
          placeholder="Įvesk adresą, vietą ar POI"
          active={activeField === "to"}
          field="to"
          onFocusField={onFocusField}
          onChangeQuery={onChangeQuery}
          onClearField={onClearField}
          leading={
            <MaterialCommunityIcons
              name="map-marker-radius-outline"
              size={18}
              color="#7CE7A2"
            />
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 88,
    left: 16,
    right: 16,
    zIndex: 28,
  },
  card: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "rgba(8, 16, 31, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  topGlow: {
    position: "absolute",
    top: -16,
    left: 34,
    right: 34,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(71, 182, 255, 0.08)",
  },
  row: {
    minHeight: 58,
    borderRadius: 20,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  rowActive: {
    backgroundColor: "rgba(88, 173, 255, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(88, 173, 255, 0.18)",
  },
  leadingWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  inputBlock: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 6,
  },
  label: {
    color: "#91A8CC",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  input: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    paddingVertical: 2,
  },
  clearButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 8,
  },
  clearButtonPlaceholder: {
    width: 34,
    height: 34,
    marginLeft: 8,
  },
  middleWrap: {
    position: "relative",
    justifyContent: "center",
    marginVertical: 8,
    minHeight: 24,
  },
  middleLine: {
    height: 1,
    marginHorizontal: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  swapButton: {
    position: "absolute",
    right: 6,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(61, 184, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(61, 184, 255, 0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  fromDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#60A5FA",
  },
});