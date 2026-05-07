import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import GlassCard from "./GlassCard";

export default function FloatingAiCard({
  visible,
  title,
  subtitle,
  onPress,
}: any) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={{ opacity }}>
      <GlassCard onPress={onPress} testID="floating-ai-card">
        <View style={{ padding: 14 }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>{title}</Text>
          <Text style={{ color: "#AFC3E6" }}>{subtitle}</Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
}