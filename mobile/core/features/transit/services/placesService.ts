import { searchPlaces, type PlaceResult } from "./transitApi";

export type { PlaceResult };

export async function searchPlacesService(query: string): Promise<PlaceResult[]> {
  const q = String(query || "").replace(/\s{2,}/g, " ").trim();

  if (q.length < 2) return [];

  return searchPlaces(q);
}

export default {
  search: searchPlacesService,
};
