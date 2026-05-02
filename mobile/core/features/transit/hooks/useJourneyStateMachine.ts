import { useMemo } from "react";
import type { TransitFlowState, TransitRouteOption } from "../models/transitTypes";
import { buildJourneyViewModel } from "../models/journeyStateMachine";

export function useJourneyStateMachine(
  flowState: TransitFlowState,
  selectedRoute: TransitRouteOption | null,
  currentStepIndex = 0
) {
  return useMemo(
    () => buildJourneyViewModel(flowState, selectedRoute, currentStepIndex),
    [flowState, selectedRoute, currentStepIndex]
  );
}
