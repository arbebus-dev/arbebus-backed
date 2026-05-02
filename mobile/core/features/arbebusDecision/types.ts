export type DecisionUrgency = "calm" | "soon" | "now" | "late";

export type TripStepType =
  | "walk_to_stop"
  | "wait_bus"
  | "board_bus"
  | "ride_bus"
  | "transfer"
  | "exit_bus"
  | "walk_to_destination"
  | "arrived";

export type ArbebusDecision = {
  title: string;
  subtitle: string;
  primaryAction: string;
  secondaryText?: string;
  urgency: DecisionUrgency;
  confidence: number;
  minutesToLeave?: number;
  busRoute?: string;
  stopName?: string;
  destinationName?: string;
  etaMinutes?: number;
  steps: ArbebusDecisionStep[];
};

export type ArbebusDecisionStep = {
  type: TripStepType;
  title: string;
  subtitle?: string;
  durationMinutes?: number;
  stopCount?: number;
  routeNumber?: string;
};