import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  cityLabel?: string;
  temperature?: number | null;
  weatherLabel?: string;
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
};

export function AiHudCard({
  cityLabel = "Klaipėda",
  temperature = null,
  weatherLabel = "Kraunami orai...",
  iconName = "partly-sunny-outline",
}: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          Alert.alert(
            "Orai dabar",
            `${cityLabel}\n${
              temperature != null ? `${temperature}°C` : "—"
            }\n${weatherLabel}`
          );
        }}
      >
        <View style={styles.aiStatusHud}>
          <View style={styles.aiHudGlow} />
          <View style={styles.aiStatusRow}>
            <View style={styles.aiStatusDot} />

            <View style={styles.aiStatusTextWrap}>
              <Text style={styles.aiStatusLabel}>ARBEBUS AI</Text>
              <Text style={styles.aiStatusValue}>
                {temperature != null
                  ? `${cityLabel} • ${temperature}°C • ${weatherLabel}`
                  : `${cityLabel} • ${weatherLabel}`}
              </Text>
            </View>

            <Ionicons
              name={iconName}
              size={18}
              color="#DCE7FF"
              style={{ marginLeft: 10 }}
            />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 108,
    left: 16,
    right: 16,
    zIndex: 19,
    alignItems: "center",
  },

  aiStatusHud: {
    width: "100%",
    maxWidth: 270,
    minHeight: 54,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(7,18,38,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    overflow: "hidden",
  },

  aiHudGlow: {
    position: "absolute",
    top: -20,
    left: 18,
    width: 120,
    height: 60,
    borderRadius: 60,
    backgroundColor: "rgba(56,189,248,0.08)",
  },

  aiStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  aiStatusTextWrap: {
    flex: 1,
    justifyContent: "center",
  },

  aiStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#38BDF8",
    marginRight: 10,
    shadowColor: "#38BDF8",
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  aiStatusLabel: {
    color: "#8ED8FF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  aiStatusValue: {
    color: "#AFC3E6",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});