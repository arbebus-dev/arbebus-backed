import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useState } from "react";
import { View } from "react-native";

import LaunchScreen from "@/core/features/launch/LaunchScreen";
import { AppPreferencesProvider } from "@/core/features/account/context/AppPreferencesContext";
import { LanguageProvider, useLanguage } from "@/core/i18n/LanguageContext";
import type { AppLanguage } from "@/core/i18n/translations";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootLayoutInner() {
  const { isLanguageReady, setLanguage } = useLanguage();

  // IMPORTANT:
  // Arbebus must show the LT / EN launch screen on every fresh app open.
  // We still save language for UI text after selection, but we never use
  // saved language to skip the launch screen.
  const [hasEnteredApp, setHasEnteredApp] = useState(false);

  const handleSelectLanguage = useCallback(
    async (language: AppLanguage) => {
      await setLanguage(language);
      setHasEnteredApp(true);
    },
    [setLanguage],
  );

  if (!isLanguageReady) {
    return <View style={{ flex: 1, backgroundColor: "#03070B" }} />;
  }

  if (!hasEnteredApp) {
    return <LaunchScreen onSelectLanguage={handleSelectLanguage} />;
  }

  return (
    <AppPreferencesProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AppPreferencesProvider>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <RootLayoutInner />
    </LanguageProvider>
  );
}
