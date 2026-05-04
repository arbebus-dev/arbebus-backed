import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { AppLanguage, isAppLanguage, LANGUAGE_STORAGE_KEY, translations } from "./translations";

type LanguageContextValue = {
  language: AppLanguage;
  hasLanguageChoice: boolean;
  isLanguageReady: boolean;
  setLanguage: (next: AppLanguage) => Promise<void>;
  t: (typeof translations)[AppLanguage];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("lt");
  const [hasLanguageChoice, setHasLanguageChoice] = useState(false);
  const [isLanguageReady, setIsLanguageReady] = useState(false);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        if (isAppLanguage(stored)) {
          setLanguageState(stored);
          setHasLanguageChoice(true);
        }
      })
      .finally(() => {
        if (active) setIsLanguageReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    setLanguageState(next);
    setHasLanguageChoice(true);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    hasLanguageChoice,
    isLanguageReady,
    setLanguage,
    t: translations[language],
  }), [hasLanguageChoice, isLanguageReady, language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return value;
}
