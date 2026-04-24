import { useMemo } from "react";
import type { TransitPlan } from "../../../services/transit/plannerTypes";

type RideUiStatus =
  | "idle"
  | "searching"
  | "place_selected"
  | "route_preview"
  | "journey_active"
  | "near_stop"
  | "board_now"
  | "ride_in_progress"
  | "exit_now"
  | "arrived";

export function useRideState({
  flowState,
  rideStatus,
  transitPlan,
  hasDestination,
  hasResults,
}: {
  flowState?: string | null;
  rideStatus?: string | null;
  transitPlan?: TransitPlan | null;
  hasDestination?: boolean;
  hasResults?: boolean;
}) {
  return useMemo(() => {
    const boardingState = transitPlan?.summary.boardingState;

    let status: RideUiStatus = "idle";

    if (rideStatus === "ride_completed") {
      status = "arrived";
    } else if (rideStatus === "ride_started") {
      status = "ride_in_progress";
    } else if (boardingState === "exit_now") {
      status = "exit_now";
    } else if (boardingState === "board_now") {
      status = "board_now";
    } else if (boardingState === "ready_to_board" || boardingState === "boarding_soon") {
      status = "near_stop";
    } else if (transitPlan && hasDestination) {
      status = "journey_active";
    } else if (flowState === "loadingRoute" || hasResults) {
      status = "searching";
    } else if (flowState === "routePreview" && hasDestination) {
      status = "route_preview";
    } else if (hasDestination) {
      status = "place_selected";
    }

    const ctaLabel =
      status === "board_now"
        ? "Lipk dabar"
        : status === "exit_now"
        ? "Išlipk dabar"
        : status === "near_stop"
        ? "Lauk autobuso"
        : status === "ride_in_progress"
        ? "Kelionė vyksta"
        : status === "journey_active" || status === "route_preview"
        ? "Eik iki stotelės"
        : "Kur važiuojam?";

    return {
      status,
      ctaLabel,
      boardingState,
    };
  }, [flowState, hasDestination, hasResults, rideStatus, transitPlan]);
}
