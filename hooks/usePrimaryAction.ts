import { SHEET_OPEN_Y } from "../constants/home";

type UsePrimaryActionParams = {
  selectedMode: string;
  isPro: boolean;
  getFinalMode: () => any;
  mediumHaptic: () => Promise<void>;
  runSmartRoute: () => Promise<void>;
  animateSheet: (toValue: number) => void;
  handleOpenProPaywall: (
    source: "smart_route" | "leave_alert" | "delay_alert" | "cta"
  ) => Promise<void>;
  handleTransportResult: (finalMode: string) => Promise<void>;
};

export function usePrimaryAction({
  selectedMode,
  isPro,
  getFinalMode,
  mediumHaptic,
  runSmartRoute,
  animateSheet,
  handleOpenProPaywall,
  handleTransportResult,
}: UsePrimaryActionParams) {
  const handlePrimaryAction = async () => {
    const finalMode = getFinalMode();
    await mediumHaptic();

    if (selectedMode === "smart" && !isPro) {
      await handleOpenProPaywall("cta");
      return;
    }

    if (selectedMode === "smart" && isPro) {
      await runSmartRoute();
      animateSheet(SHEET_OPEN_Y);
      return;
    }

    await handleTransportResult(String(finalMode));
  };

  return {
    handlePrimaryAction,
  };
}