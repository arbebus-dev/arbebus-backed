import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import UltraPressable from "./UltraPressable";

type ModeChipProps = {
  label: string;
  icon: string;
  active?: boolean;
  onPress?: () => void;
};

export default function ModeChip({ label, icon, active = false, onPress }: ModeChipProps) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [active, anim]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(9,14,28,0.76)", "rgba(53,242,180,0.24)"],
  });

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.12)", "rgba(53,242,180,0.85)"],
  });

  return (
    <UltraPressable onPress={onPress}>
      <Animated.View style={[styles.modeChip, { backgroundColor, borderColor }]}> 
        <MaterialCommunityIcons name={icon as any} size={15} color={active ? "#FFFFFF" : "#AFC4EA"} />
        <Text style={styles.modeChipText}>{label}</Text>
      </Animated.View>
    </UltraPressable>
  );
}

const styles = StyleSheet.create({
  modeChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modeChipText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
