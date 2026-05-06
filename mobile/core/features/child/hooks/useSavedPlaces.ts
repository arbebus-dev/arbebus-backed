import { useCallback, useEffect, useState } from "react";
import type { PlaceSearchResult } from "../../transit/models/transitTypes";
import { getSavedPlaces, savePlace, removeSavedPlace, type SavedPlace, type SavedPlaceType } from "../services/savedPlacesStorage";
import { syncSavedPlace } from "../../parent/services/parentApi";

export function useSavedPlaces() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPlaces(await getSavedPlaces());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (type: SavedPlaceType, place: PlaceSearchResult) => {
    const saved = await savePlace(type, place);
    setPlaces(await getSavedPlaces());
    void syncSavedPlace({ placeType: type, place }).catch(() => undefined);
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    await removeSavedPlace(id);
    setPlaces(await getSavedPlaces());
  }, []);

  return { places, loading, refresh, save, remove };
}
