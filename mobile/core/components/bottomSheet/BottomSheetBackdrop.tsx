import React from "react";
import { Pressable, StyleSheet } from "react-native";

export default function BottomSheetBackdrop({ visible, onPress }: { visible?: boolean; onPress?: () => void }) {
  if (!visible) return null;
  return <Pressable onPress={onPress} style={styles.backdrop} />;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
});
