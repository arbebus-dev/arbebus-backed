// core/features/rideBooking/models/placeSuggestion.ts
export type PlaceSuggestionKind =
  | "address"
  | "street"
  | "venue"
  | "station"
  | "locality"
  | "region"
  | "recent"
  | "saved"
  | "current"
  | "unknown";

export type PlaceSuggestionSource = "ors" | "recent" | "saved" | "device";

export type PlaceSuggestion = {
  id: string;
  title: string;
  subtitle?: string;
  kind?: PlaceSuggestionKind;
  source?: PlaceSuggestionSource;
  accentLabel?: string;
};