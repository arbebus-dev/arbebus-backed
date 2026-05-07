import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
} from "react";

import { useLanguageStore } from "../state/languageStore";
import {
    AppLanguage,
    LANGUAGE_STORAGE_KEY,
    translations,
} from "./translations";

type LanguageContextValue = {
  language: AppLanguage;
  hasLanguageChoice: boolean;
  isLanguageReady: boolean;
  setLanguage: (next: AppLanguage) => Promise<void>;
  t: (typeof translations)[AppLanguage];
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const store = useLanguageStore();

  useEffect(() => {
    // Initialize from storage if not ready
    if (!store.isLanguageReady) {
      AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
        if (stored === "lt" || stored === "en") {
          store.setLanguage(stored);
        }
        store.setLanguageReady();
      });
    }
  }, [store]);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    store.setLanguage(next);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language: store.language,
      hasLanguageChoice: store.hasLanguageChoice,
      isLanguageReady: store.isLanguageReady,
      setLanguage,
      t: translations[store.language],
    }),
    [
      store.language,
      store.hasLanguageChoice,
      store.isLanguageReady,
      setLanguage,
    ],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return value;
}
