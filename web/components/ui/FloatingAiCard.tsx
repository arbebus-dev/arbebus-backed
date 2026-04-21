import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import GlassCard from "./GlassCard";

export default function FloatingAiCard({
  visible,
  title,
  subtitle,
}: any) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={{ opacity }}>
      <GlassCard>
        <View style={{ padding: 14 }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>{title}</Text>
          <Text style={{ color: "#AFC3E6" }}>{subtitle}</Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
}