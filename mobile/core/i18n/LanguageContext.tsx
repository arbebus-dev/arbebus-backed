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
    LEGACY_LANGUAGE_STORAGE_KEY,
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
      const resolveLanguage = async () => {
        const keys = [LANGUAGE_STORAGE_KEY, LEGACY_LANGUAGE_STORAGE_KEY];
        let nextLanguage: AppLanguage | null = null;

        for (const key of keys) {
          const stored = await AsyncStorage.getItem(key);
          if (!stored) continue;

          try {
            const parsed = JSON.parse(stored);
            if (parsed?.language === "lt" || parsed?.language === "en") {
              nextLanguage = parsed.language;
              break;
            }
          } catch {
            // ignore invalid JSON
          }

          if (stored === "lt" || stored === "en") {
            nextLanguage = stored;
            break;
          }
        }

        if (nextLanguage) {
          store.setLanguage(nextLanguage);
        }

        store.setLanguageReady();
      };

      resolveLanguage();
    }
  }, [store]);

  const setLanguage = useCallback(
    async (next: AppLanguage) => {
      store.setLanguage(next);
    },
    [store],
  );

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
