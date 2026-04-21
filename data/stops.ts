import type { TransitStop } from "../core/services/transit";

export const TRANSIT_STOPS: TransitStop[] = [
  {
    id: "klaipeda-akropolis",
    name: "Akropolis",
    latitude: 55.6886,
    longitude: 21.1589,
    routes: ["8", "10", "12"],
  },
  {
    id: "klaipeda-atgimimo-aikste",
    name: "Atgimimo aikštė",
    latitude: 55.7112,
    longitude: 21.1315,
    routes: ["8", "9", "10", "12"],
  },
  {
    id: "klaipeda-universitetas",
    name: "Universitetas",
    latitude: 55.7188,
    longitude: 21.1198,
    routes: ["8", "10"],
  },
  {
    id: "klaipeda-ligonine",
    name: "Ligoninė",
    latitude: 55.7235,
    longitude: 21.1401,
    routes: ["12", "14"],
  },
  {
    id: "klaipeda-taikos-pr",
    name: "Taikos pr.",
    latitude: 55.6955,
    longitude: 21.165,
    routes: ["8", "12"],
  },
];