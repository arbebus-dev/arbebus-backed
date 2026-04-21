import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  enabled: boolean;
  busy?: boolean;
  summary?: string;
  onPress: () => void;
};

export default function HomeLeaveAlertButton({
  visible,
  enabled,
  busy = false,
  summary,
  onPress,
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        disabled={busy}
        style={[styles.button, enabled && styles.buttonEnabled]}
      >
        <View style={styles.left}>
          <View style={[styles.iconWrap, enabled && styles.iconWrapEnabled]}>
            <Ionicons
              name={enabled ? "notifications" : "notifications-outline"}
              size={18}
              color={enabled ? "#07101D" : "#DCEBFF"}
            />
          </View>

          <View style={styles.textWrap}>
            <Text style={[styles.title, enabled && styles.titleEnabled]}>
              {enabled ? "Leave Alert ON" : "Leave Alert PRO"}
            </Text>
            <Text style={[styles.subtitle, enabled && styles.subtitleEnabled]}>
              {busy ? "Updating..." : summary || "Notify me when it is time to leave"}
            </Text>
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={enabled ? "#07101D" : "#AFC3E6"}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 170,
  },
  button: {
    minHeight: 62,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(8,14,28,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 24,
  },
  buttonEnabled: {
    backgroundColor: "#7CFFB2",
    borderColor: "#7CFFB2",
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconWrapEnabled: {
    backgroundColor: "rgba(7,16,29,0.15)",
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  titleEnabled: {
    color: "#07101D",
  },
  subtitle: {
    color: "#AFC3E6",
    fontSize: 12,
    fontWeight: "700",
  },
  subtitleEnabled: {
    color: "rgba(7,16,29,0.78)",
  },
});