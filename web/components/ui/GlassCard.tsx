import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import styles from "../../styles";

export default function GlassCard({ children, style, intensity = 35 }: any) {
  return (
    <View style={[styles.glassCardWrap, style]}>
      <BlurView
        intensity={Platform.OS === "ios" ? intensity : 20}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassCardBorder} />
      <View style={styles.glassCardInner}>{children}</View>
    </View>
  );
}