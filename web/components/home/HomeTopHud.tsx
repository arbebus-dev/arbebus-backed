import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { WeatherNow } from "../../types/home";

type Props = {
  weatherNow?: WeatherNow | null;
  tapHaptic?: () => Promise<void>;
  onOpenAi: () => void;
};

function getWeatherLabel(weatherNow?: WeatherNow | null) {
  if (!weatherNow) return "No weather";

  return typeof weatherNow.temperature === "number"
    ? `${Math.round(weatherNow.temperature)}°`
    : "--°";
}

function getWeatherSubLabel(weatherNow?: WeatherNow | null) {
  if (!weatherNow) return "Live weather";

  if (typeof weatherNow.windSpeed === "number") {
    return `Wind ${Math.round(weatherNow.windSpeed)} m/s`;
  }

  return "Live weather";
}

export default function HomeTopHud({
  weatherNow,
  tapHaptic,
  onOpenAi,
}: Props) {
  const handleAi = async () => {
    await tapHaptic?.();
    onOpenAi();
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.weatherCard}>
          <View style={styles.weatherIconWrap}>
            <Ionicons name="partly-sunny-outline" size={16} color="#FFD782" />
          </View>

          <View style={styles.weatherTextWrap}>
            <Text style={styles.weatherValue}>{getWeatherLabel(weatherNow)}</Text>
            <Text style={styles.weatherSubValue}>
              {getWeatherSubLabel(weatherNow)}
            </Text>
          </View>
        </View>

        <Pressable onPress={handleAi} style={styles.aiButton}>
          <MaterialCommunityIcons name="brain" size={20} color="#EAF2FF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    zIndex: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  weatherCard: {
    flex: 1,
    minHeight: 46,
    borderRadius: 24,
    backgroundColor: "rgba(8,16,31,0.80)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  weatherIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  weatherTextWrap: {
    flex: 1,
  },
  weatherValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  weatherSubValue: {
    color: "#9FB1CC",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  aiButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginLeft: 10,
    backgroundColor: "rgba(8,16,31,0.80)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
});