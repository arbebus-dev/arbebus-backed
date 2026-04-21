import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";
import styles from "../../styles";
import UltraPressable from "./UltraPressable";

export default function ModeChip({ label, icon, active, onPress }: any) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [active]);

  return (
    <UltraPressable onPress={onPress}>
      <Animated.View style={styles.modeChip}>
        <MaterialCommunityIcons
          name={icon}
          size={15}
          color={active ? "#fff" : "#AFC4EA"}
        />
        <Text style={styles.modeChipText}>{label}</Text>
      </Animated.View>
    </UltraPressable>
  );
}