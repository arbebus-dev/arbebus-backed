import { useMemo, useState } from "react";
import { PaywallSource } from "../types/home";

type PaywallCopy = {
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
};

export function usePaywall() {
  const [showPaywall, setShowPaywall] = useState(false);
  const [showProSheet, setShowProSheet] = useState(false);
  const [paywallSource, setPaywallSource] = useState<PaywallSource>(null);

  const openProPaywall = (source: Exclude<PaywallSource, null>) => {
    setPaywallSource(source);
    setShowProSheet(true);
  };

  const closeAllPaywalls = () => {
    setShowPaywall(false);
    setShowProSheet(false);
    setPaywallSource(null);
  };

  const paywallCopy: PaywallCopy = useMemo(() => {
    switch (paywallSource) {
      case "smart_route":
        return {
          badge: "7 dienų nemokamas išbandymas",
          title: "Arbebus Pro",
          subtitle: "AI randa greičiausią kelią mieste",
          bullets: [
            "Sutaupyk iki 10 min kasdien",
            "AI parenka greičiausią maršrutą",
            "Rekomendacijos realiu laiku",
            "Išmanūs persėdimai",
            "Be reklamų",
          ],
        };

      case "leave_alert":
        return {
          badge: "PRO funkcija",
          title: "Leave Alerts",
          subtitle: "Gauk pranešimą kada laikas išeiti",
          bullets: [
            "Priminimas prieš išvykimą",
            "Mažiau streso ryte",
            "Mažiau pavėlavimų",
            "Pririšta prie realaus transporto",
            "Tik PRO nariams",
          ],
        };

      case "delay_alert":
        return {
          badge: "PRO funkcija",
          title: "Delay Alerts",
          subtitle: "Gauk įspėjimą jei transportas vėluoja",
          bullets: [
            "Delay detected realiu laiku",
            "Perspėjimas apie selected bus",
            "Mažiau netikėtumų",
            "Smart route update signalas",
            "Tik PRO nariams",
          ],
        };

      case "cta":
      default:
        return {
          badge: "7 dienų nemokamas išbandymas",
          title: "Arbebus Pro",
          subtitle: "Sutaupyk laiką kasdien su Smart Route",
          bullets: [
            "Greičiausias kelias vienu tap",
            "Pranešimai kada išeiti",
            "Delay alerts realiu laiku",
            "Mažiau streso ir vėlavimų",
            "Premium patirtis be reklamų",
          ],
        };
    }
  }, [paywallSource]);

  return {
    showPaywall,
    showProSheet,
    paywallSource,
    paywallCopy,
    setShowPaywall,
    setShowProSheet,
    setPaywallSource,
    openProPaywall,
    closeAllPaywalls,
  };
}