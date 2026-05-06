import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Coordinate, PlaceSearchResult } from "../../transit/models/transitTypes";

const SAVED_PLACES_KEY = "arbebus.savedPlaces.v1";

export type SavedPlaceType = "home" | "school" | "club" | "custom";

export type SavedPlace = {
  id: string;
  type: SavedPlaceType;
  title: string;
  subtitle?: string | null;
  coordinate: Coordinate;
  place?: PlaceSearchResult | null;
  createdAt: string;
  updatedAt: string;
};

function safeParse(raw: string | null): SavedPlace[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  return safeParse(await AsyncStorage.getItem(SAVED_PLACES_KEY));
}

export async function savePlace(type: SavedPlaceType, place: PlaceSearchResult): Promise<SavedPlace> {
  const now = new Date().toISOString();
  const item: SavedPlace = {
    id: `${type}-${Date.now()}`,
    type,
    title: place.title || place.name || type,
    subtitle: place.subtitle || null,
    coordinate: place.coordinate || { latitude: Number(place.latitude), longitude: Number(place.longitude) },
    place,
    createdAt: now,
    updatedAt: now,
  };
  const existing = await getSavedPlaces();
  const next = [item, ...existing.filter((entry) => entry.type !== type || type === "custom")].slice(0, 25);
  await AsyncStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(next));
  return item;
}

export async function removeSavedPlace(id: string) {
  const existing = await getSavedPlaces();
  await AsyncStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(existing.filter((item) => item.id !== id)));
}

export async function clearSavedPlaces() {
  await AsyncStorage.removeItem(SAVED_PLACES_KEY);
}
