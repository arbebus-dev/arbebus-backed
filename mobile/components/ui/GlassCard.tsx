import { BlurView } from "expo-blur";
import React, { type ReactNode } from "react";
import { Platform, StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";

type GlassCardProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  onPress?: () => void;
  testID?: string;
};

const COLORS = {
  glass: "rgba(9, 14, 28, 0.72)",
  border: "rgba(255, 255, 255, 0.14)",
};

export default function GlassCard({ children, style, intensity = 35, onPress, testID }: GlassCardProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container style={[styles.glassCardWrap, style]} onPress={onPress} testID={testID}>
      <BlurView intensity={Platform.OS === "ios" ? intensity : 20} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.glassCardBorder} />
      <View style={styles.glassCardInner}>{children}</View>
    </Container>
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
