import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { STORAGE_KEYS } from "../constants/home";

type UseHomeBootstrapParams = {
  loadCachedBuses: () => Promise<void>;
  setShowOnboarding: (value: boolean) => void;
  setHomeLocation: (value: string | null) => void;
  setWorkLocation: (value: string | null) => void;
  setInitialDataLoaded: (value: boolean) => void;
};

export function useHomeBootstrap({
  loadCachedBuses,
  setShowOnboarding,
  setHomeLocation,
  setWorkLocation,
  setInitialDataLoaded,
}: UseHomeBootstrapParams) {
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [seenOnboarding, savedHome, savedWork] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.onboardingSeen),
          AsyncStorage.getItem(STORAGE_KEYS.homeLocation),
          AsyncStorage.getItem(STORAGE_KEYS.workLocation),
        ]);

        if (!seenOnboarding) {
          setShowOnboarding(true);
        }

        if (savedHome) setHomeLocation(savedHome);
        if (savedWork) setWorkLocation(savedWork);

        await loadCachedBuses();
      } catch (error) {
        console.log("Bootstrap storage error:", error);
      } finally {
        setInitialDataLoaded(true);
      }
    };

    bootstrap();
  }, [
    loadCachedBuses,
    setHomeLocation,
    setInitialDataLoaded,
    setShowOnboarding,
    setWorkLocation,
  ]);
}