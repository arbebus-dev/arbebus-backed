import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useState } from "react";

import LaunchScreen from "@/core/features/launch/LaunchScreen";

// Keep the native Expo splash visible until our custom LaunchScreen is mounted.
// This prevents the splash.png flash/flicker that happens when expo-router boots fast.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [hasEnteredApp, setHasEnteredApp] = useState(false);

  const handleEnterApp = useCallback(() => {
    setHasEnteredApp(true);
  }, []);

  if (!hasEnteredApp) {
    return <LaunchScreen onStart={handleEnterApp} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
