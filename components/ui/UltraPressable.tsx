import React, { useRef } from "react";
import { Animated, Pressable } from "react-native";

export default function UltraPressable({
  onPress,
  onLongPress,
  disabled,
  style,
  children,
}: any) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      damping: 18,
      stiffness: 260,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animateTo(0.98)}
      onPressOut={() => animateTo(1)}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}