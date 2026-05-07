import { BlurView } from "expo-blur";
import React from "react";
import { Animated, StyleSheet, ViewStyle } from "react-native";
import BottomSheetHandle from "./BottomSheetHandle";
import { useBottomSheet } from "./useBottomSheet";

export type BottomSheetProps = {
  children: React.ReactNode;
  height: number;
  initialSnap: number;
  snapPoints: readonly number[];
  minSnap: number;
  maxSnap: number;
  style?: ViewStyle;
};

export default function BottomSheet({ children, height, initialSnap, snapPoints, minSnap, maxSnap, style }: BottomSheetProps) {
  const sheet = useBottomSheet({ initialSnap, snapPoints, minSnap, maxSnap });

  return (
    <Animated.View style={[styles.shell, style, { height, transform: [{ translateY: sheet.translateY }] }]} pointerEvents="box-none">
      <BlurView intensity={88} tint="dark" style={styles.surface}>
        <Animated.View {...sheet.panHandlers}>
          <BottomSheetHandle />
        </Animated.View>
        {children}
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    zIndex: 30,
    elevation: 30,
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    backgroundColor: "rgba(5,10,18,0.98)",
  },
  surface: {
    flex: 1,
    backgroundColor: "rgba(5,10,18,0.88)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
});
