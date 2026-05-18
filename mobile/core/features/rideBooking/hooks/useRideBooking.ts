// Compatibility layer for the target Arbebus architecture.
// The real production planner currently lives in core/features/transit/hooks/useTransitPlanner.
export { useTransitPlanner as useRideBooking } from "../../transit/hooks/useTransitPlanner";
export { useTransitPlanner } from "../../transit/hooks/useTransitPlanner";
