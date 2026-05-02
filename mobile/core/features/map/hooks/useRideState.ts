import { useMemo } from "react";
import type { TransitFlowState, TransitRouteOption } from "../../transit/models/transitTypes";

export type RideUiStatus =
  | "idle"
  | "searching"
  | "route_preview"
  | "walking"
  | "waiting_bus"
  | "onboard"
  | "transfer"
  | "arriving"
  | "completed";

type Params = {
  flowState: TransitFlowState;
  selectedRoute?: TransitRouteOption | null;
};

export function useRideState({ flowState, selectedRoute }: Params) {
  return useMemo(() => {
    const statusMap: Record<TransitFlowState, RideUiStatus> = {
      idle: "idle",
      searching: "searching",
      destination_selected: "searching",
      routes_loading: "searching",
      route_options: "route_preview",
      route_selected: "route_preview",
      walking_to_stop: "walking",
      waiting_bus: "waiting_bus",
      onboard: "onboard",
      transfer: "transfer",
      arriving: "arriving",
      completed: "completed",
    };

    const status = statusMap[flowState] ?? "idle";
    const ctaLabel =
      status === "walking"
        ? "Eik iki stotelės"
        : status === "waiting_bus"
          ? "Lauk autobuso"
          : status === "onboard"
            ? `Važiuok ${selectedRoute?.stopCount ?? 0} st.`
            : status === "arriving"
              ? "Išlipk dabar"
              : status === "completed"
                ? "Atvykai"
                : "Kur važiuojam?";

    return { status, ctaLabel };
  }, [flowState, selectedRoute]);
}
