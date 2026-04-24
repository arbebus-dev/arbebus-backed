import { Alert } from "react-native";
import { useCallback, useEffect, useState } from "react";
import type { TravelMode } from "../../../../types/home";
import type { PlaceSuggestion } from "../../rideBooking/models";
import { useRideState } from "./useRideState";
import { useFavoriteRoutes } from "./useFavoriteRoutes";

export function useMapScreenController({ useRideBookingResult, userLocation, handleSmartRoute, selectedMode, transitPlan }: {
  useRideBookingResult: any;
  userLocation: { latitude: number; longitude: number } | null;
  handleSmartRoute: () => Promise<any>;
  selectedMode: TravelMode;
  transitPlan: any;
}) {
  const [initialDataLoaded] = useState(true);
  const { favorites, saveFavorite } = useFavoriteRoutes();

  const {
    rideDraft, rideStatus, initializeRideBooking, searchResults, searchLoading,
    activeField, fromQuery, toQuery, setSearchField, updateQuery, selectSuggestion, clearField, swapPlaces, applyFavoriteRoute, flowState,
  } = useRideBookingResult;

  const rideUi = useRideState({
    flowState,
    rideStatus,
    transitPlan: transitPlan ?? null,
    hasDestination: Boolean(rideDraft.destination),
    hasResults: searchLoading || searchResults.length > 0,
  });

  useEffect(() => {
    initializeRideBooking(userLocation ?? null).catch(() => {});
  }, [initializeRideBooking, userLocation]);

  useEffect(() => {
    if (!rideDraft.pickup?.coordinate || !rideDraft.destination?.coordinate) return;
    if (selectedMode !== 'smart' && selectedMode !== 'bus') return;
    handleSmartRoute().catch(() => {});
  }, [handleSmartRoute, rideDraft.destination?.coordinate, rideDraft.pickup?.coordinate, selectedMode]);

  const onSaveFavorite = useCallback(async () => {
    if (!fromQuery || !toQuery) return;
    await saveFavorite(fromQuery, toQuery);
    Alert.alert('Išsaugota', 'Maršrutas pridėtas prie mėgstamų.');
  }, [fromQuery, saveFavorite, toQuery]);

  const onPressFavorite = useCallback(async (item: { fromQuery: string; toQuery: string; }) => {
    await applyFavoriteRoute({ fromQueryValue: item.fromQuery, toQueryValue: item.toQuery });
  }, [applyFavoriteRoute]);

  return {
    initialDataLoaded, favorites, onSaveFavorite, onPressFavorite, rideUi, rideDraft, searchResults: searchResults as PlaceSuggestion[], searchLoading, activeField, fromQuery, toQuery, setSearchField, updateQuery, selectSuggestion, clearField, swapPlaces, flowState,
  };
}
