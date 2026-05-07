import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type {
  Coordinate,
  TransitRouteOption,
} from "../features/transit/models/transitTypes";

interface ActiveTrip {
  routeId?: string;
  alightStopName?: string;
  alightCoordinate?: Coordinate | null;
  route?: TransitRouteOption | null;
}

interface NavigationState {
  activeTrip: ActiveTrip | null;
  setActiveTrip: (trip: ActiveTrip | null) => void;
  clearActiveTrip: () => void;
}

const ACTIVE_TRIP_KEY = "arbebus:active-trip:v2";

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      activeTrip: null,
      setActiveTrip: (trip) => set({ activeTrip: trip }),
      clearActiveTrip: () => set({ activeTrip: null }),
    }),
    {
      name: ACTIVE_TRIP_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
