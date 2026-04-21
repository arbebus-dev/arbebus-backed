import { Dimensions } from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;

export const FETCH_INTERVAL = 12000;
export const PRO_PRICE = "€2.99 / mėn";

export const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6Ijc5NjcxMTM2YmE1MTQwMGNiYjcyY2U5M2VjOGRkZDkyIiwiaCI6Im11cm11cjY0In0=";

export const TAB_BAR_HEIGHT = 72;
export const TAB_BAR_BOTTOM = 10;
export const SHEET_COLLAPSED_VISIBLE = 108;

export const SHEET_OPEN_Y = 88;
export const SHEET_MID_Y = Math.round(SCREEN_HEIGHT * 0.44);
export const SHEET_CLOSED_Y =
  SCREEN_HEIGHT - TAB_BAR_HEIGHT - TAB_BAR_BOTTOM - SHEET_COLLAPSED_VISIBLE;

export const STORAGE_KEYS = {
  onboardingSeen: "arbebus_onboarding_seen",
  homeLocation: "arbebus_home_location",
  workLocation: "arbebus_work_location",
  liveBuses: "arbebus_live_buses_cache",
  lastUpdate: "arbebus_last_update_cache",
};

export const AIRPORTS = {
  palanga: "Palangos oro uostas",
  vilnius: "Vilniaus oro uostas",
  kaunas: "Kauno oro uostas",
};