export type TransitFlowState =
  | "idle"
  | "searching"
  | "destination_selected"
  | "routes_loading"
  | "route_options"
  | "route_selected"
  | "walking_to_stop"
  | "waiting_bus"
  | "onboard"
  | "transfer"
  | "arriving"
  | "completed";
