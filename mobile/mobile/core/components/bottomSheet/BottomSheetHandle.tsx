import React from "react";
import { StyleSheet, View } from "react-native";

export default function BottomSheetHandle() {
  return (
    <View style={styles.wrap}>
      <View style={styles.handle} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    width: 64,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.30)",
  },
});
