import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

export type FavoriteRoute = {
  id: string;
  fromLabel: string;
  toLabel: string;
  fromQuery: string;
  toQuery: string;
};

const FAVORITES_KEY = "arbebus_favorite_routes_v1";

export function useFavoriteRoutes() {
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY)
      .then((value) => {
        if (!value) return;
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) setFavorites(parsed);
      })
      .catch(() => {});
  }, []);

  const saveFavorite = useCallback(async (fromQuery: string, toQuery: string) => {
    if (!fromQuery || !toQuery) return;
    const next: FavoriteRoute[] = [
      { id: `${fromQuery}-${toQuery}`, fromLabel: fromQuery, toLabel: toQuery, fromQuery, toQuery },
      ...favorites.filter((item) => item.id !== `${fromQuery}-${toQuery}`),
    ].slice(0, 8);
    setFavorites(next);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  }, [favorites]);

  return { favorites, saveFavorite };
}
