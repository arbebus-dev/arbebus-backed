import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { AppLanguage, LANGUAGE_STORAGE_KEY } from "../i18n/translations";

interface LanguageState {
  language: AppLanguage;
  hasLanguageChoice: boolean;
  isLanguageReady: boolean;
  setLanguage: (next: AppLanguage) => void;
  setLanguageReady: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "lt",
      hasLanguageChoice: false,
      isLanguageReady: false,
      setLanguage: (next: AppLanguage) =>
        set({ language: next, hasLanguageChoice: true }),
      setLanguageReady: () => set({ isLanguageReady: true }),
    }),
    {
      name: LANGUAGE_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        language: state.language,
        hasLanguageChoice: state.hasLanguageChoice,
      }),
    },
  ),
);
