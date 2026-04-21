import { useEffect } from "react";
import Purchases from "react-native-purchases";

type UseProAccessParams = {
  setIsPro: (value: boolean) => void;
};

export function useProAccess({ setIsPro }: UseProAccessParams) {
  useEffect(() => {
    const initPurchases = async () => {
      try {
        await Purchases.configure({
          apiKey: "appl_rPBvtZmGIwWFXenWUXUJTLqrTOi",
        });

        const customerInfo = await Purchases.getCustomerInfo();

        if (customerInfo.entitlements.active["pro"]) {
          setIsPro(true);
        }
      } catch (e) {
        console.log("Purchases init error", e);
      }
    };

    initPurchases();
  }, [setIsPro]);
}