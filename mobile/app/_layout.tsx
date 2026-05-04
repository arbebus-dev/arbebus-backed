import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useState } from "react";
import { View } from "react-native";

import LaunchScreen from "@/core/features/launch/LaunchScreen";
import { LanguageProvider, useLanguage } from "@/core/i18n/LanguageContext";
import type { AppLanguage } from "@/core/i18n/translations";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootLayoutInner() {
  const { isLanguageReady, setLanguage } = useLanguage();
  const [hasEnteredApp, setHasEnteredApp] = useState(false);

  const handleSelectLanguage = useCallback(async (language: AppLanguage) => {
    await setLanguage(language);
    setHasEnteredApp(true);
  }, [setLanguage]);

  if (!isLanguageReady) {
    return <View style={{ flex: 1, backgroundColor: "#03070B" }} />;
  }

  if (!hasEnteredApp) {
    return <LaunchScreen onSelectLanguage={handleSelectLanguage} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <RootLayoutInner />
    </LanguageProvider>
  );
}
