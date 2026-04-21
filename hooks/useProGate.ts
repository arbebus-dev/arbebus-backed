import { Alert } from "react-native";

type ProSource = "smart_route" | "leave_alert" | "delay_alert" | "cta";

type UseProGateParams = {
  isPro: boolean;
  openPaywall: (source: ProSource) => Promise<void>;
};

export function useProGate({ isPro, openPaywall }: UseProGateParams) {
  const requirePro = async (source: ProSource) => {
    if (isPro) return true;
    await openPaywall(source);
    return false;
  };

  const requireProOrAlert = async (
    source: ProSource,
    title: string,
    message: string
  ) => {
    if (isPro) return true;

    Alert.alert(title, message, [
      {
        text: "Ne dabar",
        style: "cancel",
      },
      {
        text: "Atrakinti PRO",
        onPress: () => {
          void openPaywall(source);
        },
      },
    ]);

    return false;
  };

  return {
    requirePro,
    requireProOrAlert,
  };
}