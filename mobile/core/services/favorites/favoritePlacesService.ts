import AsyncStorage from "@react-native-async-storage/async-storage";

export type FavoritePlace = {
  id: string;
  title: string;
  subtitle?: string;
  type?: string;
  latitude?: number;
  longitude?: number;
  coordinate?: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
};

const STORAGE_KEY = "arbebus.favoritePlaces.v1";

function normalizeFavoritePlace(place: FavoritePlace): FavoritePlace {
  const latitude = Number(place.latitude ?? place.coordinate?.latitude);
  const longitude = Number(place.longitude ?? place.coordinate?.longitude);
  const hasCoordinate = Number.isFinite(latitude) && Number.isFinite(longitude);

  return {
    ...place,
    id: String(place.id || `${place.title}-${latitude}-${longitude}`),
    title: String(place.title || "Vieta"),
    subtitle: place.subtitle || "Klaipėda",
    type: place.type || "place",
    latitude: hasCoordinate ? latitude : undefined,
    longitude: hasCoordinate ? longitude : undefined,
    coordinate: hasCoordinate ? { latitude, longitude } : undefined,
    createdAt: place.createdAt || new Date().toISOString(),
  };
}

export async function getFavoritePlaces(): Promise<FavoritePlace[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeFavoritePlace);
  } catch {
    return [];
  }
}

export async function saveFavoritePlace(place: FavoritePlace): Promise<FavoritePlace[]> {
  const normalized = normalizeFavoritePlace(place);
  const current = await getFavoritePlaces();
  const next = [
    normalized,
    ...current.filter((item) => item.id !== normalized.id),
  ].slice(0, 30);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function removeFavoritePlace(id: string): Promise<FavoritePlace[]> {
  const current = await getFavoritePlaces();
  const next = current.filter((item) => item.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
