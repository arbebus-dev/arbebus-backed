import { BlurView } from "expo-blur";
import React, { type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type GlassCardProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
};

const COLORS = {
  glass: "rgba(9, 14, 28, 0.72)",
  border: "rgba(255, 255, 255, 0.14)",
};

export default function GlassCard({ children, style, intensity = 35 }: GlassCardProps) {
  return (
    <View style={[styles.glassCardWrap, style]}>
      <BlurView intensity={Platform.OS === "ios" ? intensity : 20} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View pointerEvents="none" style={styles.glassCardBorder} />
      <View style={styles.glassCardInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassCardWrap: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: COLORS.glass,
  },
  glassCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
  },
  glassCardInner: {
    padding: 16,
  },
});
