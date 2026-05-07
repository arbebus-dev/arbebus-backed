import * as Notifications from "expo-notifications";
import * as SystemUI from "expo-system-ui";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { colors } from "@/core/design";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { AppLanguage } from "@/core/i18n/translations";
import type { AppPreferences, ThemeMode } from "../accountTypes";
import { DEFAULT_PREFERENCES, loadAppPreferences, saveAppPreferences } from "../services/accountStorage";

type ThemePalette = {
  mode: ThemeMode;
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceStrong: string;
  surfaceSoft: string;
  border: string;
  text: string;
  textInverse: string;
  muted: string;
  dim: string;
  accent: string;
  danger: string;
  overlay: string;
  isLight: boolean;
};

type AppPreferencesContextValue = {
  preferences: AppPreferences;
  isReady: boolean;
  theme: ThemePalette;
  setPreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setAppLanguage: (language: AppLanguage) => Promise<void>;
  requestNotificationPermissions: () => Promise<boolean>;
};

const lightPalette: ThemePalette = {
  mode: "light",
  background: "#F5F7FB",
  backgroundElevated: "#FFFFFF",
  surface: "rgba(255,255,255,0.96)",
  surfaceStrong: "#FFFFFF",
  surfaceSoft: "rgba(7,17,31,0.055)",
  border: "rgba(7,17,31,0.12)",
  text: "#07111F",
  textInverse: "#FFFFFF",
  muted: "#667085",
  dim: "#98A2B3",
  accent: colors.accent,
  danger: colors.danger,
  overlay: "rgba(7,17,31,0.30)",
  isLight: true,
};

const darkPalette: ThemePalette = {
  mode: "dark",
  background: colors.background,
  backgroundElevated: colors.backgroundElevated,
  surface: colors.surface,
  surfaceStrong: colors.surfaceStrong,
  surfaceSoft: colors.surfaceSoft,
  border: colors.border,
  text: colors.text,
  textInverse: colors.textInverse,
  muted: colors.muted,
  dim: colors.dim,
  accent: colors.accent,
  danger: colors.danger,
  overlay: colors.overlay,
  isLight: false,
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useLanguage();
  const [preferences, setPreferences] = useState<AppPreferences>({ ...DEFAULT_PREFERENCES, language });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadAppPreferences()
      .then((stored) => {
        if (!mounted) return;
        setPreferences({ ...DEFAULT_PREFERENCES, ...stored, language: stored.language || language });
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    setPreferences((current) => {
      if (current.language === language) return current;
      const next = { ...current, language };
      void saveAppPreferences(next);
      return next;
    });
  }, [isReady, language]);

  const theme = preferences.themeMode === "light" ? lightPalette : darkPalette;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.background);
  }, [theme.background]);

  const setPreference = useCallback(async <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    await saveAppPreferences(next);
  }, [preferences]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    await setPreference("themeMode", mode);
  }, [setPreference]);

  const setAppLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    await setLanguage(nextLanguage);
    const next = { ...preferences, language: nextLanguage };
    setPreferences(next);
    await saveAppPreferences(next);
  }, [preferences, setLanguage]);

  const requestNotificationPermissions = useCallback(async () => {
    const current = await Notifications.getPermissionsAsync();
    const finalStatus = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (finalStatus.granted) {
      await Notifications.setNotificationChannelAsync("arbebus-travel", {
        name: "Arbebus travel alerts",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 180, 90, 180],
        lightColor: colors.accent,
      }).catch(() => undefined);
    }
    return finalStatus.granted;
  }, []);

  const value = useMemo<AppPreferencesContextValue>(() => ({
    preferences,
    isReady,
    theme,
    setPreference,
    setThemeMode,
    setAppLanguage,
    requestNotificationPermissions,
  }), [preferences, isReady, theme, setPreference, setThemeMode, setAppLanguage, requestNotificationPermissions]);

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const value = useContext(AppPreferencesContext);
  if (!value) throw new Error("useAppPreferences must be used inside AppPreferencesProvider");
  return value;
}

export function useAccountTheme() {
  return useAppPreferences().theme;
}
