import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import LaunchScreen from "../core/features/launch/LaunchScreen";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [launchDone, setLaunchDone] = useState(false);

  const handleStart = useCallback(() => {
    setLaunchDone(true);
  }, []);

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
      {!launchDone && <LaunchScreen onStart={handleStart} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#05070d",
  },
});
