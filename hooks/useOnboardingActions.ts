import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/home";

type UseOnboardingActionsParams = {
  onboardingStep: number;
  onboardingSlidesLength: number;
  setOnboardingStep: React.Dispatch<React.SetStateAction<number>>;
  setShowOnboarding: (value: boolean) => void;
  tapHaptic: () => Promise<void>;
};

export function useOnboardingActions({
  onboardingStep,
  onboardingSlidesLength,
  setOnboardingStep,
  setShowOnboarding,
  tapHaptic,
}: UseOnboardingActionsParams) {
  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.onboardingSeen, "true");
    } catch (e) {
      console.log("Onboarding save error:", e);
    }

    setShowOnboarding(false);
  };

  const handleNextOnboardingStep = async () => {
    await tapHaptic();

    if (onboardingStep < onboardingSlidesLength - 1) {
      setOnboardingStep((prev) => prev + 1);
      return;
    }

    await completeOnboarding();
  };

  const handleSkipOnboarding = async () => {
    await tapHaptic();
    await completeOnboarding();
  };

  return {
    completeOnboarding,
    handleNextOnboardingStep,
    handleSkipOnboarding,
  };
}